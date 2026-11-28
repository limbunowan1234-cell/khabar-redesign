import { Hono } from 'hono';
import { isAdmin, type AppUser } from '../lib/auth';
import { camel, staffUser, loadCase, eventStmt, str, oneOf, type Bindings, type Ctx, type Row } from '../lib/reunionCore';

// The case newsroom: articles linked to a Family Reunion case, and AI drafts
// written from the case record. Mounted under /reunion by src/routes/reunion.ts.
//
// Case articles are ordinary rows in `articles` (so they render like any
// story once published) with reunion_case_id set. They move only through
// POST /case-articles/:id/status:
//   draft -> pending_review (Editorial Review) -> approved -> published
// Approving, publishing and unpublishing need an admin, and publishing also
// needs an active consent covering the story. The generic /articles routes
// refuse to change a case article's status (see routes/articles.ts).
//
// The AI never saves anything: POST /cases/:id/ai returns a draft for an
// editor to check, edit and save as a draft article like any other text. It
// is given only the facts an editor marked public (unless they explicitly
// ask for an internal draft), each tagged with its verification status.

export const reunionNews = new Hono<{ Bindings: Bindings }>();

const GENRES = ['Voice of People', 'Poetry', 'Editorial', 'Tourism', 'Politics', 'Culture', 'Health', 'Education', 'Technology', 'Sports', 'Business'];
const DISTRICTS = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'West Bengal', 'Sikkim', 'National', 'World'];
const ARTICLE_STATUSES = ['draft', 'pending_review', 'approved', 'published'];
// [from][to] -> who may make the move
const TRANSITIONS: Record<string, Record<string, 'staff' | 'admin'>> = {
  draft: { pending_review: 'staff' },
  pending_review: { draft: 'staff', approved: 'admin' },
  approved: { published: 'admin', pending_review: 'admin', draft: 'admin' },
  published: { approved: 'admin' },
};
const OUTCOME_STATUSES = new Set(['family_located', 'contact_established', 'reunion_arranged', 'successfully_reunited']);

const slugify = (t: string) =>
  t.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'case-update';

async function hasStoryConsent(db: D1Database, caseId: string): Promise<boolean> {
  return !!(await db
    .prepare("SELECT 1 FROM reunion_case_consents WHERE case_id = ? AND withdrawn_at IS NULL AND scope IN ('public_story', 'both') LIMIT 1")
    .bind(caseId).first());
}

// A case photo may be used in an article only while it's published with
// consent. Other image keys are ordinary /cdn/articles uploads.
async function checkImages(db: D1Database, caseId: string, keys: string[]): Promise<string | null> {
  for (const key of keys.filter((k) => k.startsWith('reunion-'))) {
    const ok = await db.prepare('SELECT 1 FROM reunion_case_media WHERE public_key = ? AND case_id = ? AND deleted_at IS NULL').bind(key, caseId).first();
    if (!ok) return 'A case photo can be used only after it has been published with consent';
  }
  return null;
}

// Loads a case article plus its (visible) case.
async function loadArticle(c: Ctx, user: AppUser, id: string): Promise<{ article: Row; parent: Row } | null> {
  const article = await c.env.DB.prepare('SELECT * FROM articles WHERE id = ? AND reunion_case_id IS NOT NULL').bind(id).first<Row>();
  if (!article) return null;
  const parent = await loadCase(c, user, article.reunion_case_id);
  return parent ? { article, parent } : null;
}

function articleJson(r: Row, supporting: Row[] = []) {
  return {
    $id: r.id, slug: r.slug, title: r.title, sideHeader: r.side_header, content: r.content, genre: r.genre,
    status: r.status, locationDistrict: r.location_district, locationArea: r.location_area, imageFileId: r.image_file_id,
    imageCaption: r.image_caption, authorName: r.author_name, submitterName: r.submitter_name, seoTitle: r.seo_title,
    metaDescription: r.meta_description, keywords: r.keywords, socialDescription: r.social_description,
    reunionCaseId: r.reunion_case_id, publishedAt: r.published_at, createdAt: r.created_at, updatedAt: r.updated_at,
    supportingImages: supporting.map((s) => ({ fileId: s.file_id, caption: s.caption })),
  };
}

