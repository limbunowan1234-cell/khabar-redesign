// Lightweight anonymous visitor tracking. Most readers aren't logged in, so
// MAU/DAU/session-time are computed from a persistent per-browser visitor id
// rather than the Appwrite userId (which would only capture authenticated
// users and badly undercount real traffic).

const VISITOR_ID_KEY = 'kd_visitor_id';

export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)));
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

export function trackPageView(articleId: string, userId?: string | null) {
  const visitorId = getVisitorId();
  if (!visitorId) return;
  try {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, userId: userId || null, eventType: 'view', articleId }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
