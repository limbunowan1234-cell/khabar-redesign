import { Hono } from 'hono';
import { verifyUser, isAdmin } from '../lib/auth';
import { verifyPlayer } from '../lib/player';
import { SIMON_MODES, minimumPlayMs, replaySimon, type SimonMode } from '../lib/simonSpeed';

type Bindings = { DB: D1Database; AUTH_JWT_SECRET: string };

export const games = new Hono<{ Bindings: Bindings }>();

// The web version of Simon Speed with a monthly Top 10 per mode.
//
// Scores are never trusted from the browser. Starting a game stores a seed
// chosen here; finishing sends back only the pads the player tapped, and
// the game is replayed with the shared rules in lib/simonSpeed.ts to work
// out the score. Results that finish faster than the pattern could even be
// shown are rejected too.

const GAME = 'simon-speed';
const MAX_TAPS = 20_000;
const SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const MAX_STARTS_PER_HOUR = 200;
// Network delay and clock rounding mean a real game can look a little
// quicker than the theoretical minimum.
const TIMING_TOLERANCE = 0.8;

function isMode(m: unknown): m is SimonMode {
  return typeof m === 'string' && (SIMON_MODES as readonly string[]).includes(m);
}

// Competitions run by calendar month in India time.
function currentPeriod(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

function isPeriod(p: unknown): p is string {
  return typeof p === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

function parseSqlTime(s: string): number {
  return Date.parse(s.replace(' ', 'T') + 'Z');
}

// Each player's best score this period, ranked. Ties go to whoever got
// there first.
const BOARD_SQL = `
  WITH best AS (
    SELECT player_id, MAX(score) AS score
    FROM game_scores WHERE game = ?1 AND mode = ?2 AND period = ?3
    GROUP BY player_id
  ), first_hit AS (
    SELECT g.player_id, b.score, MIN(g.created_at) AS achieved_at, MAX(g.level) AS level
    FROM best b JOIN game_scores g
      ON g.player_id = b.player_id AND g.score = b.score AND g.game = ?1 AND g.mode = ?2 AND g.period = ?3
    GROUP BY g.player_id, b.score
  )
  SELECT f.player_id, f.score, f.level, f.achieved_at, p.game_name, p.phone
  FROM first_hit f JOIN players p ON p.id = f.player_id
  ORDER BY f.score DESC, f.achieved_at ASC`;

// POST /games/simon-speed/start { mode } -> { sessionId, seed }
games.post('/simon-speed/start', async (c) => {
  const player = await verifyPlayer(c.req.raw, c.env);
  if (!player) return c.json({ error: 'Log in to play for the leaderboard.' }, 401);
  const body = await c.req.json().catch(() => null);
  if (!isMode(body?.mode)) return c.json({ error: 'mode must be easy, medium or hard' }, 400);

  const recent = await c.env.DB
    .prepare("SELECT COUNT(*) AS n FROM game_sessions WHERE player_id = ? AND started_at > datetime('now', '-1 hour')")
    .bind(player.id)
    .first<{ n: number }>();
  if ((recent?.n || 0) >= MAX_STARTS_PER_HOUR) return c.json({ error: 'Too many games this hour. Take a short break.' }, 429);

  const id = crypto.randomUUID();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  await c.env.DB
    .prepare('INSERT INTO game_sessions (id, player_id, game, mode, seed) VALUES (?, ?, ?, ?, ?)')
    .bind(id, player.id, GAME, body.mode, seed)
    .run();
  return c.json({ sessionId: id, seed, mode: body.mode });
});

// POST /games/simon-speed/finish { sessionId, taps: number[] }
//   -> { score, level, best, rank, period }
games.post('/simon-speed/finish', async (c) => {
  const player = await verifyPlayer(c.req.raw, c.env);
  if (!player) return c.json({ error: 'Log in to save your score.' }, 401);
  const body = await c.req.json().catch(() => null);
  const taps = body?.taps;
  if (typeof body?.sessionId !== 'string' || !Array.isArray(taps) || taps.length > MAX_TAPS) {
    return c.json({ error: 'sessionId and taps are required' }, 400);
  }

  const s = await c.env.DB
    .prepare('SELECT id, player_id, mode, seed, started_at, finished_at FROM game_sessions WHERE id = ? AND game = ?')
    .bind(body.sessionId, GAME)
    .first<any>();
  if (!s || s.player_id !== player.id) return c.json({ error: 'Game not found' }, 404);
  if (s.finished_at) return c.json({ error: 'This game was already saved.' }, 409);

  const elapsed = Date.now() - parseSqlTime(s.started_at);
  if (elapsed > SESSION_MAX_AGE_MS) return c.json({ error: 'This game is too old to save.' }, 410);

  const result = replaySimon(s.seed, s.mode, taps);
  if (!result.valid) return c.json({ error: 'That game could not be verified.' }, 422);
  if (elapsed < minimumPlayMs(result.level) * TIMING_TOLERANCE) {
    return c.json({ error: 'That game could not be verified.' }, 422);
  }

  // Claim the session atomically so a double submit can't count twice.
  const claimed = await c.env.DB
    .prepare("UPDATE game_sessions SET finished_at = datetime('now') WHERE id = ? AND finished_at IS NULL")
    .bind(s.id)
    .run();
  if (!claimed.meta.changes) return c.json({ error: 'This game was already saved.' }, 409);

  const period = currentPeriod();
  if (result.score > 0) {
    await c.env.DB
      .prepare('INSERT INTO game_scores (id, session_id, player_id, game, mode, period, score, level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), s.id, player.id, GAME, s.mode, period, result.score, result.level)
      .run();
  }

  const mine = await c.env.DB
    .prepare('SELECT MAX(score) AS best FROM game_scores WHERE player_id = ? AND game = ? AND mode = ? AND period = ?')
    .bind(player.id, GAME, s.mode, period)
    .first<{ best: number | null }>();
  const best = mine?.best || 0;
  const rank = best > 0 ? await rankFor(c.env.DB, s.mode, period, player.id) : null;
  return c.json({ score: result.score, level: result.level, best, rank, period });
});

// The player's place on the board, using the same order as BOARD_SQL
// (higher score first, then whoever reached it first), or null if they
// haven't scored this period.
async function rankFor(db: D1Database, mode: string, period: string, playerId: string): Promise<number | null> {
  const row = await db
    .prepare(`WITH board AS (${BOARD_SQL})
      SELECT (SELECT COUNT(*) FROM board o
              WHERE o.score > me.score OR (o.score = me.score AND o.achieved_at < me.achieved_at)) + 1 AS rank
      FROM board me WHERE me.player_id = ?4`)
    .bind(GAME, mode, period, playerId)
    .first<{ rank: number }>();
  return row ? row.rank : null;
}

// GET /games/simon-speed/leaderboard?mode=easy[&period=2026-10]
//   -> { mode, period, top: [{ rank, gameName, score, level, achievedAt }], me }
// `me` is the logged-in player's own best and rank (null if they haven't
// scored this period). A site admin also gets each winner's phone number,
// so prizes can be arranged.
games.get('/simon-speed/leaderboard', async (c) => {
  const mode = c.req.query('mode');
  if (!isMode(mode)) return c.json({ error: 'mode must be easy, medium or hard' }, 400);
  const period = c.req.query('period') || currentPeriod();
  if (!isPeriod(period)) return c.json({ error: 'period must look like 2026-10' }, 400);

  const [player, user] = await Promise.all([verifyPlayer(c.req.raw, c.env), verifyUser(c.req.raw, c.env)]);
  const admin = isAdmin(user);

  const { results } = await c.env.DB.prepare(BOARD_SQL + ' LIMIT 10').bind(GAME, mode, period).all<any>();
  const top = (results || []).map((r, i) => ({
    rank: i + 1,
    gameName: r.game_name,
    score: r.score,
    level: r.level,
    achievedAt: r.achieved_at,
    ...(admin ? { phone: r.phone } : {}),
  }));

  let me = null;
  if (player) {
    const mine = await c.env.DB
      .prepare('SELECT MAX(score) AS best, MAX(level) AS level FROM game_scores WHERE player_id = ? AND game = ? AND mode = ? AND period = ?')
      .bind(player.id, GAME, mode, period)
      .first<{ best: number | null; level: number | null }>();
    if (mine?.best) me = { gameName: player.gameName, score: mine.best, rank: (await rankFor(c.env.DB, mode, period, player.id)) || 0 };
  }

  if (!player && !admin) c.header('Cache-Control', 'public, max-age=15');
  return c.json({ mode, period, currentPeriod: currentPeriod(), top, me });
});
