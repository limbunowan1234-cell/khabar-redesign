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
app.route('/analytics', analytics);
app.route('/news-digest', newsDigest);

export default {
  fetch: app.fetch,

  // Week 32: 30-day analytics_events retention, running natively on
  // Cloudflare's own schedule (see [triggers] in wrangler.toml) rather
  // than as an HTTP route triggered by a Vercel cron with a shared
  // secret. Appwrite's equivalent (piggybacked on the
  // /api/revalidate-sitemaps cron, since Vercel's Hobby plan caps cron
  // jobs at 2) had been silently failing since the collection it
  // targeted never actually existed -- this sidesteps that whole class
  // of problem, since there's no HTTP auth boundary to get wrong and no
  // Vercel cron slot to compete for.
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    ctx.waitUntil(
      env.DB.prepare('DELETE FROM analytics_events WHERE timestamp < ?').bind(cutoff).run()
    );
  },
};
