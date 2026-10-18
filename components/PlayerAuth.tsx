'use client';

import { useState } from 'react';
import { playerFetch, savePlayerSession, type PlayerProfile, errorMessage } from '@/lib/player';

// Sign up / log in with an in-game name, phone number and 4-digit PIN.
// Shared by the Simon Speed web game and app reviews.
export default function PlayerAuth({ onDone, intro }: { onDone?: (player: PlayerProfile) => void; intro?: string }) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [gameName, setGameName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'register' && gameName.trim().length < 3) return setError('Game name must be at least 3 characters.');
    if (phone.replace(/\D/g, '').length < 10) return setError('Enter your 10-digit mobile number.');
    if (!/^\d{4}$/.test(pin)) return setError('PIN must be exactly 4 digits.');
    setBusy(true);
    try {
      const session = await playerFetch<{ token: string; player: PlayerProfile }>(
        mode === 'register' ? '/players/register' : '/players/login',
        { method: 'POST', body: mode === 'register' ? { gameName, phone, pin } : { phone, pin } }
      );
      savePlayerSession(session);
      onDone?.(session.player);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '16px', borderRadius: '12px', border: '1.5px solid var(--pa-line, #d6d8de)', background: 'var(--pa-input, #fff)', color: 'inherit' };
  const label: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 700, margin: '0 0 6px' };

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: '14px' }}>
      <div role="tablist" aria-label="Account" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '4px', borderRadius: '12px', background: 'var(--pa-chip, #eceef2)' }}>
        {(['register', 'login'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => { setMode(m); setError(''); }}
            style={{ padding: '10px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px', background: mode === m ? 'var(--pa-card, #fff)' : 'transparent', color: 'inherit', boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.12)' : 'none' }}
          >
            {m === 'register' ? 'New player' : 'I have an account'}
          </button>
        ))}
      </div>

      {intro && <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, opacity: 0.8 }}>{intro}</p>}

      {mode === 'register' && (
        <div>
          <label htmlFor="pa-name" style={label}>In-game name</label>
          <input id="pa-name" value={gameName} onChange={(e) => setGameName(e.target.value)} maxLength={20} autoComplete="nickname" placeholder="Shown on the leaderboard" style={field} />
        </div>
      )}
      <div>
        <label htmlFor="pa-phone" style={label}>Mobile number</label>
        <input id="pa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="98765 43210" style={field} />
      </div>
      <div>
        <label htmlFor="pa-pin" style={label}>{mode === 'register' ? 'Choose a 4-digit PIN' : '4-digit PIN'}</label>
        <input id="pa-pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} type="password" placeholder="••••" style={{ ...field, letterSpacing: '0.4em' }} />
      </div>

      {error && <p role="alert" style={{ margin: 0, padding: '10px 12px', borderRadius: '10px', background: '#fde8ec', color: '#9b1530', fontSize: '14px' }}>{error}</p>}

      <button type="submit" disabled={busy} style={{ padding: '13px', borderRadius: '12px', border: 'none', cursor: busy ? 'wait' : 'pointer', fontWeight: 800, fontSize: '15px', background: '#c41e3a', color: '#fff', opacity: busy ? 0.7 : 1 }}>
        {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Log in'}
      </button>
      <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, opacity: 0.7 }}>
        Your number is private. Only your in-game name is shown publicly. We use your number only to contact prize winners.
      </p>
    </form>
  );
}
