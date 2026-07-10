import webpush from 'web-push';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT, 'Content-Type': 'application/json' };

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:nowanad@gmail.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, type, message, articleId, articleSlug, fromUserName, title, url } = body;

    if (!userId || !message) {
      return Response.json({ error: 'userId and message required' }, { status: 400 });
    }

    // 1. Write to notifications collection (in-app / profile view)
    await fetch(ENDPOINT + '/databases/' + DB + '/collections/notifications/documents', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        documentId: 'unique()',
        data: {
          userId,
          type: type || 'general',
          message,
          articleId: articleId || null,
          articleSlug: articleSlug || null,
          fromUserName: fromUserName || null,
          read: false,
          createdAt: new Date().toISOString()
        },
        permissions: [
          'read("user:' + userId + '")',
          'update("user:' + userId + '")',
          'delete("user:' + userId + '")'
        ]
      })
    });

    // 2. Look up push subscriptions for this user
    const q = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] }));
    const subsRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/push_subscriptions/documents?queries[]=' + q, { headers: H });
    const subsData = await subsRes.json();
    const subs = subsData.documents || [];

    // 3. Send push to each subscription
    const results = await Promise.allSettled(
      subs.map((sub: any) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify({
            title: title || 'Khabar Darjeeling',
            body: message,
            url: url || (articleSlug ? '/article/' + articleSlug : '/')
          })
        ).catch(async (err: any) => {
          // If subscription is expired/invalid (410/404), delete it
          if (err.statusCode === 410 || err.statusCode === 404) {
            await fetch(ENDPOINT + '/databases/' + DB + '/collections/push_subscriptions/documents/' + sub.$id, {
              method: 'DELETE',
              headers: H
            });
          }
          throw err;
        })
      )
    );

    return Response.json({ success: true, notified: subs.length, results: results.map(r => r.status) });
  } catch (err: any) {
    console.error('send-notification error:', err);
    return Response.json({ error: err.message || 'Failed to send notification' }, { status: 500 });
  }
}
