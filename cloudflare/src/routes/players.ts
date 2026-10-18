import { Hono } from 'hono';
import { hashPassword, verifyPassword } from '../lib/password';
import {
  isValidPin, maskPhone, normaliseGameName, normalisePhone, signPlayerToken, verifyPlayer,
} from '../lib/player';

type Bindings = { DB: D1Database; AUTH_JWT_SECRET: string };

export const players = new Hono<{ Bindings: Bindings }>();

// A 4-digit PIN only has 10,000 combinations, so guessing is stopped by
// locking the account for a while after a few wrong tries.
const MAX_PIN_FAILURES = 5;
const LOCK_MINUTES = 15;

function sqlNow(offsetMinutes = 0): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString().replace('T', ' ').slice(0, 19);
}

async function session(player: { id: string; game_name: string; phone: string }, env: Bindings) {
  const token = await signPlayerToken({ id: player.id, gameName: player.game_name }, env);
  return { token, player: { id: player.id, gameName: player.game_name, phone: maskPhone(player.phone) } };
}

// POST /players/register { gameName, phone, pin }
players.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  const gameName = normaliseGameName(body?.gameName);
  const phone = normalisePhone(body?.phone);
  if (!gameName) return c.json({ error: 'Game name must be 3 to 20 letters or numbers.' }, 400);
  if (!phone) return c.json({ error: 'Enter a valid 10-digit Indian mobile number.' }, 400);
  if (!isValidPin(body?.pin)) return c.json({ error: 'PIN must be exactly 4 digits.' }, 400);

  const taken = await c.env.DB
    .prepare('SELECT phone = ? AS same_phone FROM players WHERE phone = ? OR game_name = ? COLLATE NOCASE LIMIT 1')
    .bind(phone, phone, gameName)
    .first<{ same_phone: number }>();
  if (taken) {
    return taken.same_phone
      ? c.json({ error: 'This number already has an account. Log in with your PIN instead.' }, 409)
      : c.json({ error: 'That game name is taken. Try another one.' }, 409);
  }

  const id = crypto.randomUUID();
  try {
    await c.env.DB
      .prepare('INSERT INTO players (id, game_name, phone, pin_hash) VALUES (?, ?, ?, ?)')
      .bind(id, gameName, phone, await hashPassword(body.pin))
      .run();
  } catch {
    // Lost a race with another signup for the same name or number.
    return c.json({ error: 'That game name or number was just taken. Try again.' }, 409);
  }
  return c.json(await session({ id, game_name: gameName, phone }, c.env), 201);
});

// POST /players/login { phone, pin }
players.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const phone = normalisePhone(body?.phone);
  if (!phone || !isValidPin(body?.pin)) return c.json({ error: 'Enter your mobile number and 4-digit PIN.' }, 400);

  const row = await c.env.DB
    .prepare('SELECT id, game_name, phone, pin_hash, failed_pin_count, locked_until FROM players WHERE phone = ?')
    .bind(phone)
    .first<any>();
  if (!row) return c.json({ error: 'Wrong number or PIN.' }, 401);

  if (row.locked_until && row.locked_until > sqlNow()) {
    return c.json({ error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes.` }, 429);
  }

  if (!(await verifyPassword(body.pin, row.pin_hash))) {
    const failures = (row.failed_pin_count || 0) + 1;
    const lock = failures >= MAX_PIN_FAILURES;
    await c.env.DB
      .prepare('UPDATE players SET failed_pin_count = ?, locked_until = ?, updated_at = ? WHERE id = ?')
      .bind(lock ? 0 : failures, lock ? sqlNow(LOCK_MINUTES) : null, sqlNow(), row.id)
      .run();
    return lock
      ? c.json({ error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes.` }, 429)
      : c.json({ error: 'Wrong number or PIN.' }, 401);
  }

  if (row.failed_pin_count || row.locked_until) {
    await c.env.DB
      .prepare('UPDATE players SET failed_pin_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?')
      .bind(sqlNow(), row.id)
      .run();
  }
  return c.json(await session(row, c.env));
});

// GET /players/me -> the logged-in player, or 401 when the token is missing,
// expired, or the account no longer exists.
players.get('/me', async (c) => {
  const player = await verifyPlayer(c.req.raw, c.env);
  if (!player) return c.json({ error: 'Not logged in' }, 401);
  const row = await c.env.DB.prepare('SELECT id, game_name, phone FROM players WHERE id = ?').bind(player.id).first<any>();
  if (!row) return c.json({ error: 'Not logged in' }, 401);
  return c.json({ player: { id: row.id, gameName: row.game_name, phone: maskPhone(row.phone) } });
});
