// Week 10+25+26+[auth migration] of the Cloudflare migration (see
// cloudflare/README.md): likes (Week 25) and bookmarks (Week 26) read AND
// write through the Worker, both fully cut over. Auth is on the Worker
// now too -- Appwrite Cloud's Storage quota was exceeded, which put the
// whole project (including auth) behind a blanket billing_limit_exceeded
// 402, and the site owner isn't paying to fix a Storage problem on a
// migration that was already complete everywhere else. See
// cloudflare/src/routes/auth.ts for the server side of every function
// below that used to call Appwrite's REST API directly.
//
// api.khabardarjeeling.in is the same domain Appwrite's own custom-domain
// integration used to own -- repointed at this Worker instead (see
// cloudflare/wrangler.toml's [[routes]] custom_domain entry), so the
// session cookie keeps the exact host scope it always had; nothing about
// how these functions are called (credentials: 'include', same relative
// paths under /v1... replaced with /auth/...) needed to change shape.
const endpoint = 'https://api.khabardarjeeling.in';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

const HJ = { 'Content-Type': 'application/json' };

// Mints a short-lived (15 min) access JWT for the currently logged-in
// session, for handing to the Cloudflare Worker so it can verify identity
// locally -- the Worker's own /auth/token endpoint reads the HttpOnly
// refresh-session cookie (never exposed to JS) and signs a fresh bearer
// token from it. See cloudflare/src/lib/jwt.ts for the verification side.
export async function getWorkerAuthToken(): Promise<string | null> {
  try {
    const res = await fetch(`${endpoint}/auth/token`, { method: 'POST', credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.jwt || null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  try {
    const res = await fetch(`${endpoint}/auth/me`, { credentials: 'include' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function signup(email: string, password: string, name: string, homeDistrict?: string) {
  const res = await fetch(`${endpoint}/auth/signup`, {
    method: 'POST', headers: HJ, credentials: 'include',
    body: JSON.stringify({ email, password, name, homeDistrict }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Signup failed');
  }
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await fetch(`${endpoint}/auth/login`, {
    method: 'POST', headers: HJ, credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Login failed');
  }
  return res.json();
}

export async function logout() {
  await fetch(`${endpoint}/auth/logout`, { method: 'POST', credentials: 'include' });
}

// Always resolves, never throws -- the Worker's own endpoint is
// deliberately non-enumerating (always 200, real email or not), matching
// Appwrite's own /account/recovery behavior.
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await fetch(`${endpoint}/auth/request-password-reset`, {
      method: 'POST', headers: HJ, body: JSON.stringify({ email }),
    });
  } catch {}
}

export async function completePasswordReset(token: string, password: string) {
  const res = await fetch(`${endpoint}/auth/reset-password`, {
    method: 'POST', headers: HJ, body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Password reset failed');
  }
  return res.json();
}

export async function getArticleLikes(articleId: string) {
  const res = await fetch(`${WORKER_URL}/likes?articleId=${encodeURIComponent(articleId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

// Week 25 of the Cloudflare migration (see cloudflare/README.md): likes
// write directly to D1 now -- Appwrite's likes collection is frozen as
// of this cutover, no longer written to. Every toggle needs a JWT since
// D1 is the real write target now, not a shadow.
export async function toggleArticleLike(articleId: string, userId: string) {
  const token = await getWorkerAuthToken();
  if (!token) throw new Error('Not authenticated');
  const headers = { Authorization: 'Bearer ' + token };

  // /likes?articleId= already scopes to comment_id IS NULL server-side
  // (see cloudflare/src/routes/likes.ts), so documents[0] is enough --
  // no client-side filter needed.
  const checkRes = await fetch(`${WORKER_URL}/likes?articleId=${encodeURIComponent(articleId)}&userId=${encodeURIComponent(userId)}`);
  const { documents } = checkRes.ok ? await checkRes.json() : { documents: [] };
  const existing = (documents || [])[0];

  if (existing) {
    await fetch(`${WORKER_URL}/likes?${new URLSearchParams({ articleId, userId })}`, { method: 'DELETE', headers });
    return false;
  } else {
    await fetch(`${WORKER_URL}/likes`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, userId }),
    });
    return true;
  }
}

export async function getUserBookmarks(userId: string) {
  const res = await fetch(`${WORKER_URL}/bookmarks?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

// Week 26: same cutover as likes (Week 25) -- bookmarks write to D1
// directly now. Appwrite's bookmarks collection is frozen as of this
// cutover.
export async function toggleBookmark(articleId: string, userId: string) {
  const token = await getWorkerAuthToken();
  if (!token) throw new Error('Not authenticated');
  const headers = { Authorization: 'Bearer ' + token };

  const checkRes = await fetch(`${WORKER_URL}/bookmarks?userId=${encodeURIComponent(userId)}&articleId=${encodeURIComponent(articleId)}`);
  const { documents } = checkRes.ok ? await checkRes.json() : { documents: [] };
  const existing = (documents || [])[0];

  if (existing) {
    await fetch(`${WORKER_URL}/bookmarks?${new URLSearchParams({ userId, articleId })}`, { method: 'DELETE', headers });
    return false;
  } else {
    await fetch(`${WORKER_URL}/bookmarks`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, articleId }),
    });
    return true;
  }
}

export async function getCommentLikes(commentId: string) {
  const res = await fetch(`${WORKER_URL}/likes?commentId=${encodeURIComponent(commentId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

// Week 25: same cutover as toggleArticleLike -- writes to D1 directly.
export async function toggleCommentLike(commentId: string, userId: string, articleId: string) {
  const token = await getWorkerAuthToken();
  if (!token) throw new Error('Not authenticated');
  const headers = { Authorization: 'Bearer ' + token };

  const checkRes = await fetch(`${WORKER_URL}/likes?commentId=${encodeURIComponent(commentId)}&userId=${encodeURIComponent(userId)}`);
  const { documents } = checkRes.ok ? await checkRes.json() : { documents: [] };
  const existing = (documents || [])[0];
  if (existing) {
    await fetch(`${WORKER_URL}/likes?${new URLSearchParams({ articleId, userId, commentId })}`, { method: 'DELETE', headers });
    return false;
  } else {
    await fetch(`${WORKER_URL}/likes`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, commentId, userId }),
    });
    return true;
  }
}

// Moved off Appwrite's Database REST API (a read-then-increment against a
// single document there) onto the Worker's generic app_counters table --
// that API went dark along with everything else on the project, and this
// was the one remaining call in this file still hitting it directly.
export async function trackApkDownload() {
  try {
    await fetch(`${WORKER_URL}/counters/apk_downloads/increment`, { method: 'POST' });
  } catch {}
}
