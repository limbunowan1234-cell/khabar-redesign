'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { REGIONS, type Region, type Stay, type StayRating } from '@/lib/stays';
import styles from './Stays.module.css';

type Filter = 'all' | Stay['group'];
type Sort = 'featured' | 'rating' | 'name' | 'price';

const TYPES: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All stays' },
  { id: 'heritage', label: 'Heritage & tea estates' },
  { id: 'resort', label: 'Resorts & spas' },
  { id: 'local', label: 'Hotels' },
];

const telHref = (p: string) => 'tel:' + p.replace(/[^+\d]/g, '');
const mapHref = (q: string) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
const fmtDate = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtShort = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const nightsBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400e3);
// first number in the published summary, used only to sort ("From ₹13,000 a night" -> 13000)
const priceKey = (s: Stay) => { const m = s.pricing?.summary.replace(/,/g, '').match(/\d+/); return m ? Number(m[0]) : Infinity; };
// unrated stays sort after rated ones
const ratingKey = (s: Stay) => (s.rating ? s.rating.score / s.rating.outOf : -1);
const scoreWord = (r: StayRating) => { const x = (r.score / r.outOf) * 10; return x >= 9 ? 'Wonderful' : x >= 8 ? 'Excellent' : x >= 7 ? 'Good' : x >= 6 ? 'Pleasant' : 'Fair'; };

function Rating({ r }: { r: StayRating }) {
  return (
    <div className={styles.rating}>
      {r.hotelClass && (
        <p className={styles.stars} aria-label={`${r.hotelClass}-star hotel`}>
          <span aria-hidden="true">{'★'.repeat(r.hotelClass)}<span className={styles.starsOff}>{'★'.repeat(5 - r.hotelClass)}</span></span>
          <small>{r.hotelClass}-star hotel</small>
        </p>
      )}
      <p className={styles.score}>
        <b>{r.score.toFixed(1)}</b>
        <span>
          <strong>{scoreWord(r)}</strong>
          <small>
            {r.reviews.toLocaleString('en-IN')} verified guest reviews on{' '}
            <a href={r.url} target="_blank" rel="noopener noreferrer">{r.source}</a>, {fmtShort(r.checked)} {r.checked.slice(0, 4)}
          </small>
        </span>
      </p>
    </div>
  );
}

interface Trip { checkIn: string; checkOut: string; adults: number; children: number; rooms: number }

