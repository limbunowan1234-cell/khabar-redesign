import { Hono } from 'hono';
import { verifyUser, isAdmin } from '../lib/auth';
import { verifyPlayer } from '../lib/player';
import { SIMON_MODES } from '../lib/simonSpeed';
import { BOARD_SQL, FIRST_PERIOD, GAME, currentPeriod, isMode, isPeriod, roundDates, shiftPeriod } from './games';

type Bindings = { DB: D1Database; IMAGES: R2Bucket; AUTH_JWT_SECRET: string };

export const prizes = new Hono<{ Bindings: Bindings }>();

// Prize claims for the Simon Speed competition. Once a round has finished,
// the #1 player in each mode can upload the QR code of their UPI account so
// the prize can be sent; an admin sees every winner and claim and marks
// prizes paid.
//
// QR codes are personal payment details, so they're stored in R2 under
// prize-qr/ with a random name and only ever served to an admin through
// GET /prizes/:id/qr. /cdn never serves that folder.

export const PRIZE: Record<string, number> = { easy: 100, medium: 300, hard: 500 };
const QR_PREFIX = 'prize-qr/';
const QR_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX_QR_BYTES = 5 * 1024 * 1024;
// Rounds stay claimable for a while after they end, then close.
const CLAIM_WINDOW_ROUNDS = 3;
const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

// Finished rounds that can still be claimed, newest first.
function claimablePeriods(): string[] {
  const out: string[] = [];
  let p = shiftPeriod(currentPeriod(), -1);
  while (p >= FIRST_PERIOD && out.length < CLAIM_WINDOW_ROUNDS) {
    out.push(p);
    p = shiftPeriod(p, -1);
  }
  return out;
}

async function winnerOf(db: D1Database, mode: string, period: string) {
  return db.prepare(BOARD_SQL + ' LIMIT 1').bind(GAME, mode, period).first<any>();
}

function claimJson(row: any) {
  if (!row) return null;
  return { id: row.id, status: row.status, upiId: row.upi_id, submittedAt: row.updated_at, paidAt: row.paid_at };
}

// GET /prizes/mine -> { prizes: [{ mode, period, start, end, amount, score, claim }] }
// The rounds the logged-in player won that can still be claimed (or were
// already claimed or paid).
prizes.get('/mine', async (c) => {
  const player = await verifyPlayer(c.req.raw, c.env);
  if (!player) return c.json({ error: 'Not logged in' }, 401);

  const won = [];
  for (const period of claimablePeriods()) {
    for (const mode of SIMON_MODES) {
      const w = await winnerOf(c.env.DB, mode, period);
      if (!w || w.player_id !== player.id) continue;
      const claim = await c.env.DB
        .prepare('SELECT * FROM prize_claims WHERE game = ? AND mode = ? AND period = ?')
        .bind(GAME, mode, period)
        .first();
      won.push({ mode, period, ...roundDates(period), amount: PRIZE[mode], score: w.score, claim: claimJson(claim) });
    }
  }
  return c.json({ prizes: won });
});

