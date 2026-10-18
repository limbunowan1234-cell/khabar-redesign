// Simon Speed rules, shared by the Worker (which replays every submitted game
// to verify the score) and the website (which plays it). The two copies --
// cloudflare/src/lib/simonSpeed.ts and lib/simonSpeed.ts -- must stay
// identical; they are separate files only because the Worker and the
// Next.js app are separate TypeScript projects.
//
// Rules match the Android game: the pads flash a pattern, the player repeats
// it, and every round adds one step. +10 per correct tap, and clearing round
// N adds a bonus of 10 x N. One wrong tap ends the game.

export const SIMON_MODES = ['easy', 'medium', 'hard'] as const;
export type SimonMode = (typeof SIMON_MODES)[number];

export const PADS_PER_MODE: Record<SimonMode, number> = { easy: 4, medium: 6, hard: 10 };

// Long enough for any real game; stops a crafted submission from making the
// replay loop expensive.
export const MAX_ROUNDS = 500;

// mulberry32: tiny, fast and deterministic across JS engines.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The full pattern for a game. Round N plays the first N entries.
export function simonSequence(seed: number, mode: SimonMode, length = MAX_ROUNDS): number[] {
  const rand = mulberry32(seed);
  const pads = PADS_PER_MODE[mode];
  const seq: number[] = [];
  for (let i = 0; i < length; i++) seq.push(Math.floor(rand() * pads));
  return seq;
}

// How long each pad lights up in a round, in milliseconds. Gets quicker as
// the game goes on, but never faster than a person can follow.
export function flashMs(round: number): number {
  return Math.max(220, 620 - round * 22);
}

export interface SimonResult {
  score: number;
  level: number; // rounds fully cleared
  valid: boolean; // false if the taps don't describe a real game
}

// Replays a game from the player's taps. A finished game is: zero or more
// fully cleared rounds, then optionally a partial round that ends either on
// a wrong tap (game over) or with the player giving up. Anything after a
// wrong tap means the submission was not produced by the real game.
export function replaySimon(seed: number, mode: SimonMode, taps: number[]): SimonResult {
  const pads = PADS_PER_MODE[mode];
  if (taps.some((t) => !Number.isInteger(t) || t < 0 || t >= pads)) return { score: 0, level: 0, valid: false };

  const seq = simonSequence(seed, mode);
  let score = 0;
  let level = 0;
  let pos = 0;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    for (let i = 0; i < round; i++) {
      if (pos >= taps.length) return { score, level, valid: true };
      if (taps[pos] !== seq[i]) {
        pos++;
        return { score, level, valid: pos === taps.length };
      }
      score += 10;
      pos++;
    }
    score += 10 * round;
    level = round;
  }
  return { score, level, valid: pos === taps.length };
}

// The least time a real game reaching `level` can take: every round shows
// its whole pattern before the player may answer. Used to reject results
// that arrive faster than the game could have been played.
export function minimumPlayMs(level: number): number {
  let ms = 0;
  for (let round = 1; round <= level; round++) ms += round * flashMs(round);
  return ms;
}