// Editable article fields -> column, with their limits.
const FIELDS: Record<string, { col: string; max: number; allowed?: string[] }> = {
  title: { col: 'title', max: 300 },
  sideHeader: { col: 'side_header', max: 500 },
  content: { col: 'content', max: 60000 },
  genre: { col: 'genre', max: 50, allowed: GENRES },
  locationDistrict: { col: 'location_district', max: 50, allowed: DISTRICTS },
  locationArea: { col: 'location_area', max: 200 },
  imageFileId: { col: 'image_file_id', max: 200 },
  imageCaption: { col: 'image_caption', max: 500 },
  authorName: { col: 'author_name', max: 200 },
  seoTitle: { col: 'seo_title', max: 120 },
  metaDescription: { col: 'meta_description', max: 320 },
  keywords: { col: 'keywords', max: 500 },
  socialDescription: { col: 'social_description', max: 500 },
};
function readFields(b: Row): { values: Record<string, string | null>; images: string[] } {
  const values: Record<string, string | null> = {};
  for (const [key, f] of Object.entries(FIELDS)) {
    const v = str(b[key], f.max);
    if (v === undefined) continue;
    if (v !== null && f.allowed && !f.allowed.includes(v)) continue;
    values[key] = v;
  }
  const images = [values.imageFileId, ...(Array.isArray(b.supportingImages) ? b.supportingImages.map((s: Row) => String(s?.fileId || '')) : [])].filter(Boolean) as string[];
  return { values, images };
}
function supportingStmts(db: D1Database, articleId: string, list: unknown): D1PreparedStatement[] {
  if (!Array.isArray(list)) return [];
  const stmts = [db.prepare('DELETE FROM article_supporting_images WHERE article_id = ?').bind(articleId)];
  list.slice(0, 20).forEach((s: Row, i) => {
    const fileId = str(s?.fileId, 200);
    if (fileId) stmts.push(db.prepare('INSERT INTO article_supporting_images (article_id, file_id, caption, sort_order) VALUES (?, ?, ?, ?)').bind(articleId, fileId, str(s?.caption, 500) ?? null, i));
  });
  return stmts;
}

// ---- case articles -----------------------------------------------------------

reunionNews.get('/cases/:id/articles', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const { results } = await c.env.DB
    .prepare('SELECT * FROM articles WHERE reunion_case_id = ? ORDER BY created_at DESC')
    .bind(row.id).all<Row>();
  return c.json({ documents: results.map((r) => articleJson(r)) });
});

reunionNews.post('/cases/:id/articles', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const b = ((await c.req.json().catch(() => null)) || {}) as Row;
  const { values, images } = readFields(b);
  if (!values.title) return c.json({ error: 'A headline is required' }, 400);
  const imageError = await checkImages(c.env.DB, row.id, images);
  if (imageError) return c.json({ error: imageError }, 400);

  const id = crypto.randomUUID();
  const slug = `${slugify(values.title)}-${Date.now().toString(36)}`;
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO articles (id, slug, title, side_header, content, genre, status, location_district, location_area,
           image_file_id, image_caption, submitter_id, submitter_name, author_name, kind, reunion_case_id,
           seo_title, meta_description, keywords, social_description, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, 'story', ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, slug, values.title, values.sideHeader ?? null, values.content ?? null, values.genre ?? 'Voice of People',
        values.locationDistrict ?? 'Darjeeling', values.locationArea ?? null, values.imageFileId ?? null, values.imageCaption ?? null,
        user.$id, user.name, values.authorName ?? user.name, row.id, values.seoTitle ?? null, values.metaDescription ?? null,
        values.keywords ?? null, values.socialDescription ?? null, new Date().toISOString()),
    ...supportingStmts(c.env.DB, id, b.supportingImages),
    eventStmt(c.env.DB, row.id, user, { type: 'article_created', entityType: 'article', entityId: id, newValue: values.title }),
  ]);
  return c.json(articleJson((await c.env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first<Row>())!), 201);
});

