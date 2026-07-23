'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT };
const HJ = { 'X-Appwrite-Project': PROJECT, 'Content-Type': 'application/json' };

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  return days + 'd ago';
}

export default function NotificationBell({ light = true }: { light?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushStatus, setPushStatus] = useState<'idle' | 'checking' | 'granted' | 'denied' | 'unsupported'>('idle');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.$id) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [user?.$id]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'idle');
    } else {
      setPushStatus('unsupported');
    }
  }, []);

  async function fetchUnread() {
    if (!user?.$id) return;
    try {
      const q = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [user.$id] })) +
        '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'read', values: [false] })) +
        '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] }));
      const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/notifications/documents?queries[]=' + q, { headers: H, credentials: 'include' });
      if (res.ok) { const d = await res.json(); setUnreadCount(d.total || 0); }
    } catch {}
  }

  async function loadList() {
    if (!user?.$id) return;
    try {
      const q = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [user.$id] })) +
        '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: 'createdAt' })) +
        '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [15] }));
      const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/notifications/documents?queries[]=' + q, { headers: H, credentials: 'include' });
      if (res.ok) { const d = await res.json(); setNotifications(d.documents || []); }
    } catch {}
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) loadList();
  }

  async function markRead(n: any) {
    if (n.read) return;
    try {
      await fetch(ENDPOINT + '/databases/' + DB + '/collections/notifications/documents/' + n.$id, {
        method: 'PATCH', headers: HJ, credentials: 'include',
        body: JSON.stringify({ data: { read: true } })
      });
      setNotifications((prev) => prev.map((x) => x.$id === n.$id ? { ...x, read: true } : x));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }

  async function markAllRead() {
    try {
      await Promise.all(notifications.filter((n) => !n.read).map((n) =>
        fetch(ENDPOINT + '/databases/' + DB + '/collections/notifications/documents/' + n.$id, {
          method: 'PATCH', headers: HJ, credentials: 'include',
          body: JSON.stringify({ data: { read: true } })
        })
      ));
      setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnreadCount(0);
    } catch {}
  }

  async function enablePush() {
    if (!user?.$id) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    setPushStatus('checking');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setPushStatus('denied'); return; }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const existingSub = await registration.pushManager.getSubscription();
      const sub = existingSub || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '')
      });
      const subJson: any = sub.toJSON();

      await fetch(ENDPOINT + '/databases/' + DB + '/collections/push_subscriptions/documents', {
        method: 'POST', headers: HJ, credentials: 'include',
        body: JSON.stringify({
          documentId: 'unique()',
          data: { userId: user.$id, endpoint: subJson.endpoint, p256dh: subJson.keys.p256dh, auth: subJson.keys.auth, createdAt: new Date().toISOString() }
        })
      });
      setPushStatus('granted');
    } catch (err) {
      console.error('Push enable failed:', err);
      setPushStatus('idle');
    }
  }

  if (!user?.$id) return null;

  const iconColor = light ? 'white' : '#1a1a1a';
  const bgHover = light ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)';

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button onClick={toggleOpen} style={{ position: 'relative', background: bgHover, border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: '-2px', right: '-2px', backgroundColor: '#f5c518', color: '#1a1a1a', fontSize: '10px', fontWeight: 800, borderRadius: '10px', minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '2px solid ' + (light ? '#c41e3a' : '#fff') }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '44px', right: 0, width: '320px', maxHeight: '420px', overflowY: 'auto', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', zIndex: 1000 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontWeight: 800, fontSize: '14px', color: '#1a1a1a' }}>Notifications</span>
            {unreadCount > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#c41e3a', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Mark all read</button>}
          </div>

          {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
            <div style={{ padding: '10px 16px', backgroundColor: '#fff8e1', borderBottom: '1px solid #f0f0f0' }}>
              <button onClick={enablePush} disabled={pushStatus === 'checking'} style={{ width: '100%', background: '#c41e3a', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                {pushStatus === 'checking' ? 'Enabling...' : 'Enable Push Notifications'}
              </button>
            </div>
          )}

          {notifications.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: '#999', fontSize: '13px' }}>No notifications yet</div>
          ) : (
            notifications.map((n) => (
              <Link key={n.$id} href={n.articleSlug ? '/article/' + n.articleSlug : '#'} onClick={() => markRead(n)} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f7f7f7', backgroundColor: n.read ? 'white' : '#fff5f5', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  {!n.read && <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#c41e3a', marginTop: '5px', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#1a1a1a', lineHeight: 1.4 }}>{n.message}</p>
                    <span style={{ fontSize: '11px', color: '#999' }}>{timeAgo(n.createdAt)}</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
