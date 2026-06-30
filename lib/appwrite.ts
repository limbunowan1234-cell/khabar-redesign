const endpoint = 'https://api.khabardarjeeling.space/v1';
const projectId = 'khabardarjeeling';
const dbId = 'Khabar_db';

const H = { 'X-Appwrite-Project': projectId };
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };

export async function getArticles() {
  const res = await fetch(`${endpoint}/databases/${dbId}/collections/articles/documents`, { headers: H, credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

export async function getArticle(id: string) {
  const res = await fetch(`${endpoint}/databases/${dbId}/collections/articles/documents/${id}`, { headers: H, credentials: 'include' });
  if (!res.ok) return null;
  return res.json();
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

export async function getArticleComments(articleId: string) {
  const res = await fetch(`${endpoint}/databases/${dbId}/collections/comments/documents`, { headers: H, credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents.filter((c: any) => c.articleId === articleId) || [];
}

export async function postComment(articleId: string, userId: string, commentText: string, authorName: string, avatarUrl: string) {
  const res = await fetch(`${endpoint}/databases/${dbId}/collections/comments/documents`, {
    method: 'POST', headers: HJ, credentials: 'include',
    body: JSON.stringify({ documentId: 'unique()', data: { articleId, userId, commentText, authorName, avatarUrl: avatarUrl || '', createdAt: new Date().toISOString(), parentCommentId: null } })
  });
  if (!res.ok) throw new Error('Comment failed');
  return res.json();
}

export async function getArticleLikes(articleId: string) {
  const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [articleId] }));
  const q2 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'commentId', values: [null] }));
  const q3 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [1000] }));
  const res = await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents?queries[]=${q1}&queries[]=${q2}&queries[]=${q3}`, { headers: H, credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

export async function toggleArticleLike(articleId: string, userId: string) {
  const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [articleId] }));
  const q2 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] }));
  const listRes = await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents?queries[]=${q1}&queries[]=${q2}`, { headers: H, credentials: 'include' });
  if (!listRes.ok) return false;
  const { documents } = await listRes.json();
  const existing = documents.find((l: any) => !l.commentId);
  if (existing) {
    await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents/${existing.$id}`, { method: 'DELETE', headers: H, credentials: 'include' });
    return false;
  } else {
    await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents`, {
      method: 'POST', headers: HJ, credentials: 'include',
      body: JSON.stringify({ documentId: 'unique()', data: { articleId, userId, commentId: null } })
    });
    return true;
  }
}

export async function getUserBookmarks(userId: string) {
  const res = await fetch(`${endpoint}/databases/${dbId}/collections/bookmarks/documents`, { headers: H, credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents.filter((b: any) => b.userId === userId) || [];
}

export async function toggleBookmark(articleId: string, userId: string) {
  const listRes = await fetch(`${endpoint}/databases/${dbId}/collections/bookmarks/documents`, { headers: H, credentials: 'include' });
  if (!listRes.ok) return false;
  const { documents } = await listRes.json();
  const existing = documents.find((b: any) => b.articleId === articleId && b.userId === userId);
  if (existing) {
    await fetch(`${endpoint}/databases/${dbId}/collections/bookmarks/documents/${existing.$id}`, { method: 'DELETE', headers: H, credentials: 'include' });
    return false;
  } else {
    await fetch(`${endpoint}/databases/${dbId}/collections/bookmarks/documents`, {
      method: 'POST', headers: HJ, credentials: 'include',
      body: JSON.stringify({ documentId: 'unique()', data: { articleId, userId, savedAt: new Date().toISOString() } })
    });
    return true;
  }
}

export async function toggleFollow(followerId: string, followingId: string, followingName: string, followerName: string) {
  const listRes = await fetch(`${endpoint}/databases/${dbId}/collections/follows/documents`, { headers: H, credentials: 'include' });
  if (!listRes.ok) return false;
  const { documents } = await listRes.json();
  const existing = documents.find((f: any) => f.followerId === followerId && f.followingId === followingId);
  if (existing) {
    await fetch(`${endpoint}/databases/${dbId}/collections/follows/documents/${existing.$id}`, { method: 'DELETE', headers: H, credentials: 'include' });
    return false;
  } else {
    await fetch(`${endpoint}/databases/${dbId}/collections/follows/documents`, {
      method: 'POST', headers: HJ, credentials: 'include',
      body: JSON.stringify({ documentId: 'unique()', data: { followerId, followingId, followerName, followingName, createdAt: new Date().toISOString() } })
    });
    return true;
  }
}

export async function getUserFollows(userId: string) {
  const res = await fetch(`${endpoint}/databases/${dbId}/collections/follows/documents`, { headers: H, credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents.filter((f: any) => f.followingId === userId) || [];
}

export async function checkIfFollowing(followerId: string, followingId: string) {
  const res = await fetch(`${endpoint}/databases/${dbId}/collections/follows/documents`, { headers: H, credentials: 'include' });
  if (!res.ok) return false;
  const data = await res.json();
  return data.documents.some((f: any) => f.followerId === followerId && f.followingId === followingId);
}

export async function getCommentLikes(commentId: string) {
  const res = await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents`, { headers: H, credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents.filter((l: any) => l.commentId === commentId) || [];
}

export async function toggleCommentLike(commentId: string, userId: string, articleId: string) {
  const listRes = await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents`, { headers: H, credentials: 'include' });
  if (!listRes.ok) return false;
  const { documents } = await listRes.json();
  const existing = documents.find((l: any) => l.commentId === commentId && l.userId === userId);
  if (existing) {
    await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents/${existing.$id}`, { method: 'DELETE', headers: H, credentials: 'include' });
    return false;
  } else {
    await fetch(`${endpoint}/databases/${dbId}/collections/likes/documents`, {
      method: 'POST', headers: HJ, credentials: 'include',
      body: JSON.stringify({ documentId: 'unique()', data: { articleId, commentId, userId } })
    });
    return true;
  }
}
