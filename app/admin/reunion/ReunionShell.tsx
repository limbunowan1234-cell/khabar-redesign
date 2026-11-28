'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser } from '@/lib/appwrite';
import { isAdminUser, isReunionUser } from '@/lib/reunion';
import s from './Reunion.module.css';

export interface ReunionViewer { $id: string; name: string; email: string; labels: string[]; isAdmin: boolean }

// Frame and access gate for every Family Reunion page. The gate only decides
// what to render: the Worker refuses the data itself to anyone else.
export default function ReunionShell({ children }: { children: (viewer: ReunionViewer) => ReactNode }) {
  const [viewer, setViewer] = useState<ReunionViewer | null>(null);
  const [state, setState] = useState<'loading' | 'out' | 'denied' | 'ok'>('loading');

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) return setState('out');
      if (!isReunionUser(u)) return setState('denied');
      setViewer({ $id: u.$id, name: u.name, email: u.email, labels: u.labels || [], isAdmin: isAdminUser(u) });
      setState('ok');
    })();
  }, []);

  return (
    <div className={s.shell}>
      <header className={s.top}>
        <div className={s.topIn}>
          <Link href="/admin/reunion" className={s.brand}>
            <img src="/assets/logo.png" alt="" />
            <span><small>Newsroom</small><b>Family Reunion Cases</b></span>
          </Link>
          <nav className={s.topLinks} aria-label="Admin">
            <Link href="/admin/reunion">All cases</Link>
            <Link href="/admin">Admin panel</Link>
            <Link href="/">Site</Link>
          </nav>
        </div>
      </header>
      {state === 'loading' && <p className={s.gate}>Loading…</p>}
      {state === 'out' && (
        <div className={s.gate}>
          <h1 className={s.h1}>Please log in</h1>
          <p className={s.sub}>Family Reunion cases are for the Khabar Darjeeling case team.</p>
          <p><Link className={`${s.btn} ${s.btnRed}`} href="/">Go to the site to log in</Link></p>
        </div>
      )}
      {state === 'denied' && (
        <div className={s.gate}>
          <h1 className={s.h1}>No access</h1>
          <p className={s.sub}>This section is only for admins and the Family Reunion case team. Ask an admin to add the &ldquo;reunion&rdquo; role to your account, then log out and back in.</p>
        </div>
      )}
      {state === 'ok' && viewer && children(viewer)}
    </div>
  );
}
