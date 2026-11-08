'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Stay } from '@/lib/stays';
import styles from './Stays.module.css';

type Filter = 'all' | Stay['group'];
type Sort = 'featured' | 'name' | 'price';

const TYPES: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All stays' },
  { id: 'heritage', label: 'Heritage & tea estates' },
  { id: 'local', label: 'Local hotels' },
];

const telHref = (p: string) => 'tel:' + p.replace(/[^+\d]/g, '');
const mapHref = (q: string) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
const fmtDate = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtShort = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const nightsBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400e3);
// first number in the published summary, used only to sort ("From ₹13,000 a night" -> 13000)
const priceKey = (s: Stay) => { const m = s.pricing?.summary.replace(/,/g, '').match(/\d+/); return m ? Number(m[0]) : Infinity; };

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
  const [type, setType] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('featured');
  const [ratesOnly, setRatesOnly] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip>({ checkIn: '', checkOut: '', adults: 2, children: 0, rooms: 1 });
  const [enquiring, setEnquiring] = useState<Stay | null>(null);

  // today in IST, set after mount so server and client markup match
  useEffect(() => { setToday(new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10)); }, []);

  const list = useMemo(() => {
    let out = stays.filter((s) => (type === 'all' || s.group === type) && (!ratesOnly || !!s.pricing));
    if (sort === 'name') out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'price') out = [...out].sort((a, b) => priceKey(a) - priceKey(b));
    return out;
  }, [stays, type, sort, ratesOnly]);

  const setCheckIn = (v: string) => setTrip((t) => ({
    ...t, checkIn: v,
    checkOut: v && (!t.checkOut || nightsBetween(v, t.checkOut) < 1) ? addDays(v, 1) : t.checkOut,
  }));

  return (
    <>
      <section className={styles.hero}>
        <img className={styles.heroImg} src="/stays/glenburn.jpg" alt="" />
        <div className={styles.heroShade} />
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Khabar Darjeeling Stays</p>
          <h1 className={styles.h1}>Trusted by Locals, Loved by Travelers</h1>
          <p className={styles.lead}>Heritage hotels, tea estate bungalows and local hotels in the hills. See each stay&rsquo;s own rates and contact them directly. No booking fees.</p>
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
            <input value="Darjeeling & the hills" readOnly aria-readonly="true" />
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
          <li>You deal directly with the stay</li>
          <li>No booking fees</li>
        </ul>

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
              <option value="name">Name A to Z</option>
              <option value="price">Published price, low to high</option>
            </select>
          </label>
        </div>

        <p className={styles.count} aria-live="polite">{list.length} stay{list.length === 1 ? '' : 's'} in Darjeeling and the hills · {tripSummary(trip)}</p>

        {list.length === 0 && <p className={styles.empty}>No stays match these filters. Try clearing &ldquo;Rates published&rdquo;.</p>}

        <ul className={styles.results}>
          {list.map((s) => {
            const expired = !!(s.pricing && today && today > s.pricing.validTo);
            return (
              <li key={s.id} className={styles.card}>
                <div className={styles.media}>
                  {s.photo ? (
                    <>
                      <img src={s.photo.src} alt={s.photo.alt} loading="lazy" />
                      <p className={styles.credit}>
                        {s.photo.caption ? s.photo.caption + ' · ' : ''}{s.photo.author},{' '}
                        <a href={s.photo.licenseUrl} target="_blank" rel="noopener noreferrer">{s.photo.license}</a>,{' '}
                        <a href={s.photo.sourceUrl} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>
                      </p>
                    </>
                  ) : (
                    <div className={styles.noPhoto} aria-hidden="true"><span>{s.name.charAt(0)}</span><small>Photo coming soon</small></div>
                  )}
                </div>

                <div className={styles.body}>
                  <p className={styles.tag}>{s.tag}</p>
                  <h2 className={styles.name}>{s.name}</h2>
                  <p className={styles.area}>
                    <a href={mapHref(s.mapQuery)} target="_blank" rel="noopener noreferrer">{s.area}</a>
                  </p>
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
          })}
        </ul>

        <section className={styles.listCta}>
          <div>
            <h2>Run a stay in the hills?</h2>
            <p>Get listed here. Send us your property&rsquo;s name, area, phone, email and website and we will check them before adding you.</p>
          </div>
          <Link href="/contact" className={styles.listBtn}>Contact us to be listed</Link>
        </section>

        <p className={styles.note}>
          Details were read from each property&rsquo;s own website on {fmtDate(checked)}. Prices are the rates a stay itself has published, for the dates shown, and are not a quote. Khabar Darjeeling does not take bookings or payments, and a listing is not a recommendation or a rating. Confirm rates, availability and cancellation terms with the stay before you pay.
        </p>
      </div>

      {enquiring && <EnquiryDialog stay={enquiring} trip={trip} onClose={() => setEnquiring(null)} />}
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
