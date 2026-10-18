// Browser-side helpers for player accounts (in-game name + phone + PIN),
// used by the Simon Speed web game and app reviews. The Worker side is
// cloudflare/src/routes/players.ts. A player token is a separate login from
// the site's email accounts and only works for games and reviews.

import { WORKER_URL } from '@/lib/downloadCategories';

export interface PlayerProfile {
  id: string;
  gameName: string;
  phone: string; // masked, e.g. "+91 98xxxxxx10"
}

const STORAGE_KEY = 'kd_player_session';
const CHANGE_EVENT = 'kd-player-change';

interface StoredSession {
  token: string;
  player: PlayerProfile;
}

function read(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function getPlayerSession(): StoredSession | null {
  return typeof window === 'undefined' ? null : read();
}

export function savePlayerSession(session: StoredSession): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function logoutPlayer(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Calls back whenever the player logs in or out, in this tab or another.
export function onPlayerChange(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) callback(); };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// Fetch from the Worker with the player token attached (when logged in).
// A 401 means the saved login is no longer valid, so it is cleared.
export async function playerFetch<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const session = getPlayerSession();
  const res = await fetch(WORKER_URL + path, {
    method: init.method || 'GET',
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Authorization: 'Bearer ' + session.token } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && session) logoutPlayer();
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status);
  return data as T;
}
