'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import s from '../Appeal.module.css';

// Public "Submit information" form. Sends to the Worker, which checks the
// Turnstile token, rate-limits, and files it as a New lead for the case team.
// Nothing here is ever published.

declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void } }
}

export default function AppealForm({ caseCode, apiBase, siteKey }: { caseCode: string; apiBase: string; siteKey: string }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<{ sending?: boolean; error?: string; reference?: string }>({});

  useEffect(() => {
    if (!ready || !box.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(box.current, { sitekey: siteKey, theme: 'light' });
  }, [ready, siteKey]);

  if (!siteKey) {
    return <p className={s.formMsg}>The form is not available right now. Please message the Khabar Darjeeling page or email contact@khabardarjeeling.in.</p>;
  }
  if (state.reference) {
    return (
      <div className={s.thanks} role="status">
        <h3>Thank you. Your information has reached our team.</h3>
        <p>Your reference is <b>{state.reference}</b>. A member of the Khabar Darjeeling team may contact you to follow it up. Please keep this page link if you want to send more.</p>
      </div>
    );
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState({ sending: true });
    try {
      const res = await fetch(`${apiBase}/reunion/public/${encodeURIComponent(caseCode)}/leads`, { method: 'POST', body: new FormData(e.currentTarget) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
      setState({ reference: json.reference });
    } catch (err: any) {
      setState({ error: err.message });
      if (widget.current) window.turnstile?.reset(widget.current);
    }
  };

  return (
    <form className={s.form} onSubmit={submit}>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div className={s.row}>
        <label className={s.field}><span>Your name *</span><input name="name" required maxLength={200} autoComplete="name" /></label>
        <label className={s.field}><span>Contact number *</span><input name="phone" required maxLength={40} inputMode="tel" autoComplete="tel" /></label>
      </div>
      <label className={s.field}><span>Email (optional)</span><input name="email" type="email" maxLength={200} autoComplete="email" /></label>
      <label className={s.field}><span>What do you know about the family? *</span><textarea name="information" required minLength={20} maxLength={5000} rows={5} /></label>
      <label className={s.field}><span>How do you recognise this case?</span><textarea name="recognition" maxLength={2000} rows={3} placeholder="e.g. I grew up near the station and knew a family with this name" /></label>
      <label className={s.field}><span>Photo or document (optional)</span><input name="file" type="file" accept="image/*,application/pdf" /><small>A photo or PDF, up to 10 MB. It is seen only by our team.</small></label>
      {/* Honeypot: hidden from people, filled in by bots. */}
      <div className={s.hp} aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className={s.consent}>
        <input type="checkbox" name="consent" value="yes" required />
        <span>I agree that Khabar Darjeeling may store this information privately for this appeal and contact me about it. I understand my name and contact details will not be published.</span>
      </label>
      <div ref={box} className={s.turnstile} />
      {state.error && <p className={s.formErr} role="alert">{state.error}</p>}
      <button type="submit" className={s.ctaMain} disabled={state.sending}>{state.sending ? 'Sending…' : 'Send to Khabar Darjeeling'}</button>
    </form>
  );
}
