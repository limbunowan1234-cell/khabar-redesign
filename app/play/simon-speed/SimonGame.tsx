'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './play.module.css';
import PlayerAuth from '@/components/PlayerAuth';
import { getPlayerSession, logoutPlayer, onPlayerChange, playerFetch, type PlayerProfile, errorMessage } from '@/lib/player';
import { PADS_PER_MODE, SIMON_MODES, flashMs, simonSequence, type SimonMode } from '@/lib/simonSpeed';

const MODE_LABEL: Record<SimonMode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
// Monthly prize, in rupees, for the #1 player in each mode.
const PRIZE: Record<SimonMode, number> = { easy: 100, medium: 300, hard: 500 };
const PAD_COLORS = ['#ff3b5c', '#2f80ff', '#ffd23f', '#22e39a', '#b05bff', '#ff8a2b', '#ff5cc8', '#2ee6f2', '#a6f23a', '#f2f2f2'];
const PAD_TONES = [262, 330, 392, 523, 294, 349, 440, 494, 587, 659];
const BETWEEN_ROUNDS_MS = 650;

type Phase = 'idle' | 'starting' | 'showing' | 'input' | 'over';

interface BoardRow { rank: number; gameName: string; score: number; level: number }
interface Board {
  period: string;
  start: string;
  end: string;
  currentPeriod: string;
  previousPeriod: string | null;
  top: BoardRow[];
  me: { gameName: string; score: number; rank: number } | null;
}
interface Result { score: number; level: number; best?: number; rank?: number | null; saved: boolean; error?: string }

// '2026-11-18' -> '18 Nov 2026' (or '18 Nov' without the year).
function dayName(day: string, withYear = true): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });
}

