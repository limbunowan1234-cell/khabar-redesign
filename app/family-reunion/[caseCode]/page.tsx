import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import AppealForm from './AppealForm';
import ShareButton from './ShareButton';
import s from '../Appeal.module.css';

// Public Family Reunion appeal (/family-reunion/kd-fr-001). Shows only what an
// admin approved for the public: the Worker returns nothing for a case that
// isn't switched public or has no active story consent, so this page 404s.

const API = process.env.NEXT_PUBLIC_WORKER_API || 'https://api.khabardarjeeling.in';
const SITE = 'https://khabardarjeeling.in';
const FACEBOOK = 'https://www.facebook.com/profile.php?id=61590708777947';
const SECTION_LABEL: Record<string, string> = { subject: 'About the person searching', family: 'Family', background: 'Background', clue: 'Places and people remembered', other: 'Other details' };
const SECTION_ORDER = ['subject', 'family', 'clue', 'background', 'other'];

interface PublicCase {
  caseCode: string; headline: string; story: string | null; resolved: boolean;
  photo: { key: string; caption: string | null } | null;
  facts: { section: string; label: string; value: string; status: string; verified: boolean }[];
  updates: { title: string; sideHeader: string | null; slug: string; publishedAt: string | null }[];
}

async function load(code: string): Promise<PublicCase | null> {
  try {
    const res = await fetch(`${API}/reunion/public/${encodeURIComponent(code)}`, { next: { revalidate: 60 } });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}
const photoUrl = (key: string) => `${API}/reunion/public-media/${key}`;
const plain = (t: string | null, n: number) => (t || '').replace(/\s+/g, ' ').trim().slice(0, n);

export async function generateMetadata({ params }: PageProps<'/family-reunion/[caseCode]'>): Promise<Metadata> {
  const { caseCode } = await params;
  const c = await load(caseCode);
  if (!c) return { title: 'Family Reunion Appeal | Khabar Darjeeling', robots: 'noindex' };
  const description = plain(c.story, 155) || 'A Khabar Darjeeling family reunion appeal. Can you help?';
  const url = `${SITE}/family-reunion/${c.caseCode.toLowerCase()}`;
  return {
    title: `${c.headline} | Khabar Darjeeling`,
    description,
    alternates: { canonical: url },
    openGraph: { title: c.headline, description, url, siteName: 'Khabar Darjeeling', type: 'article', ...(c.photo ? { images: [{ url: photoUrl(c.photo.key), alt: c.photo.caption || c.headline }] } : {}) },
    twitter: { card: c.photo ? 'summary_large_image' : 'summary', title: c.headline, description },
  };
}

export default async function AppealPage({ params }: PageProps<'/family-reunion/[caseCode]'>) {
  const { caseCode } = await params;
  const c = await load(caseCode);
  if (!c) notFound();
  const groups = SECTION_ORDER.map((sec) => ({ sec, facts: c.facts.filter((f) => f.section === sec) })).filter((g) => g.facts.length);
  const url = `${SITE}/family-reunion/${c.caseCode.toLowerCase()}`;

  return (
    <div className={s.page}>
      <div className={s.bar}>
        <div className={s.barIn}>
          <Link href="/" className={s.logo}><img src="/assets/logo.png" alt="" width={34} height={34} /><span>Khabar Darjeeling</span></Link>
          <Link href="/" className={s.home}>Home</Link>
        </div>
      </div>

      <main className={s.wrap}>
        <section className={`${s.hero} ${c.photo ? '' : s.heroNoPhoto}`}>
          {c.photo && (
            <figure className={s.photo}>
              <img src={photoUrl(c.photo.key)} alt={c.photo.caption || `Photo shared for appeal ${c.caseCode}`} />
              {c.photo.caption && <figcaption>{c.photo.caption}</figcaption>}
            </figure>
          )}
          <div className={s.intro}>
            <p className={s.eyebrow}>Family Reunion Appeal · {c.caseCode}</p>
            <h1 className={s.h1}>{c.headline}</h1>
            {c.story && c.story.split(/\n{2,}/).map((p, i) => <p key={i} className={s.lead}>{p}</p>)}
            <div className={s.ctas}>
              {!c.resolved && <a href="#submit" className={s.ctaMain}>I have information</a>}
              <ShareButton url={url} title={c.headline} />
            </div>
          </div>
        </section>

        {c.resolved && (
          <p className={s.resolved}>Khabar Darjeeling has an update on this appeal. Thank you to everyone who shared it and sent information. See the latest updates below.</p>
        )}

        {groups.length > 0 && (
          <section className={s.block} aria-labelledby="details">
            <h2 id="details" className={s.h2}>Details that may help</h2>
            <p className={s.note}>These details were shared with Khabar Darjeeling. Each one shows whether it has been verified yet. Names are written exactly as they were given to us; spellings may differ.</p>
            <div className={s.groups}>
              {groups.map((g) => (
                <div key={g.sec} className={s.group}>
                  <h3>{SECTION_LABEL[g.sec] || g.sec}</h3>
                  <dl>
                    {g.facts.map((f, i) => (
                      <div key={i} className={s.fact}>
                        <dt>{f.label}</dt>
                        <dd>{f.value} <span className={f.verified ? s.badgeOk : s.badge}>{f.status}</span></dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </section>
        )}

        {c.updates.length > 0 && (
          <section className={s.block} aria-labelledby="updates">
            <h2 id="updates" className={s.h2}>Updates</h2>
            <ul className={s.updates}>
              {c.updates.map((u) => (
                <li key={u.slug}>
                  <Link href={`/article/${u.slug}`}>{u.title}</Link>
                  {u.sideHeader && <p>{u.sideHeader}</p>}
                  {u.publishedAt && <small>{new Date(u.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</small>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={s.block} aria-labelledby="help">
          <h2 id="help" className={s.h2}>How you can help</h2>
          <ul className={s.help}>
            <li><b>Share this page</b> with family and friends, especially anyone who has lived in the area for a long time.</li>
            <li><b>If you recognise the names or places</b>, send us what you know with the form below, or message the <a href={FACEBOOK} target="_blank" rel="noopener noreferrer">Khabar Darjeeling page</a>, or email <a href="mailto:contact@khabardarjeeling.in">contact@khabardarjeeling.in</a>.</li>
            <li><b>Please don&rsquo;t post anyone&rsquo;s phone number or address in public comments.</b> Send it to us privately and our team will follow it up carefully.</li>
          </ul>
        </section>

        {!c.resolved && (
          <section className={s.block} id="submit" aria-labelledby="submit-title">
            <h2 id="submit-title" className={s.h2}>Submit information</h2>
            <p className={s.note}>Everything you send goes only to the Khabar Darjeeling case team. Nothing is published automatically, and your name and contact details are never made public.</p>
            <AppealForm caseCode={c.caseCode} apiBase={API} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''} />
          </section>
        )}

        <p className={s.disclaimer}>This appeal is based on information shared with Khabar Darjeeling and has not all been independently verified. Khabar Darjeeling does not share informants&rsquo; details with anyone outside its case team.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