function tripSummary(t: Trip): string {
  const parts: string[] = [];
  if (t.checkIn && t.checkOut && nightsBetween(t.checkIn, t.checkOut) > 0) {
    const n = nightsBetween(t.checkIn, t.checkOut);
    parts.push(`${fmtShort(t.checkIn)} to ${fmtShort(t.checkOut)} (${n} night${n > 1 ? 's' : ''})`);
  }
  parts.push(`${t.adults} adult${t.adults > 1 ? 's' : ''}${t.children ? `, ${t.children} child${t.children > 1 ? 'ren' : ''}` : ''}`);
  parts.push(`${t.rooms} room${t.rooms > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

function enquiryText(stay: Stay, t: Trip, name: string, phone: string): string {
  const when = t.checkIn && t.checkOut && nightsBetween(t.checkIn, t.checkOut) > 0
    ? `from ${fmtDate(t.checkIn)} to ${fmtDate(t.checkOut)} (${nightsBetween(t.checkIn, t.checkOut)} night${nightsBetween(t.checkIn, t.checkOut) > 1 ? 's' : ''})`
    : 'on dates I will confirm';
  return [
    `Hello ${stay.name},`,
    '',
    `I found your stay on Khabar Darjeeling. I would like to enquire about ${t.rooms} room${t.rooms > 1 ? 's' : ''} for ${t.adults} adult${t.adults > 1 ? 's' : ''}${t.children ? ` and ${t.children} child${t.children > 1 ? 'ren' : ''}` : ''}, ${when}.`,
    '',
    'Please let me know what is available, the rates and what they include.',
    '',
    `Thank you,\n${name || '(your name)'}${phone ? `\n${phone}` : ''}`,
  ].join('\n');
}

export default function StaysClient({ stays, checked }: { stays: Stay[]; checked: string }) {
  const [region, setRegion] = useState<'all' | Region>('all');
  const [type, setType] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('featured');
  const [ratesOnly, setRatesOnly] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip>({ checkIn: '', checkOut: '', adults: 2, children: 0, rooms: 1 });
  const [enquiring, setEnquiring] = useState<Stay | null>(null);
  const [googleFor, setGoogleFor] = useState<Stay | null>(null);

  // today in IST, set after mount so server and client markup match
  useEffect(() => { setToday(new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10)); }, []);

  const list = useMemo(() => {
    let out = stays.filter((s) => (region === 'all' || s.region === region) && (type === 'all' || s.group === type) && (!ratesOnly || !!s.pricing));
    if (sort === 'rating') out = [...out].sort((a, b) => ratingKey(b) - ratingKey(a));
    if (sort === 'name') out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'price') out = [...out].sort((a, b) => priceKey(a) - priceKey(b));
    return out;
  }, [stays, region, type, sort, ratesOnly]);

  const sections = REGIONS.map((r) => ({ ...r, stays: list.filter((s) => s.region === r.id) })).filter((r) => r.stays.length > 0);
  const regionLabel = region === 'all' ? 'Darjeeling, Sikkim and the hills' : REGIONS.find((r) => r.id === region)!.label;
  // the newest per-stay check date, for the note at the foot of the page
  const lastChecked = stays.reduce((max, s) => (s.checked && s.checked > max ? s.checked : max), checked);

  const setCheckIn = (v: string) => setTrip((t) => ({
    ...t, checkIn: v,
    checkOut: v && (!t.checkOut || nightsBetween(v, t.checkOut) < 1) ? addDays(v, 1) : t.checkOut,
  }));

  const card = (s: Stay) => {
    const expired = !!(s.pricing && today && today > s.pricing.validTo);
    return (
      <li key={s.id} className={styles.card}>
        <div className={styles.media}>
          {s.photo ? (
            <>
              <img src={s.photo.src} alt={s.photo.alt} loading="lazy" />
              <button type="button" className={styles.morePhotos} onClick={() => setGoogleFor(s)}>📷 More photos</button>
              <p className={styles.credit}>
                {s.photo.caption ? s.photo.caption + ' · ' : ''}{s.photo.author},{' '}
                <a href={s.photo.licenseUrl} target="_blank" rel="noopener noreferrer">{s.photo.license}</a>,{' '}
                <a href={s.photo.sourceUrl} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>
              </p>
            </>
          ) : (
            <div className={styles.noPhoto}>
              <span aria-hidden="true">{s.name.charAt(0)}</span>
              <button type="button" className={styles.googleBtn} onClick={() => setGoogleFor(s)}>📷 See photos on Google</button>
            </div>
          )}
        </div>

        <div className={styles.body}>
          <p className={styles.tag}>{s.tag}</p>
          <h3 className={styles.name}>{s.name}</h3>
          <p className={styles.area}>
            <a href={mapHref(s.mapQuery)} target="_blank" rel="noopener noreferrer">{s.area}</a>
          </p>
          {s.rating && <Rating r={s.rating} />}
          <p className={styles.blurb}>{s.blurb}</p>
          <ul className={styles.facts}>{s.facts.map((f) => <li key={f}>{f}</li>)}</ul>
          <p className={styles.links}>
            <a href={s.website} target="_blank" rel="noopener noreferrer">Official website</a>
            {s.phones.length > 0 && <>
              {' · '}
              {s.phones.map((p, i) => <span key={p}>{i > 0 && ', '}<a href={telHref(p)}>{p}</a></span>)}
            </>}
          </p>
        </div>

        <aside className={styles.buy}>
          {s.pricing ? (
            <>
              <p className={styles.priceLabel}>{expired ? 'Last published rate' : 'Published rate'}</p>
              <p className={styles.price}>{s.pricing.summary}</p>
              {expired && <p className={styles.stale}>Out of date</p>}
              <p className={styles.priceNote}>{s.pricing.detail}</p>
              <p className={styles.priceMeta}>
                <a href={s.pricing.sourceUrl} target="_blank" rel="noopener noreferrer">Tariff</a> for {fmtShort(s.pricing.validFrom)} {s.pricing.validFrom.slice(0, 4)} to {fmtShort(s.pricing.validTo)} {s.pricing.validTo.slice(0, 4)}. Ask for today&rsquo;s price.
              </p>
            </>
          ) : (
            <>
              <p className={styles.priceLabel}>Rates</p>
              <p className={styles.price}>On request</p>
              <p className={styles.priceNote}>This stay does not publish a price list. Send an enquiry to get a quote.</p>
            </>
          )}
          <button type="button" className={styles.cta} onClick={() => setEnquiring(s)}>Check availability</button>
          {s.bookingUrl && <a className={styles.alt} href={s.bookingUrl} target="_blank" rel="noopener noreferrer">Book on their site</a>}
        </aside>
      </li>
    );
  };

  return (
    <>
      <section className={styles.hero}>
        <img className={styles.heroImg} src="/stays/glenburn.jpg" alt="" />
        <div className={styles.heroShade} />
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Khabar Darjeeling Stays</p>
          <h1 className={styles.h1}>Trusted by Locals, Loved by Travelers</h1>
          <p className={styles.lead}>Heritage hotels, tea estates, resorts and hotels across Darjeeling, Kurseong, Kalimpong, Mirik, Siliguri and Sikkim. Compare verified guest ratings, see each stay&rsquo;s own rates and contact them directly. No booking fees.</p>
        </div>
        <p className={styles.heroCredit}>
          Photo: A. J. T. Johnsingh, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>,{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Kangchenjunga_from_Glenburn_Tea_Estate_AJTJohnsingh_DSC01329.jpg" target="_blank" rel="noopener noreferrer">via Wikimedia Commons</a>
        </p>
      </section>

      <div className={styles.wrap}>
        <form className={styles.search} onSubmit={(e) => e.preventDefault()} aria-label="Plan your stay">
          <label className={styles.f}>
            <span>Where</span>
            <select value={region} onChange={(e) => setRegion(e.target.value as 'all' | Region)}>
              <option value="all">All of Darjeeling, Sikkim & the hills</option>
              {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <label className={styles.f}>
            <span>Check-in</span>
            <input type="date" value={trip.checkIn} min={today ?? undefined} onChange={(e) => setCheckIn(e.target.value)} />
          </label>
          <label className={styles.f}>
            <span>Check-out</span>
            <input type="date" value={trip.checkOut} min={trip.checkIn ? addDays(trip.checkIn, 1) : today ?? undefined} onChange={(e) => setTrip((t) => ({ ...t, checkOut: e.target.value }))} />
          </label>
          <label className={styles.f}>
            <span>Adults</span>
            <select value={trip.adults} onChange={(e) => setTrip((t) => ({ ...t, adults: Number(e.target.value) }))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className={styles.f}>
            <span>Children</span>
            <select value={trip.children} onChange={(e) => setTrip((t) => ({ ...t, children: Number(e.target.value) }))}>
              {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className={styles.f}>
            <span>Rooms</span>
            <select value={trip.rooms} onChange={(e) => setTrip((t) => ({ ...t, rooms: Number(e.target.value) }))}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </form>

        <ul className={styles.trust}>
          <li>Details checked on each stay&rsquo;s own website</li>
          <li>Verified guest ratings, with the source shown</li>
          <li>You deal directly with the stay</li>
          <li>No booking fees</li>
        </ul>

        <nav className={styles.regions} aria-label="Regions">
          {[{ id: 'all' as const, label: 'All regions' }, ...REGIONS].map((r) => {
            const n = r.id === 'all' ? stays.length : stays.filter((s) => s.region === r.id).length;
            return (
              <button key={r.id} type="button" aria-pressed={region === r.id} className={region === r.id ? styles.regionOn : ''} onClick={() => setRegion(r.id)}>
                {r.label} <span>{n}</span>
              </button>
            );
          })}
        </nav>

        <div className={styles.toolbar}>
          <div className={styles.chips} role="group" aria-label="Type of stay">
            {TYPES.map((g) => (
              <button key={g.id} type="button" aria-pressed={type === g.id} className={type === g.id ? styles.chipOn : ''} onClick={() => setType(g.id)}>{g.label}</button>
            ))}
            <button type="button" aria-pressed={ratesOnly} className={ratesOnly ? styles.chipOn : ''} onClick={() => setRatesOnly((v) => !v)}>Rates published</button>
          </div>
          <label className={styles.sort}>
            <span>Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="featured">Featured</option>
              <option value="rating">Guest rating, high to low</option>
              <option value="name">Name A to Z</option>
              <option value="price">Published price, low to high</option>
            </select>
          </label>
        </div>

        <p className={styles.count} aria-live="polite">{list.length} stay{list.length === 1 ? '' : 's'} in {regionLabel} · {tripSummary(trip)}</p>

        {list.length === 0 && <p className={styles.empty}>No stays match these filters. Try another region or type of stay, or clear &ldquo;Rates published&rdquo;.</p>}

        {sections.map((r) => (
          <section key={r.id} className={styles.regionSection} aria-labelledby={'region-' + r.id}>
            <header className={styles.regionHead}>
              <h2 id={'region-' + r.id}>Stays in {r.label}</h2>
              <p>{r.blurb} <span>{r.stays.length} stay{r.stays.length === 1 ? '' : 's'}</span></p>
            </header>
            <ul className={styles.results}>{r.stays.map(card)}</ul>
          </section>
        ))}

        <section className={styles.listCta}>
          <div>
            <h2>Run a stay in the hills?</h2>
            <p>Get listed here. Send us your property&rsquo;s name, area, phone, email and website and we will check them before adding you.</p>
          </div>
          <Link href="/contact" className={styles.listBtn}>Contact us to be listed</Link>
        </section>

        <p className={styles.note}>
          Details were read from each property&rsquo;s own website between {fmtDate(checked)} and {fmtDate(lastChecked)}. Prices are the rates a stay itself has published, for the dates shown, and are not a quote. Guest scores and star classes are copied from the booking site named on each card, on the date shown, and are based on its verified guest reviews. Khabar Darjeeling does not rate stays itself, and a listing is not a recommendation. Khabar Darjeeling does not take bookings or payments. Confirm rates, availability and cancellation terms with the stay before you pay.
        </p>
      </div>

      {enquiring && <EnquiryDialog stay={enquiring} trip={trip} onClose={() => setEnquiring(null)} />}
      {googleFor && <GooglePhotosDialog stay={googleFor} onClose={() => setGoogleFor(null)} />}
    </>
  );
}

function EnquiryDialog({ stay, trip, onClose }: { stay: Stay; trip: Trip; onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const text = enquiryText(stay, trip, name, phone);
  const [body, setBody] = useState(text);
  const [edited, setEdited] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => { if (!edited) setBody(text); }, [text, edited]);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    opener.current = document.activeElement;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  const copy = async () => {
    try { await navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="enq-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
        <p className={styles.tag}>Enquiry</p>
        <h2 id="enq-title" className={styles.dialogTitle}>{stay.name}</h2>
        <p className={styles.dialogSub}>{tripSummary(trip)}</p>

        <div className={styles.dialogRow}>
          <label className={styles.f}><span>Your name</span><input ref={first} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label className={styles.f}><span>Your phone (optional)</span><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" /></label>
        </div>
        <label className={styles.f}>
          <span>Message</span>
          <textarea rows={9} value={body} onChange={(e) => { setBody(e.target.value); setEdited(true); }} />
        </label>

        <div className={styles.dialogActions}>
          {stay.email && <a className={styles.cta} href={`mailto:${stay.email}?subject=${encodeURIComponent('Enquiry from Khabar Darjeeling')}&body=${encodeURIComponent(body)}`}>Send by email</a>}
          {stay.phones[0] && <a className={stay.email ? styles.altBtn : styles.cta} href={telHref(stay.phones[0])}>Call {stay.phones[0]}</a>}
          <button type="button" className={styles.altBtn} onClick={copy}>{copied ? 'Copied' : 'Copy message'}</button>
          {!stay.email && !stay.phones[0] && <a className={styles.cta} href={stay.bookingUrl || stay.website} target="_blank" rel="noopener noreferrer">Open their website</a>}
        </div>
        <p className={styles.dialogNote}>This opens your own email app or phone. Khabar Darjeeling does not receive or store what you write.</p>
      </div>
    </div>
  );
}

interface GooglePhoto { url: string; width: number; height: number; authors: { name: string; uri: string | null }[] }

// Photos come live from Google Places on each open: Google's terms don't allow storing them, and
// every credit Google returns must stay visible next to the photo, with "Google Maps" as the source.
function GooglePhotosDialog({ stay, onClose }: { stay: Stay; onClose: () => void }) {
  const [data, setData] = useState<{ photos: GooglePhoto[]; mapsUrl: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [i, setI] = useState(0);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/stays/google-photos?stay=' + encodeURIComponent(stay.id));
        const json = await res.json();
        if (!live) return;
        if (!res.ok || !json.photos?.length) setFailed(true);
        else setData(json);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => { live = false; };
  }, [stay.id]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((n) => n + 1);
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; opener?.focus?.(); };
  }, [onClose]);

  const n = data?.photos.length ?? 0;
  const photo = data ? data.photos[Math.min(i, n - 1)] : null;
  const fallbackMaps = mapHref(stay.mapQuery);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.dialog} ${styles.gallery}`} role="dialog" aria-modal="true" aria-labelledby="gp-title" onClick={(e) => e.stopPropagation()}>
        <button ref={closeBtn} type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
        <p className={styles.tag}>Photos from Google Maps</p>
        <h2 id="gp-title" className={styles.dialogTitle}>{stay.name}</h2>

        {!data && !failed && <p className={styles.galleryMsg} aria-live="polite">Loading photos…</p>}
        {failed && (
          <p className={styles.galleryMsg}>
            Photos could not be loaded right now. <a href={fallbackMaps} target="_blank" rel="noopener noreferrer">See {stay.name} on Google Maps</a>.
          </p>
        )}

        {photo && data && (
          <figure className={styles.galleryFig}>
            <div className={styles.galleryImg}>
              <img src={photo.url} alt={`${stay.name}, photo ${Math.min(i, n - 1) + 1} of ${n} from Google Maps`} />
              {n > 1 && <>
                <button type="button" className={styles.galleryPrev} onClick={() => setI((x) => Math.max(0, Math.min(x, n - 1) - 1))} disabled={i === 0} aria-label="Previous photo">‹</button>
                <button type="button" className={styles.galleryNext} onClick={() => setI((x) => Math.min(n - 1, x + 1))} disabled={i >= n - 1} aria-label="Next photo">›</button>
              </>}
            </div>
            <figcaption className={styles.galleryCap}>
              <span>
                {photo.authors.length > 0 && <>Photo: {photo.authors.map((a, k) => (
                  <span key={k}>{k > 0 && ', '}{a.uri ? <a href={a.uri} target="_blank" rel="noopener noreferrer">{a.name}</a> : a.name}</span>
                ))} · </>}
                <strong>Google Maps</strong>
              </span>
              {n > 1 && <span>{Math.min(i, n - 1) + 1} / {n}</span>}
            </figcaption>
            <p className={styles.dialogNote}>
              <a href={data.mapsUrl} target="_blank" rel="noopener noreferrer">See all photos and reviews on Google Maps</a>. Photos are uploaded by the hotel and by Google Maps users and may not show the stay as it is today.
            </p>
          </figure>
        )}
      </div>
    </div>
  );
}
