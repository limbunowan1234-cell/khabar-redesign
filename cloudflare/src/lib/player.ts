// Player identity for the web game and app reviews (see routes/players.ts).
//
// Player tokens reuse lib/jwt.ts's HS256 signing, but with a key derived
// from AUTH_JWT_SECRET plus a fixed suffix. That keeps them completely
// separate from site login tokens: verifyUser() can never accept a player
// token (so a player can't post article comments or reach admin routes),
// and verifyPlayer() can never accept a site token.

import { signAccessToken, verifyAccessToken } from './jwt';

type Env = { AUTH_JWT_SECRET: string };

// Players have no refresh-session flow, so the token itself is the login.
const PLAYER_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function playerSecret(env: Env): string {
  return env.AUTH_JWT_SECRET + ':player';
}

export interface Player {
  id: string;
  gameName: string;
}

export function signPlayerToken(player: Player, env: Env): Promise<string> {
  return signAccessToken(
    { sub: player.id, email: '', name: player.gameName, labels: ['player'] },
    playerSecret(env),
    PLAYER_TOKEN_TTL_SECONDS
  );
}

// The player for the request's `Authorization: Bearer <token>`, or null.
export async function verifyPlayer(request: Request, env: Env): Promise<Player | null> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const claims = await verifyAccessToken(header.slice('Bearer '.length).trim(), playerSecret(env));
  if (!claims || !(claims.labels || []).includes('player')) return null;
  return { id: claims.sub, gameName: claims.name };
}

// Indian mobile numbers only for now: accepts "98765 43210", "+91 98765-43210",
// "098765 43210" and so on, and returns "+919876543210", or null.
export function normalisePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? '+91' + digits : null;
}

// "+919876543210" -> "+91 98xxxxxx10", for showing a player their own number.
export function maskPhone(phone: string): string {
  const d = phone.slice(3);
  return '+91 ' + d.slice(0, 2) + 'xxxxxx' + d.slice(8);
}

// 3-20 characters: letters (any script, so Nepali names work), digits,
// spaces, dots, underscores and hyphens. Trimmed, with runs of spaces collapsed.
export function normaliseGameName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 3 || name.length > 20) return null;
  return /^[\p{L}\p{M}\p{N} ._-]+$/u.test(name) ? name : null;
}

export function isValidPin(raw: unknown): raw is string {
  return typeof raw === 'string' && /^\d{4}$/.test(raw);
}
