// Firebase Cloud Messaging from inside the Worker -- no firebase-admin
// (Node-only), just the two REST APIs it wraps:
//   - FCM HTTP v1 messages:send, for the actual push
//   - Instance ID batchAdd, to subscribe a device token to a topic
// Both take an OAuth2 access token minted from the Firebase service
// account (secret FCM_SERVICE_ACCOUNT = the whole JSON key file for the
// "khabar-darjeeling-app" Firebase project, the one google-services.json
// in the Android app points at). Set it with:
//   npx wrangler secret put FCM_SERVICE_ACCOUNT < service-account.json
//
// Breaking news goes to the topic "breaking" -- one request no matter
// how many phones, so the Workers per-invocation subrequest cap never
// comes into it.

export type FcmEnv = { FCM_SERVICE_ACCOUNT?: string };

interface ServiceAccount { client_email: string; private_key: string; project_id: string }

let cached: { token: string; exp: number; email: string } | null = null;

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Why the secret isn't usable, or null if it is. Never includes any part
// of the key itself -- only safe to return from an endpoint.
export function fcmProblem(env: FcmEnv): string | null {
  const raw = (env.FCM_SERVICE_ACCOUNT || '').replace(/^﻿/, '').trim();
  if (!raw) return 'FCM_SERVICE_ACCOUNT is empty or not set';
  let sa: any;
  try {
    sa = JSON.parse(raw);
  } catch {
    return 'FCM_SERVICE_ACCOUNT is not valid JSON (length ' + raw.length + ', starts with ' + JSON.stringify(raw.slice(0, 2)) + ')';
  }
  const missing = ['type', 'project_id', 'client_email', 'private_key'].filter((k) => !sa?.[k]);
  if (missing.length) return 'FCM_SERVICE_ACCOUNT is missing ' + missing.join(', ') + ' (is it the service-account key file?)';
  return null;
}

function serviceAccount(env: FcmEnv): ServiceAccount | null {
  if (fcmProblem(env)) return null;
  return JSON.parse((env.FCM_SERVICE_ACCOUNT as string).replace(/^﻿/, '').trim());
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.email === sa.client_email && cached.exp - 60 > now) return cached.token;

  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);

  const unsigned = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + unsigned + '.' + b64url(sig),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error('FCM auth failed: ' + res.status + ' ' + JSON.stringify(data));
  cached = { token: data.access_token, exp: now + (data.expires_in || 3600), email: sa.client_email };
  return cached.token;
}

export function fcmConfigured(env: FcmEnv): boolean {
  return !!serviceAccount(env);
}

// Returns null on success, or the error string Instance ID reported
// (e.g. "INVALID_ARGUMENT" for a garbage token).
export async function subscribeToTopic(env: FcmEnv, token: string, topic: string): Promise<string | null> {
  const sa = serviceAccount(env);
  if (!sa) return 'FCM_SERVICE_ACCOUNT not set';
  const res = await fetch('https://iid.googleapis.com/iid/v1:batchAdd', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + (await accessToken(sa)),
      access_token_auth: 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: '/topics/' + topic, registration_tokens: [token] }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) return 'HTTP ' + res.status + ' ' + JSON.stringify(data);
  return data?.results?.[0]?.error || null;
}

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string | null;
}

// target is either { topic } or { token }. Returns the FCM message name.
export async function sendPush(env: FcmEnv, target: { topic: string } | { token: string }, msg: PushMessage): Promise<string> {
  const sa = serviceAccount(env);
  if (!sa) throw new Error('FCM_SERVICE_ACCOUNT not set');
  const res = await fetch('https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + (await accessToken(sa)), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        ...target,
        notification: { title: msg.title, body: msg.body, ...(msg.imageUrl ? { image: msg.imageUrl } : {}) },
        data: msg.data || {},
        android: {
          priority: 'HIGH',
          // channel created by the app (App.js, "breaking"); matches the
          // app's brand red so the small icon is tinted the same.
          notification: { channel_id: 'breaking', color: '#c41e3a' },
        },
      },
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('FCM send failed: ' + res.status + ' ' + JSON.stringify(data));
  return data.name;
}