// PUT /prizes/:period/:mode  (multipart: qr = image file, upiId = optional)
// The round's winner submits or replaces their payment QR code. Not
// allowed once the prize is marked paid.
prizes.put('/:period/:mode', async (c) => {
  const player = await verifyPlayer(c.req.raw, c.env);
  if (!player) return c.json({ error: 'Log in to claim your prize.' }, 401);
  const { period, mode } = c.req.param();
  if (!isPeriod(period) || !isMode(mode) || !claimablePeriods().includes(period)) {
    return c.json({ error: 'This round cannot be claimed.' }, 400);
  }

  const winner = await winnerOf(c.env.DB, mode, period);
  if (!winner || winner.player_id !== player.id) return c.json({ error: 'Only the winner of this round can claim the prize.' }, 403);

  const existing = await c.env.DB
    .prepare('SELECT * FROM prize_claims WHERE game = ? AND mode = ? AND period = ?')
    .bind(GAME, mode, period)
    .first<any>();
  if (existing?.status === 'paid') return c.json({ error: 'This prize has already been paid.' }, 409);

  const form = await c.req.formData().catch(() => null);
  const file = form?.get('qr') as File | string | null;
  if (!file || typeof file === 'string') return c.json({ error: 'Choose a photo or screenshot of your UPI QR code.' }, 400);
  const ext = QR_TYPES[file.type];
  if (!ext) return c.json({ error: 'The QR code must be a PNG, JPG or WebP image.' }, 400);
  if (file.size > MAX_QR_BYTES) return c.json({ error: 'The image is over 5 MB. Try a screenshot instead.' }, 413);

  const rawUpi = String(form?.get('upiId') || '').trim();
  if (rawUpi && !UPI_ID.test(rawUpi)) return c.json({ error: 'That UPI ID does not look right. It should look like name@bank.' }, 400);

  const key = QR_PREFIX + crypto.randomUUID() + '.' + ext;
  await c.env.IMAGES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  if (existing) {
    await c.env.DB
      .prepare("UPDATE prize_claims SET qr_key = ?, qr_type = ?, upi_id = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(key, file.type, rawUpi || null, existing.id)
      .run();
    await c.env.IMAGES.delete(existing.qr_key).catch(() => {});
  } else {
    await c.env.DB
      .prepare('INSERT INTO prize_claims (id, player_id, game, mode, period, amount, qr_key, qr_type, upi_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), player.id, GAME, mode, period, PRIZE[mode], key, file.type, rawUpi || null)
      .run();
  }
  const row = await c.env.DB
    .prepare('SELECT * FROM prize_claims WHERE game = ? AND mode = ? AND period = ?')
    .bind(GAME, mode, period)
    .first();
  return c.json({ claim: claimJson(row) });
});

// --- Admin ---

async function requireAdmin(req: Request, env: Bindings): Promise<boolean> {
  return isAdmin(await verifyUser(req, env));
}

// GET /prizes -> { rounds: [{ period, start, end, closed, winners: [{ mode, amount, gameName, phone, score, claim }] }] }
// Every finished round plus the current one (whose leader can still
// change), with each mode's winner and their claim, if any.
prizes.get('/', async (c) => {
  if (!(await requireAdmin(c.req.raw, c.env))) return c.json({ error: 'Admin only' }, 403);

  const current = currentPeriod();
  const rounds = [];
  for (let p = current; p >= FIRST_PERIOD && rounds.length < 12; p = shiftPeriod(p, -1)) {
    const winners = [];
    for (const mode of SIMON_MODES) {
      const w = await winnerOf(c.env.DB, mode, p);
      const claim = await c.env.DB
        .prepare('SELECT * FROM prize_claims WHERE game = ? AND mode = ? AND period = ?')
        .bind(GAME, mode, p)
        .first<any>();
      winners.push({
        mode,
        amount: claim?.amount || PRIZE[mode],
        gameName: w?.game_name || null,
        phone: w?.phone || null,
        score: w?.score || null,
        claim: claimJson(claim),
      });
    }
    rounds.push({ period: p, ...roundDates(p), closed: p !== current, winners });
  }
  return c.json({ rounds });
});

// GET /prizes/:id/qr -> the uploaded QR image (admin only)
prizes.get('/:id/qr', async (c) => {
  if (!(await requireAdmin(c.req.raw, c.env))) return c.json({ error: 'Admin only' }, 403);
  const row = await c.env.DB.prepare('SELECT qr_key, qr_type FROM prize_claims WHERE id = ?').bind(c.req.param('id')).first<any>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  const object = await c.env.IMAGES.get(row.qr_key);
  if (!object) return c.json({ error: 'QR image missing' }, 404);
  return new Response(object.body, {
    headers: { 'Content-Type': row.qr_type, 'Cache-Control': 'private, no-store' },
  });
});

// PATCH /prizes/:id { status: 'paid' | 'submitted' } (admin only)
prizes.patch('/:id', async (c) => {
  if (!(await requireAdmin(c.req.raw, c.env))) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json().catch(() => null);
  if (body?.status !== 'paid' && body?.status !== 'submitted') return c.json({ error: "status must be 'paid' or 'submitted'" }, 400);
  const res = await c.env.DB
    .prepare(`UPDATE prize_claims SET status = ?, paid_at = ${body.status === 'paid' ? "datetime('now')" : 'NULL'}, updated_at = datetime('now') WHERE id = ?`)
    .bind(body.status, c.req.param('id'))
    .run();
  if (!res.meta.changes) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});
