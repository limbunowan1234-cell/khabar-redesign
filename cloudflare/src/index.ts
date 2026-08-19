import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { articles } from './routes/articles';

type Bindings = { DB: D1Database };

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({ origin: ['https://khabardarjeeling.in', 'https://www.khabardarjeeling.in'] }));

app.get('/', (c) => c.json({ ok: true, service: 'khabar-worker', phase: 1 }));
app.route('/articles', articles);

export default app;
