import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { articles } from './routes/articles';
import { cdn } from './routes/cdn';
import { likes } from './routes/likes';
import { comments } from './routes/comments';
import { follows } from './routes/follows';
import { bookmarks } from './routes/bookmarks';
import { profiles } from './routes/profiles';
import { bhasaDiwas } from './routes/bhasaDiwas';
import { contest } from './routes/contest';
import { certificates } from './routes/certificates';
import { notifications } from './routes/notifications';
import { pushSubscriptions } from './routes/pushSubscriptions';
import { photos } from './routes/photos';
import { photography } from './routes/photography';
import { analytics } from './routes/analytics';
import { newsDigest } from './routes/newsDigest';
import { ads } from './routes/ads';

type Bindings = { DB: D1Database; IMAGES: R2Bucket };

// Mirrors components/WeatherWidget.tsx's CITIES and components/
// WeatherWarning.tsx's getSeverity() in the Next.js app -- duplicated
// rather than shared because this Worker and the Next app are separate
// TypeScript projects/bundles with no shared-code path between them.
// Keep these two in sync by hand if the alert thresholds ever change.
const WEATHER_CITIES = [
  { name: 'Darjeeling', lat: 27.041, lon: 88.2663 },
  { name: 'Kalimpong', lat: 27.0710, lon: 88.4700 },
  { name: 'Kurseong', lat: 26.8804, lon: 88.2803 },
  { name: 'Siliguri', lat: 26.7271, lon: 88.3953 },
  { name: 'Mirik', lat: 26.8874, lon: 88.1826 },
];

function weatherSeverity(precip: number, code: number): { level: string; headline: string } | null {
  if (precip >= 20 || code >= 97) {
    return { level: 'RED ALERT', headline: 'Extremely Heavy Rain (' + precip.toFixed(0) + '+ cm) expected' };
  }
  if (precip >= 7 || (code >= 65 && code <= 67) || (code >= 82 && code <= 86)) {
    return { level: 'ORANGE ALERT', headline: 'Heavy to Very Heavy Rain (' + precip.toFixed(0) + ' cm) expected' };
  }
  return null;
}

const app = new Hono<{ Bindings: Bindings }>();

// Everything served here is public read-only data (no auth, no secrets),
// so allowing localhost costs nothing and keeps local dev/testing honest
// against the real Worker instead of a mock.
app.use('*', cors({ origin: ['https://khabardarjeeling.in', 'https://www.khabardarjeeling.in', 'http://localhost:3000'] }));

app.get('/', (c) => c.json({ ok: true, service: 'khabar-worker', phase: 2 }));
app.route('/articles', articles);
app.route('/cdn', cdn);
app.route('/likes', likes);
app.route('/comments', comments);
app.route('/follows', follows);
app.route('/bookmarks', bookmarks);
app.route('/profiles', profiles);
app.route('/bhasa-diwas', bhasaDiwas);
app.route('/contest', contest);
app.route('/certificates', certificates);
app.route('/notifications', notifications);
app.route('/push-subscriptions', pushSubscriptions);
app.route('/photos', photos);
app.route('/photography', photography);
app.route('/analytics', analytics);
app.route('/news-digest', newsDigest);
app.route('/ads', ads);

export default {
  fetch: app.fetch,

  // Two native Cloudflare Cron Triggers (see [triggers] in wrangler.toml),
  // distinguished by event.cron. Neither needs an HTTP auth boundary or a
  // Vercel cron slot (Hobby plan caps those at 2), unlike the
  // Appwrite-era approach both replaced.
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    if (event.cron === '0 */3 * * *') {
      // [weather-alerts feature]: every 3 hours, check today's forecast
      // for each hill town. A RED/ORANGE alert that hasn't already been
      // pushed today (weather_alert_log's UNIQUE constraint makes that
      // check atomic -- see schema.sql) gets pushed to every user whose
      // profile.home_district matches that town, via the existing
      // per-user push pipeline at /api/send-notification on the Next.js
      // app (already handles web-push + FCM + the in-app bell -- this
      // cron is just another caller of it, same as any Next.js route).
      ctx.waitUntil((async () => {
        for (const city of WEATHER_CITIES) {
          try {
            const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon +
              '&daily=weather_code,precipitation_sum,wind_speed_10m_max&timezone=Asia%2FKolkata&forecast_days=1';
            const res = await fetch(url);
            if (!res.ok) continue;
            const data: any = await res.json();
            const precip = data?.daily?.precipitation_sum?.[0] ?? 0;
            const code = data?.daily?.weather_code?.[0] ?? 0;
            const alertDate = data?.daily?.time?.[0];
            const severity = weatherSeverity(precip, code);
            if (!severity || !alertDate) continue;

            const id = crypto.randomUUID();
            const insert = await env.DB
              .prepare('INSERT INTO weather_alert_log (id, city, alert_date, severity) VALUES (?, ?, ?, ?) ON CONFLICT (city, alert_date, severity) DO NOTHING')
              .bind(id, city.name, alertDate, severity.level)
              .run();
            if (insert.meta.changes === 0) continue; // already pushed this exact alert

            const { results: subscribers } = await env.DB
              .prepare('SELECT user_id FROM profiles WHERE home_district = ? LIMIT 500')
              .bind(city.name)
              .all();
            const userIds = (subscribers || []).map((r: any) => r.user_id);

            const CHUNK = 20;
            for (let i = 0; i < userIds.length; i += CHUNK) {
              const chunk = userIds.slice(i, i + CHUNK);
              await Promise.allSettled(
                chunk.map((userId: string) =>
                  fetch('https://khabardarjeeling.in/api/send-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userId,
                      type: 'weather-alert',
                      title: severity.level + ': ' + city.name + ' Hills',
                      message: severity.headline + ' in ' + city.name + ' today -- avoid unnecessary travel in hill areas.',
                      url: '/',
                    }),
                  })
                )
              );
            }
          } catch (err) {
            console.error('weather-alert check failed for', city.name, err);
            // one town's failure (e.g. Open-Meteo hiccup) shouldn't skip the rest
          }
        }
      })());
      return;
    }

    if (event.cron === '0 0 * * SUN') {
      // Week 35: publishes any pending weekly picks (isWeeklyPick=1,
      // weeklyLive=0) every Sunday at 00:00 UTC. Replaces two Vercel-cron
      // routes (app/api/publish-weekly, and a Sunday-only branch inside
      // app/api/revalidate-sitemaps) that independently ran this same
      // write against Appwrite on the same schedule -- moot now that
      // articles is D1-only (Week 34 froze Appwrite's copy).
      ctx.waitUntil(
        env.DB.prepare(
          "UPDATE articles SET weekly_live = 1, updated_at = datetime('now') WHERE is_weekly_pick = 1 AND weekly_live = 0"
        ).run()
      );
      return;
    }

    // Week 32: daily 30-day analytics_events retention.
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    ctx.waitUntil(
      env.DB.prepare('DELETE FROM analytics_events WHERE timestamp < ?').bind(cutoff).run()
    );
  },
};