export default function SimonGame() {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [mode, setMode] = useState<SimonMode>('easy');
  const [phase, setPhase] = useState<Phase>('idle');
  const [lit, setLit] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [startError, setStartError] = useState('');
  const [muted, setMuted] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [boardPeriod, setBoardPeriod] = useState<string | null>(null);
  const [boardError, setBoardError] = useState('');

  // Game state the timers and tap handler need without re-rendering.
  const game = useRef({ seq: [] as number[], taps: [] as number[], step: 0, round: 0, score: 0, sessionId: null as string | null, mode: 'easy' as SimonMode, timers: [] as number[], accepting: false });
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    const sync = () => setPlayer(getPlayerSession()?.player || null);
    sync();
    return onPlayerChange(sync);
  }, []);

  const loadBoard = useCallback(async (m: SimonMode, period: string | null) => {
    setBoardError('');
    try {
      const data = await playerFetch<Board>('/games/simon-speed/leaderboard?mode=' + m + (period ? '&period=' + period : ''));
      setBoard(data);
    } catch {
      setBoardError('The leaderboard could not be loaded right now.');
    }
  }, []);

  useEffect(() => { loadBoard(mode, boardPeriod); }, [mode, boardPeriod, player?.id, loadBoard]);

  const clearTimers = () => { game.current.timers.forEach((t) => window.clearTimeout(t)); game.current.timers = []; };
  const later = (fn: () => void, ms: number) => { game.current.timers.push(window.setTimeout(fn, ms)); };
  useEffect(() => clearTimers, []);

  function tone(pad: number, ms: number, wrong = false) {
    if (muted) return;
    try {
      audio.current = audio.current || new AudioContext();
      const ctx = audio.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wrong ? 'sawtooth' : 'sine';
      osc.frequency.value = wrong ? 110 : PAD_TONES[pad];
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + ms / 1000 + 0.05);
    } catch {}
  }

  // Plays the first `r` steps of the pattern. Each step takes exactly
  // flashMs(r), the same timing the server uses to check results.
  function showRound(r: number) {
    const g = game.current;
    g.round = r;
    g.step = 0;
    g.accepting = false;
    setRound(r);
    setPhase('showing');
    const step = flashMs(r);
    for (let i = 0; i < r; i++) {
      later(() => { setLit(g.seq[i]); tone(g.seq[i], step * 0.7); }, i * step);
      later(() => setLit(null), i * step + step * 0.7);
    }
    later(() => { g.accepting = true; setPhase('input'); }, r * step);
  }

  async function start() {
    clearTimers();
    setStartError('');
    setResult(null);
    setScore(0);
    setRound(0);
    setPhase('starting');
    // Browsers only allow sound after a tap, so unlock it now.
    try { audio.current = audio.current || new AudioContext(); await audio.current.resume(); } catch {}

    let seed: number;
    let sessionId: string | null = null;
    if (player) {
      try {
        const s = await playerFetch<{ sessionId: string; seed: number }>('/games/simon-speed/start', { method: 'POST', body: { mode } });
        seed = s.seed;
        sessionId = s.sessionId;
      } catch (err) {
        setStartError(errorMessage(err));
        setPhase('idle');
        return;
      }
    } else {
      seed = crypto.getRandomValues(new Uint32Array(1))[0];
    }
    game.current = { ...game.current, seq: simonSequence(seed, mode), taps: [], step: 0, round: 0, score: 0, sessionId, mode, accepting: false };
    later(() => showRound(1), 500);
  }

  async function finish() {
    const g = game.current;
    setPhase('over');
    const level = g.round - 1;
    if (!g.sessionId) {
      setResult({ score: g.score, level, saved: false });
      return;
    }
    try {
      const res = await playerFetch<{ score: number; level: number; best: number; rank: number | null }>('/games/simon-speed/finish', {
        method: 'POST', body: { sessionId: g.sessionId, taps: g.taps },
      });
      setResult({ ...res, saved: true });
      setBoardPeriod(null);
      loadBoard(g.mode, null);
    } catch (err) {
      setResult({ score: g.score, level, saved: false, error: errorMessage(err) });
    }
  }

  function tap(pad: number) {
    // A ref, not the `phase` state, so a quick extra tap can't slip in
    // before React re-renders.
    const g = game.current;
    if (!g.accepting) return;
    g.taps.push(pad);
    if (pad !== g.seq[g.step]) {
      g.accepting = false;
      setLit(pad);
      tone(pad, 400, true);
      try { navigator.vibrate?.(200); } catch {}
      later(() => setLit(null), 300);
      finish();
      return;
    }
    setLit(pad);
    tone(pad, 180);
    later(() => setLit(null), 160);
    g.step++;
    g.score += 10;
    if (g.step === g.round) {
      g.accepting = false;
      g.score += 10 * g.round;
      setPhase('showing');
      later(() => showRound(g.round + 1), BETWEEN_ROUNDS_MS);
    }
    setScore(g.score);
  }

  // Number keys 1-9 and 0 press the pads, for keyboard players.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = e.key === '0' ? 9 : Number(e.key) - 1;
      if (Number.isInteger(n) && n >= 0 && n < PADS_PER_MODE[game.current.mode]) tap(n);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pads = PADS_PER_MODE[mode];
  const playing = phase === 'starting' || phase === 'showing' || phase === 'input';
  const status = phase === 'starting' ? 'Get ready…'
    : phase === 'showing' ? 'Watch the pattern'
    : phase === 'input' ? 'Your turn'
    : phase === 'over' ? 'Game over'
    : 'Press Play to start';
  const isCurrent = !!board && board.period === board.currentPeriod;

  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        <Link href="/" className={styles.brand}>Khabar Darjeeling</Link>
        <div className={styles.topLinks}>
          <Link href="/apps/simon-speed" className={styles.pill}>Get the app</Link>
          <Link href="/apps" className={styles.pill}>All apps</Link>
        </div>
      </div>

      <main className={styles.shell}>
        <header className={styles.head}>
          <div>
            <p className={styles.eyebrow}>Khabar Games · Monthly competition</p>
            <h1 className={styles.title}>Simon <span>Speed</span></h1>
            <p className={styles.sub}>Watch the pads flash, repeat the pattern, and go as far as you can. The #1 player in each mode wins a cash prize every month.</p>
            <ul className={styles.prizes} aria-label="Monthly prizes">
              {SIMON_MODES.map((m) => (
                <li key={m}><strong>₹{PRIZE[m]}</strong><span>{MODE_LABEL[m]}</span></li>
              ))}
            </ul>
          </div>
          <div className={styles.account}>
            {player ? (
              <>
                <span>Playing as <strong>{player.gameName}</strong></span>
                <button type="button" className={styles.linkBtn} onClick={() => { logoutPlayer(); setShowAuth(false); }}>Log out</button>
              </>
            ) : (
              <button type="button" className={styles.ghostBtn} onClick={() => setShowAuth((v) => !v)}>{showAuth ? 'Close' : 'Log in to compete'}</button>
            )}
          </div>
        </header>

        {!player && showAuth && (
          <div className={styles.authPanel}>
            <PlayerAuth intro="Create a free player account to save your scores and compete for the monthly Top 10." onDone={() => setShowAuth(false)} />
          </div>
        )}

        <div className={styles.layout}>
          <section className={styles.gamePanel} aria-label="Game">
            <div className={styles.modes} role="tablist" aria-label="Mode">
              {SIMON_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  disabled={playing}
                  onClick={() => { setMode(m); setPhase('idle'); setResult(null); setScore(0); setRound(0); setBoardPeriod(null); }}
                  className={mode === m ? styles.modeOn : styles.mode}
                >
                  {MODE_LABEL[m]} <small>{PADS_PER_MODE[m]} colours · ₹{PRIZE[m]}</small>
                </button>
              ))}
            </div>

            <div className={styles.hud}>
              <div><span>Score</span><strong>{score}</strong></div>
              <div><span>Level</span><strong>{Math.max(0, round - (phase === 'over' ? 1 : 0))}</strong></div>
              <div className={styles.status} aria-live="polite">{status}</div>
            </div>

            <div className={`${styles.board} ${styles['board' + pads]}`} data-phase={phase}>
              {Array.from({ length: pads }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.pad} ${lit === i ? styles.padLit : ''}`}
                  style={{ '--pad': PAD_COLORS[i] } as React.CSSProperties}
                  onPointerDown={(e) => { e.preventDefault(); tap(i); }}
                  disabled={phase !== 'input'}
                  aria-label={'Pad ' + (i + 1)}
                />
              ))}
            </div>

            {phase === 'over' && result && (
              <div className={styles.result} role="status">
                <strong>{result.score} points · level {result.level}</strong>
                {result.saved && result.rank ? <span>Your best this round: {result.best} · rank #{result.rank} in {MODE_LABEL[mode]}</span> : null}
                {result.saved && !result.rank ? <span>Clear at least one round to get on the leaderboard.</span> : null}
                {!result.saved && !result.error && <span>Practice game. <button type="button" className={styles.linkBtn} onClick={() => setShowAuth(true)}>Log in</button> to save scores and compete.</span>}
                {result.error && <span className={styles.err}>Score not saved: {result.error}</span>}
              </div>
            )}
            {startError && <p className={styles.err}>{startError}</p>}

            <div className={styles.controls}>
              <button type="button" className={styles.playBtn} onClick={start} disabled={playing}>
                {phase === 'over' ? 'Play again' : playing ? 'Playing…' : 'Play'}
              </button>
              <button type="button" className={styles.ghostBtn} onClick={() => setMuted((v) => !v)} aria-pressed={muted}>{muted ? 'Sound off' : 'Sound on'}</button>
            </div>
            <p className={styles.help}>+10 for every correct tap, plus 10 × the level for clearing a round. One wrong tap ends the game. Keyboard: keys 1–9 and 0.</p>
          </section>

          <aside className={styles.boardPanel} aria-label="Leaderboard">
            <div className={styles.boardHead}>
              <h2>Top 10 · {MODE_LABEL[mode]}</h2>
              {board && (
                <div className={styles.periods}>
                  <button type="button" className={isCurrent ? styles.periodOn : styles.period} onClick={() => setBoardPeriod(null)}>This round</button>
                  {board.previousPeriod && <button type="button" className={!isCurrent ? styles.periodOn : styles.period} onClick={() => setBoardPeriod(board.previousPeriod)}>Last round</button>}
                </div>
              )}
            </div>
            {board?.start && <p className={styles.periodName}>{dayName(board.start, false)} – {dayName(board.end)}{isCurrent ? ' · ends midnight ' + dayName(board.end, false) : ' · final results'}</p>}
            <p className={styles.prizeLine}>{isCurrent ? '#1 when the round ends wins' : '#1 won'} <strong>₹{PRIZE[mode]}</strong></p>
            {boardError && <p className={styles.err}>{boardError}</p>}
            {board && board.top.length === 0 && <p className={styles.empty}>No scores yet. The first player to clear a round takes #1.</p>}
            {board && board.top.length > 0 && (
              <ol className={styles.rows}>
                {board.top.map((r) => (
                  <li key={r.rank} className={`${styles.row} ${player && r.gameName === player.gameName ? styles.rowMe : ''}`}>
                    <span className={styles.rank} data-rank={r.rank}>{r.rank}</span>
                    <span className={styles.name}>{r.gameName}</span>
                    <span className={styles.lvl}>L{r.level}</span>
                    <span className={styles.pts}>{r.score}</span>
                  </li>
                ))}
              </ol>
            )}
            {board?.me && !board.top.some((r) => r.rank === board.me!.rank && r.gameName === board.me!.gameName) && (
              <div className={styles.meRow}>Your standing: <strong>#{board.me.rank}</strong> with {board.me.score} points</div>
            )}
            {player && board && !board.me && isCurrent && <p className={styles.empty}>You haven&apos;t scored in {MODE_LABEL[mode]} this round yet.</p>}
            {!player && <p className={styles.empty}>Log in to see your own standing.</p>}
          </aside>
        </div>
        <section className={styles.rules} aria-labelledby="rules-title">
          <h2 id="rules-title">Competition rules</h2>
          <ol>
            <li>Each round the player ranked #1 in each mode wins: <strong>₹{PRIZE.easy}</strong> for Easy, <strong>₹{PRIZE.medium}</strong> for Medium and <strong>₹{PRIZE.hard}</strong> for Hard.</li>
            <li>The first round runs from 18 October to 18 November 2026. Each round closes at midnight (India time) at the end of the 18th, and the next one starts fresh on the 19th.</li>
            <li>Only games played while logged in count. If two players have the same score, the one who reached it first ranks higher.</li>
            <li>We contact winners on the mobile number they registered with and pay by UPI. Please register with your own number.</li>
            <li>One account per person. Accounts that cheat, use bots or share a number may be removed from the leaderboard.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
