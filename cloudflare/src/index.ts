import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { articles } from './routes/articles';
import { cdn } from './routes/cdn';
import { likes } from './routes/likes';
import { comments } from './routes/comments';
import { follows } from './routes/follows';
import { bookmarks } from './routes/bookmarks';
import { profiles } from './routes/profiles';

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

export default app;
