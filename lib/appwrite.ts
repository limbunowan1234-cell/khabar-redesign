const endpoint = 'https://api.khabardarjeeling.in/v1';
const projectId = 'khabardarjeeling';
const dbId = 'Khabar_db';

const H = { 'X-Appwrite-Project': projectId };
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };
// Week 10 of the Cloudflare migration (see cloudflare/README.md): the
// read-only helpers below (likes, bookmarks) come from the Worker now.
// Writes and auth stay on Appwrite.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

// Mints a short-lived (15 min) Appwrite JWT for the currently logged-in
// session, for handing to the Cloudflare Worker so it can verify identity
// server-to-server -- the Worker's own domain never sees the actual
// Appwrite session cookie (HttpOnly, scoped to this domain only). See
// cloudflare/src/lib/auth.ts for the verification side.
export async function getWorkerAuthToken(): Promise<string | null> {
  try {
    const res = await fetch(`${endpoint}/account/jwts`, { method: 'POST', headers: H, credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.jwt || null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  try {
    const res = await fetch(`${endpoint}/account`, { headers: H, credentials: 'include' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function signup(email: string, password: string, name: string) {
  const res = await fetch(`${endpoint}/account`, {
    method: 'POST', headers: HJ, credentials: 'include',
    body: JSON.stringify({ userId: 'unique()', email, password, name })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Signup failed');
  }
  const user = await res.json();
  const session = await fetch(`${endpoint}/account/sessions/email`, {
    method: 'POST', headers: HJ, credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  if (!session.ok) {
    const err = await session.json();
    throw new Error(err.message || 'Session failed');
  }
  return user;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${endpoint}/account/sessions/email`, {
    method: 'POST', headers: HJ, credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Login failed');
  }
  return res.json();
}

export async function logout() {
  await fetch(`${endpoint}/account/sessions/current`, { method: 'DELETE', headers: H, credentials: 'include' });
}

export async function getArticleLikes(articleId: string) {
  const res = await fetch(`${WORKER_URL}/likes?articleId=${encodeURIComponent(articleId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

// Shadow-writes the same like/unlike outcome into D1, alongside the real
// Appwrite write above (which stays authoritative). Fire-and-forget: a
// D1 failure here must never surface to the user or block their like --
// this exists purely so the two can be diffed before anything actually
// depends on D1 for likes. See cloudflare/README.md.
async function shadowWriteLike(articleId: string, commentId: string | null, userId: string, created: boolean) {
  try {
    const token = await getWorkerAuthToken();
    if (!token) return;
    const headers = { Authorization: 'Bearer ' + token };
    if (created) {
      await fetch(`${WORKER_URL}/likes`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, commentId, userId }),
      });
    } else {
      const params = new URLSearchParams({ articleId, userId });
      if (commentId) params.set('commentId', commentId);
      await fetch(`${WORKER_URL}/likes?${params}`, { method: 'DELETE', headers });
    }
  } catch {}
}

export async function toggleArticleLike(articleId: string, userId: string) {
  const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [articleId] }));
  const q2 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] }));
  const listRes = await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents?queries[]=${q1}&queries[]=${q2}`, { headers: H, credentials: 'include' });
  if (!listRes.ok) return false;
  const { documents } = await listRes.json();
  const existing = (documents || []).find((l: any) => !l.commentId);
  if (existing) {
    await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents/${existing.$id}`, { method: 'DELETE', headers: H, credentials: 'include' });
    shadowWriteLike(articleId, null, userId, false);
    return false;
  } else {
    await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents`, {
      method: 'POST', headers: HJ, credentials: 'include',
      body: JSON.stringify({ documentId: 'unique()', data: { articleId, userId, commentId: null } })
    });
    shadowWriteLike(articleId, null, userId, true);
    return true;
  }
}

export async function getUserBookmarks(userId: string) {
  const res = await fetch(`${WORKER_URL}/bookmarks?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

// Shadow-writes the same bookmark/unbookmark outcome into D1, same
// fire-and-forget pattern as shadowWriteLike -- see its comment above.
async function shadowWriteBookmark(articleId: string, userId: string, created: boolean) {
  try {
    const token = await getWorkerAuthToken();
    if (!token) return;
    const headers = { Authorization: 'Bearer ' + token };
    if (created) {
      await fetch(`${WORKER_URL}/bookmarks`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, articleId }),
      });
    } else {
      await fetch(`${WORKER_URL}/bookmarks?${new URLSearchParams({ userId, articleId })}`, { method: 'DELETE', headers });
    }
  } catch {}
}

export async function toggleBookmark(articleId: string, userId: string) {
  const listRes = await fetch(`${endpoint}/databases/${dbId}/collections/bookmarks/documents`, { headers: H, credentials: 'include' });
  if (!listRes.ok) return false;
  const { documents } = await listRes.json();
  const existing = documents.find((b: any) => b.articleId === articleId && b.userId === userId);
  if (existing) {
    await fetch(`${endpoint}/databases/${dbId}/collections/bookmarks/documents/${existing.$id}`, { method: 'DELETE', headers: H, credentials: 'include' });
    shadowWriteBookmark(articleId, userId, false);
    return false;
  } else {
    await fetch(`${endpoint}/databases/${dbId}/collections/bookmarks/documents`, {
      method: 'POST', headers: HJ, credentials: 'include',
      body: JSON.stringify({ documentId: 'unique()', data: { articleId, userId, savedAt: new Date().toISOString() } })
    });
    shadowWriteBookmark(articleId, userId, true);
    return true;
  }
}

export async function getCommentLikes(commentId: string) {
  const res = await fetch(`${WORKER_URL}/likes?commentId=${encodeURIComponent(commentId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

export async function toggleCommentLike(commentId: string, userId: string, articleId: string) {
  const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'commentId', values: [commentId] }));
  const q2 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] }));
  const listRes = await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents?queries[]=${q1}&queries[]=${q2}`, { headers: H, credentials: 'include' });
  if (!listRes.ok) return false;
  const { documents } = await listRes.json();
  const existing = (documents || [])[0];
  if (existing) {
    await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents/${existing.$id}`, { method: 'DELETE', headers: H, credentials: 'include' });
    shadowWriteLike(articleId, commentId, userId, false);
    return false;
  } else {
    await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents`, {
      method: 'POST', headers: HJ, credentials: 'include',
      body: JSON.stringify({ documentId: 'unique()', data: { articleId, commentId, userId } })
    });
    shadowWriteLike(articleId, commentId, userId, true);
    return true;
  }
}


export async function trackApkDownload() {
  try {
    const res = await fetch(endpoint + '/databases/' + dbId + '/collections/analytics/documents/apk_downloads', { headers: H, credentials: 'include' });
    let current = 0;
    if (res.ok) { const d = await res.json(); current = d.count || 0; }
    await fetch(endpoint + '/databases/' + dbId + '/collections/analytics/documents/apk_downloads', {
      method: 'PATCH', headers: HJ, credentials: 'include',
      body: JSON.stringify({ data: { count: current + 1 } })
    });
  } catch {}
}