reunionNews.get('/case-articles/:id', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const found = await loadArticle(c, user, c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const { results } = await c.env.DB.prepare('SELECT file_id, caption FROM article_supporting_images WHERE article_id = ? ORDER BY sort_order').bind(found.article.id).all<Row>();
  return c.json({ ...articleJson(found.article, results), caseCode: found.parent.case_code, caseTitle: found.parent.title });
});

// Edits. The case team can edit drafts and articles in review; once approved
// or published, only an admin can change the text.
reunionNews.patch('/case-articles/:id', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const found = await loadArticle(c, user, c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const { article, parent } = found;
  if (['approved', 'published'].includes(article.status) && !isAdmin(user)) {
    return c.json({ error: 'Approved and published articles can only be edited by an admin' }, 403);
  }
  const b = ((await c.req.json().catch(() => null)) || {}) as Row;
  const { values, images } = readFields(b);
  if (values.title === null) return c.json({ error: 'A headline is required' }, 400);
  const imageError = await checkImages(c.env.DB, parent.id, images);
  if (imageError) return c.json({ error: imageError }, 400);

  const changed = Object.entries(values).filter(([key, v]) => v !== article[FIELDS[key].col]).map(([key]) => key);
  const stmts: D1PreparedStatement[] = [];
  if (changed.length) {
    stmts.push(c.env.DB
      .prepare(`UPDATE articles SET ${changed.map((k) => `${FIELDS[k].col} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...changed.map((k) => values[k]), article.id));
  }
  const sup = supportingStmts(c.env.DB, article.id, b.supportingImages);
  if (sup.length) { stmts.push(...sup); changed.push('supportingImages'); }
  if (!stmts.length) return c.json({ ok: true, changed: [] });
  stmts.push(eventStmt(c.env.DB, parent.id, user, {
    type: 'article_changed', entityType: 'article', entityId: article.id, field: changed.join(', '),
    oldValue: changed.includes('title') ? article.title : null, newValue: changed.includes('title') ? values.title : null,
  }));
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, changed });
});

// POST /reunion/case-articles/:id/status { status, note }
reunionNews.post('/case-articles/:id/status', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const found = await loadArticle(c, user, c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const { article, parent } = found;
  const b = await c.req.json().catch(() => null);
  const to = oneOf(b?.status, ARTICLE_STATUSES);
  const note = str(b?.note, 2000) ?? null;
  if (!to) return c.json({ error: 'A valid status is required' }, 400);
  const who = TRANSITIONS[article.status]?.[to];
  if (!who) return c.json({ error: `An article can't move from ${article.status} to ${to}` }, 400);
  if (who === 'admin' && !isAdmin(user)) return c.json({ error: 'Only an admin can do this' }, 403);
  if (to === 'published') {
    if (!(await hasStoryConsent(c.env.DB, parent.id))) return c.json({ error: 'Record an active consent for the public story before publishing' }, 400);
    if (!article.title || !(article.content || '').trim()) return c.json({ error: 'An article needs a headline and body before publishing' }, 400);
  }
  if (to === 'draft' && article.status === 'pending_review' && !note) return c.json({ error: 'Say what needs changing when sending an article back' }, 400);
  await c.env.DB.batch([
    c.env.DB
      .prepare(`UPDATE articles SET status = ?, ${to === 'published' ? "published_at = COALESCE(published_at, ?)," : ''} updated_at = datetime('now') WHERE id = ?`)
      .bind(...(to === 'published' ? [to, new Date().toISOString(), article.id] : [to, article.id])),
    eventStmt(c.env.DB, parent.id, user, { type: 'article_status', entityType: 'article', entityId: article.id, field: article.title, oldValue: article.status, newValue: to, note }),
  ]);
  return c.json({ ok: true, status: to, slug: article.slug });
});

