import webpush from 'web-push';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': process.env.APPWRITE_API_KEY || '', 'Content-Type': 'application/json' };

function getFirebaseMessaging() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    let app;
    if (getApps().length > 0) {
      app = getApps()[0];
    } else {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      app = initializeApp({ credential: cert(serviceAccount) });
    }
    return getMessaging(app);
  } catch (err) {
    console.error('Firebase admin init failed:', err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:nowanad@gmail.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    }
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

    // 2. Look up web push subscriptions for this user (browser)
    const q = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] }));
    const subsRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/push_subscriptions/documents?queries[]=' + q, { headers: H });
    const subsData = await subsRes.json();
    const subs = subsData.documents || [];

    // 3. Send web push to each browser subscription
    const webResults = await Promise.allSettled(
      subs.map((sub: any) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: title || 'Khabar Darjeeling', body: message, url: url || (articleSlug ? '/article/' + articleSlug : '/') })
        ).catch(async (err: any) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await fetch(ENDPOINT + '/databases/' + DB + '/collections/push_subscriptions/documents/' + sub.$id, { method: 'DELETE', headers: H });
          }
          throw err;
        })
      )
    );

    // 4. Look up FCM tokens for this user (Android app)
    let fcmResults: any[] = [];
    const messaging = getFirebaseMessaging();
    if (messaging) {
      const fcmRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/fcm_tokens/documents?queries[]=' + q, { headers: H });
      const fcmData = await fcmRes.json();
      const tokens = fcmData.documents || [];

      fcmResults = await Promise.allSettled(
        tokens.map((t: any) =>
          messaging.send({
            token: t.token,
            notification: { title: title || 'Khabar Darjeeling', body: message },
            data: { url: url || (articleSlug ? '/article/' + articleSlug : '/') }
          }).catch(async (err: any) => {
            if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
              await fetch(ENDPOINT + '/databases/' + DB + '/collections/fcm_tokens/documents/' + t.$id, { method: 'DELETE', headers: H });
            }
            throw err;
          })
        )
      );
    }

    return Response.json({
      success: true,
      webPushNotified: subs.length,
      fcmNotified: fcmResults.length,
      webResults: webResults.map(r => r.status),
      fcmResults: fcmResults.map(r => r.status)
    });
  } catch (err: any) {
    console.error('send-notification error:', err);
    return Response.json({ error: err.message || 'Failed to send notification' }, { status: 500 });
  }
}
