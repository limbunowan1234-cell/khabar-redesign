import { Hono } from 'hono';
import { verifyUser, isAdmin } from '../lib/auth';

type Bindings = { DB: D1Database; AUTH_JWT_SECRET: string; AI: Ai };

export const aiDraft = new Hono<{ Bindings: Bindings }>();

const GENRES = ['Voice of People', 'Poetry', 'Editorial', 'Tourism', 'Politics', 'Culture', 'Health', 'Education', 'Technology', 'Sports', 'Business'];
const DISTRICTS = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'West Bengal', 'Sikkim', 'National', 'World'];

// Admin-only. Turns raw pasted source material (a press note, a tip,
// forwarded text) into a structured article draft using Workers AI, in the
// same house style already used for hand-written pieces on this site (lead
// paragraph, ## section headers, blockquotes, genre/district guess).
//
// This endpoint only ever returns the draft -- it never writes to D1.
// Saving is a separate, explicit step through the normal POST /articles
// endpoint, and the AI Draft admin page always saves with
// status='pending_review', never 'published'. A human still makes the
// actual publish decision as its own, separate action -- this tool drafts,
// it doesn't publish.
aiDraft.post('/', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json().catch(() => null);
  const sourceText = typeof body?.sourceText === 'string' ? body.sourceText.trim() : '';
  if (sourceText.length < 50) {
    return c.json({ error: 'sourceText is required (at least 50 characters)' }, 400);
  }

  const prompt = `You are a news editor for Khabar Darjeeling, a regional news site covering Darjeeling, Kalimpong, and the wider Gorkha hills community. Turn the source material below into a publish-ready article draft.

Rules:
- Never invent facts, quotes, or numbers -- only reformat and organize what's actually in the source.
- Lead paragraph, no header, sets the scene.
- Use "## " section headers wherever the topic shifts.
- Use "**Bold labels:**" for quick-reference facts within a paragraph where it aids scanning.
- Pull at most one or two standout lines into "> " blockquotes.
- Pick the single best-fitting genre from: ${GENRES.join(', ')}.
- Pick the single best-fitting district from: ${DISTRICTS.join(', ')}. Use "National" or "World" if the story isn't about a specific hill district.
- Write a short one-sentence subheading (sideHeader) that adds context beyond the title.

Respond with ONLY a JSON object, no other text, no markdown code fences, in exactly this shape:
{"title": "...", "sideHeader": "...", "content": "...", "genre": "...", "locationDistrict": "..."}

Source material:
"""
${sourceText}
"""`;

  try {
    const result = await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      prompt,
      max_tokens: 2048,
    }) as { response?: string };

    const raw = (result?.response || '').trim();
    // Some models echo/repeat the draft a few times before hitting
    // max_tokens rather than stopping cleanly -- take only the first
    // complete top-level JSON object (brace-matched, not a greedy regex
    // to the last "}" in the whole response) so a trailing repeat or a
    // truncated echo never corrupts an otherwise-valid first draft.
    const start = raw.indexOf('{');
    if (start === -1) return c.json({ error: 'AI did not return a parseable draft', raw }, 502);
    let depth = 0, end = -1;
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === '{') depth++;
      else if (raw[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) return c.json({ error: 'AI response was truncated before a complete draft', raw }, 502);

    let draft: any;
    try {
      draft = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return c.json({ error: 'AI returned malformed JSON', raw }, 502);
    }
    if (!draft.title || !draft.content) {
      return c.json({ error: 'AI draft missing title or content', raw }, 502);
    }
    if (!GENRES.includes(draft.genre)) draft.genre = GENRES[0];
    if (!DISTRICTS.includes(draft.locationDistrict)) draft.locationDistrict = 'National';

    return c.json({ draft });
  } catch (err: any) {
    return c.json({ error: 'AI generation failed: ' + (err?.message || String(err)) }, 500);
  }
});