// Admin only: delete a case article that was never published.
reunionNews.delete('/case-articles/:id', async (c) => {
  const user = await staffUser(c);
  if (!user || !isAdmin(user)) return c.json({ error: 'Only an admin can delete a case article' }, 403);
  const found = await loadArticle(c, user, c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  if (found.article.status === 'published') return c.json({ error: 'Unpublish the article first' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM article_supporting_images WHERE article_id = ?').bind(found.article.id),
    c.env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(found.article.id),
    eventStmt(c.env.DB, found.parent.id, user, { type: 'article_deleted', entityType: 'article', entityId: found.article.id, oldValue: found.article.title }),
  ]);
  return c.json({ ok: true });
});

// ---- AI drafts -------------------------------------------------------------------

const FORMATS: Record<string, { label: string; shape: string; guide: string }> = {
  article_en: { label: 'English news article', shape: 'article', guide: 'A professional English news article in the Khabar Darjeeling house style: a short lead paragraph, then 2-4 sections each starting with a line "## Heading", and a closing "How you can help" section.' },
  article_hi: { label: 'Hindi news article', shape: 'article', guide: 'The same news article written in clear, natural Hindi (Devanagari script). Keep personal and place names exactly as given in the facts, in their original spelling, optionally with a Devanagari transliteration in brackets the first time.' },
  article_ne: { label: 'Nepali news article', shape: 'article', guide: 'The same news article written in clear, natural Nepali (Devanagari script). Keep personal and place names exactly as given in the facts, in their original spelling, optionally with a Devanagari transliteration in brackets the first time.' },
  facebook: { label: 'Facebook post', shape: 'text', guide: 'A short Facebook post (80-150 words) asking people to share and to message the Khabar Darjeeling page. Plain text, a few line breaks, at most 3 relevant emojis.' },
  instagram: { label: 'Instagram caption', shape: 'text', guide: 'An Instagram caption (50-100 words) followed by a line of 5-10 relevant hashtags such as #Darjeeling #KhabarDarjeeling #FamilyReunion.' },
  appeal: { label: 'Public family-reunion appeal', shape: 'text', guide: 'A public appeal for the case page: a one-line headline, a short paragraph about who is searching and why, a bulleted list "What she/he remembers" of the identifying clues, and a "How you can help" paragraph.' },
  whatsapp: { label: 'WhatsApp message', shape: 'text', guide: 'A WhatsApp message for community circulation, under 120 words, using *bold* for the key names, ending with "Please share. Message the Khabar Darjeeling page if you know anything."' },
};
const PROVENANCE_TAG: Record<string, string> = {
  verified: 'VERIFIED', source_provided: 'SOURCE-PROVIDED, NOT VERIFIED', unverified: 'UNVERIFIED', disputed: 'DISPUTED',
};

// First complete JSON object in the model's reply, string-aware so braces
// inside text don't confuse it.
function firstJsonObject(raw: string): Row | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try { return JSON.parse(raw.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

// Things an editor must look at before using a draft. Advisory: the editor
// decides, and nothing is saved until they do.
function reviewWarnings(text: string, caseStatus: string): string[] {
  const w: string[] = [];
  if (/["“”«»][^"“”«»\n]{12,}["“”«»]/.test(text)) w.push('Contains text in quotation marks. Check it is not an invented quote; no one has been interviewed for this draft.');
  if (!OUTCOME_STATUSES.has(caseStatus) && /\b(has been|have been|was|were) (found|located|traced|reunited)\b|\breunited with\b|\bfamily (has been |was )?found\b/i.test(text)) {
    w.push('Says the family was found, located or reunited, but the case has not reached that stage. Remove or correct this.');
  }
  if (/\bmissing (person|woman|man)\b|\bpolice (case|complaint)\b|\babducted\b|\bkidnapp/i.test(text)) w.push('Uses missing-person or police language. This is a family reconnection case.');
  if (/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/.test(text)) w.push('Contains what looks like a phone number. Only official Khabar Darjeeling contact details may be published.');
  return w;
}

reunionNews.post('/cases/:id/ai', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const b = await c.req.json().catch(() => null);
  const format = oneOf(b?.format, Object.keys(FORMATS));
  if (!format) return c.json({ error: 'Choose a format' }, 400);
  const internal = !!b?.internal;

  const { results: facts } = await c.env.DB
    .prepare(`SELECT section, label, value, provenance FROM reunion_case_facts WHERE case_id = ? AND deleted_at IS NULL ${internal ? '' : 'AND is_public = 1'} ORDER BY section, sort_order`)
    .bind(row.id).all<Row>();
  if (!facts.length) {
    return c.json({ error: internal ? 'This case has no recorded facts yet.' : 'No facts are marked public yet. Mark the details that may be published as public in Personal Information and Investigation, then try again.' }, 400);
  }
  const factLines = facts.map((f) => `- [${PROVENANCE_TAG[f.provenance] || 'UNVERIFIED'}] ${f.label}: ${f.value}`).join('\n');
  const spec = FORMATS[format];
  const shape = spec.shape === 'article'
    ? '{"headline": string, "subheadline": string, "body": string, "seoTitle": string (max 60 chars), "metaDescription": string (max 155 chars), "keywords": string (comma separated), "socialDescription": string (max 200 chars)}'
    : '{"text": string}';

  const prompt = `You write for Khabar Darjeeling, a local news site in Darjeeling, India. You are drafting material for a FAMILY RECONNECTION case: someone is trying to reconnect with their family. It is not a missing-person case and not a police case.

TASK: ${spec.guide}

THE ONLY FACTS YOU MAY USE (each tagged with its verification status):
${factLines}

STRICT RULES:
1. Use only the facts above. Do not add any name, place, date, age, number, relationship, event or detail that is not in the list. If something is unknown, leave it out.
2. Facts tagged VERIFIED may be stated plainly. Facts tagged SOURCE-PROVIDED or UNVERIFIED must be attributed, e.g. "according to the information she has shared", "she recalls", "reportedly". Facts tagged DISPUTED must either be left out or described as still being checked.
3. Never invent quotations. Do not put anyone's words in quotation marks. No one has been interviewed for this draft.
4. Never say or suggest that the family has been found, located, contacted or reunited. The search is ongoing.
5. Do not describe anyone as missing, and do not mention police.
6. Do not include any phone number, address or contact detail. For contact, say only: message the Khabar Darjeeling page.
7. Keep names and spellings exactly as given in the facts. Do not correct or standardise them.
8. End by noting that the details come from the information shared with Khabar Darjeeling and have not all been independently verified.

Reply with ONLY a JSON object, no other text, in exactly this shape:
${shape}`;

  let draft: Row | null = null;
  if (c.env.REUNION_AI_MOCK === '1') {
    // Local testing only (set in .dev.vars, never in production): echoes the
    // facts so the request/response path can be tested without Workers AI.
    draft = spec.shape === 'article'
      ? { headline: 'MOCK headline', subheadline: 'MOCK subheadline', body: `MOCK body\n\n${factLines}`, seoTitle: 'MOCK seo', metaDescription: 'MOCK meta', keywords: 'mock', socialDescription: 'MOCK social' }
      : { text: `MOCK ${format}\n${factLines}` };
  } else {
    try {
      const result = (await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { prompt, max_tokens: 2048 })) as Row;
      const raw = typeof result?.response === 'string' ? result.response : typeof result === 'string' ? (result as unknown as string) : '';
      draft = firstJsonObject(raw);
    } catch (err) {
      console.error('reunion ai:', err);
      return c.json({ error: 'The AI service did not respond. Try again in a moment.' }, 502);
    }
  }
  if (!draft || (spec.shape === 'article' ? typeof draft.body !== 'string' : typeof draft.text !== 'string')) {
    return c.json({ error: 'The AI did not return a usable draft. Try again.' }, 502);
  }
  const clean: Row = {};
  for (const [k, v] of Object.entries(draft)) if (typeof v === 'string') clean[k] = v.trim();
  const allText = Object.values(clean).join('\n');
  await eventStmt(c.env.DB, row.id, user, { type: 'ai_draft', entityType: 'case', entityId: row.id, field: spec.label, note: internal ? 'Internal draft (all facts)' : 'Public facts only' }).run();
  return c.json({ format, label: spec.label, shape: spec.shape, draft: clean, warnings: reviewWarnings(allText, row.status), factsUsed: facts.length, internal });
});
