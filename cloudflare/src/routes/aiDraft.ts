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

  // Content comes back as an array of typed blocks, not one flat string
  // with inline "##"/">" markers -- that flat-string approach was tried
  // first and failed live: this model doesn't reliably put a real blank
  // line before those markers inside a single JSON string value, so they
  // landed mid-sentence in one run-on paragraph and never got recognized
  // as block-level elements by the renderer (only inline **bold** survived,
  // since that doesn't depend on paragraph boundaries). Blocks sidestep the
  // whole problem: the model only ever picks a block's type and text, and
  // this endpoint does the "## "/"> " prefixing and \n\n joining itself --
  // so correct structure no longer depends on the model getting whitespace
  // right inside a string.
  const prompt = `You are a news editor for Khabar Darjeeling, a regional news site covering Darjeeling, Kalimpong, and the wider Gorkha hills community. Turn the source material below into a publish-ready article draft.

Rules:
- Never invent facts, quotes, or numbers -- only reformat and organize what's actually in the source.
- Break the article into blocks. Each block is one of:
  - "paragraph" -- ordinary prose. Use "**text**" inside a paragraph's text for a quick-reference bold label where it aids scanning.
  - "heading" -- a short section header, used wherever the topic shifts.
  - "quote" -- a single standout line pulled out for emphasis. Use at most one or two of these in the whole draft, and only for a real standout line, not just a restated fact.
- The first block must be a "paragraph" (the lead, sets the scene, no heading before it).
- Pick the single best-fitting genre from: ${GENRES.join(', ')}.
- Pick the single best-fitting district from: ${DISTRICTS.join(', ')}. Use "National" or "World" if the story isn't about a specific hill district.
- Write a short one-sentence subheading (sideHeader) that adds context beyond the title.

Respond with ONLY a JSON object, no other text, no markdown code fences, in exactly this shape:
{"title": "...", "sideHeader": "...", "blocks": [{"type": "paragraph", "text": "..."}, {"type": "heading", "text": "..."}], "genre": "...", "locationDistrict": "..."}

Source material:
"""
${sourceText}
"""`;

  try {
    const result = await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      prompt,
      max_tokens: 2048,
    }) as any;

    // result.response isn't reliably a plain string for every model/call --
    // it's sometimes an object or array instead (seen live, not just in
    // theory). Handle both known shapes and surface the raw shape on
    // anything else instead of crashing on .trim().
    let raw: string;
    if (typeof result?.response === 'string') {
      raw = result.response;
    } else if (typeof result === 'string') {
      raw = result;
    } else {
      return c.json({ error: 'Unexpected AI response shape', raw: JSON.stringify(result) }, 502);
    }
    raw = raw.trim();
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

    let parsed: any;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return c.json({ error: 'AI returned malformed JSON', raw }, 502);
    }
    if (!parsed.title || !Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      return c.json({ error: 'AI draft missing title or blocks', raw }, 502);
    }

    // Assemble content here, not the model -- guarantees a real blank line
    // between every block regardless of what the model did internally.
    const content = parsed.blocks
      .filter((b: any) => b && typeof b.text === 'string' && b.text.trim())
      .map((b: any) => {
        const text = b.text.trim();
        if (b.type === 'heading') return '## ' + text;
        if (b.type === 'quote') return '> ' + text;
        return text;
      })
      .join('\n\n');

    if (!content) return c.json({ error: 'AI draft had no usable block text', raw }, 502);

    const draft = {
      title: parsed.title,
      sideHeader: parsed.sideHeader || '',
      content,
      genre: GENRES.includes(parsed.genre) ? parsed.genre : GENRES[0],
      locationDistrict: DISTRICTS.includes(parsed.locationDistrict) ? parsed.locationDistrict : 'National',
    };

    return c.json({ draft });
  } catch (err: any) {
    return c.json({ error: 'AI generation failed: ' + (err?.message || String(err)) }, 500);
  }
});
