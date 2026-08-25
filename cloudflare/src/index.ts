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

type Bindings = { DB: D1Database; IMAGES: R2Bucket };

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

export default {
  fetch: app.fetch,

  // Two native Cloudflare Cron Triggers (see [triggers] in wrangler.toml),
  // distinguished by event.cron. Neither needs an HTTP auth boundary or a
  // Vercel cron slot (Hobby plan caps those at 2), unlike the
  // Appwrite-era approach both replaced.
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
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
