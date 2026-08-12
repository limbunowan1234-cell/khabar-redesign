'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const endpoint = 'https://api.khabardarjeeling.in/v1';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const ADMIN_EMAIL = 'nowanad@gmail.com';

type Badge = 'dated' | 'watch';

interface DigestItem {
  headline: string;
  summary: string;
  source: string;
  dateLabel: string;
  badge: Badge;
}

interface DigestSection {
  title: string;
  items: DigestItem[];
}

// Fallback content shown until the live digest loads from Appwrite (or if
// nothing has been pushed yet). The daily Cowork scheduled task keeps the
// database copy fresh via POST /api/admin/news-digest — this array is just
// a safety net so the page never renders empty.
const DEFAULT_LAST_VERIFIED = '12 August 2026';

const DEFAULT_DIGEST: DigestSection[] = [
  {
    title: 'Weather & Landslides',
    items: [
      {
        headline: 'Fresh landslide hits Jorebunglow-Simkuna road',
        summary: 'A landslide on the Jorebunglow Simkuna Line has locals urging PWD and district administration not to patch the road quickly — instead widen it, build a proper retaining wall, and add parking, citing the earlier Tindharey landslide repair as a model.',
        source: 'The Darjeeling Chronicle (X/Twitter)',
        dateLabel: '10 Aug 2026',
        badge: 'dated',
      },
      {
        headline: 'Landslides and lightning injury across the Hills',
        summary: 'Incessant rain triggered landslides at Neji, Kaijaley-Kolbung and Fencheytar; a mother and her 17-year-old daughter were injured by a lightning strike at Putung Tea Estate, Mirik, with the daughter admitted to NBMCH Siliguri. A tree fell at Darjeeling Chowrasta; Jalpaiguri town flooded.',
        source: 'Millennium Post',
        dateLabel: '5 Aug 2026',
        badge: 'dated',
      },
      {
        headline: 'IMD flags more rain through mid-August',
        summary: 'Heavy rain is forecast at one or two places in Darjeeling, Jalpaiguri and Alipurduar districts, with light-to-moderate rain and thundershowers across north Bengal expected to continue through 14 August.',
        source: 'IMD / regional wire',
        dateLabel: 'Ongoing',
        badge: 'watch',
      },
    ],
  },
  {
    title: 'Governance & Politics',
    items: [
      {
        headline: 'GTA still without a confirmed chief executive',
        summary: "Anit Thapa resigned as GTA Chief Executive on 17 June, a day after CM Suvendu Adhikari ordered a corruption probe into the administration. Several BGPM Sabhasads followed him out. No confirmed successor has surfaced in coverage since — worth a direct follow-up call to GTA sources.",
        source: 'The Federal / ETV Bharat',
        dateLabel: '17 Jun 2026',
        badge: 'dated',
      },
      {
        headline: 'Speculation builds around Ajoy Edwards for GTA chair',
        summary: "A Darjeeling Chronicle column notes that Hamro Party's Ajoy Edwards and his Sabhasads never resigned from GTA, unlike Thapa's BGPM camp — raising talk that Edwards may angle for the chairmanship despite Hamro Party's diminished standing.",
        source: 'The Darjeeling Chronicle (opinion)',
        dateLabel: '26 Jun 2026',
        badge: 'dated',
      },
      {
        headline: 'Digital birth certificate issuance stalled in the Hills',
        summary: 'A reader letter to The Darjeeling Chronicle says Gram Panchayats have suspended new digital birth certificates while old records are verified — blocking students from passports, caste certificates and scholarships. Local elected representatives have been largely silent on it.',
        source: 'Reader letter, The Darjeeling Chronicle',
        dateLabel: 'Recent',
        badge: 'watch',
      },
    ],
  },
  {
    title: 'Civic & Infrastructure',
    items: [
      {
        headline: "Kurseong hospital's digital X-ray machine moved indoors",
        summary: 'After a reader flagged that Kurseong Sub-Divisional Hospital’s digital X-ray machine had been left outside in the rain, the Darjeeling District Magistrate stepped in and had it shifted indoors — though the outlet noted hospital staff hadn’t raised the issue themselves.',
        source: 'The Darjeeling Chronicle',
        dateLabel: 'Recent',
        badge: 'watch',
      },
      {
        headline: 'Metro rail floated for Siliguri-Jalpaiguri corridor',
        summary: 'CM Suvendu Adhikari has proposed metro corridors linking Asansol, Durgapur, Siliguri and Jalpaiguri, with the Chief Secretary asked to prepare detailed project reports. Initial planning outlay is pegged near ₹100 crore, with possible World Bank, ADB and HUDCO funding.',
        source: 'Metro Rail News / Construction World',
        dateLabel: 'Developing',
        badge: 'watch',
      },
    ],
  },
  {
    title: 'Tourism',
    items: [
      {
        headline: "Locals push monsoon as Darjeeling's hidden season",
        summary: 'The Darjeeling Chronicle is actively encouraging travellers to visit during monsoon instead of only peak April-June and October-January windows, pitching empty streets and mist-drenched views over crowd-free hills.',
        source: 'The Darjeeling Chronicle (X/Twitter)',
        dateLabel: '10 Aug 2026',
        badge: 'dated',
      },
      {
        headline: 'Toy train service back in operation',
        summary: 'The Darjeeling Himalayan Railway has resumed its heritage toy train run between New Jalpaiguri and Darjeeling, a key draw for the region’s tourism economy.',
        source: 'Regional tourism coverage',
        dateLabel: 'Recent',
        badge: 'watch',
      },
    ],
  },
  {
    title: 'Tea & Economy',
    items: [
      {
        headline: 'Dry winter dents First Flush quality',
        summary: 'Erratic, drier winter weather has made for another difficult harvest, with estate owners worried the signature Darjeeling flavour is at risk as climate patterns shift in the Himalayan foothills.',
        source: 'CBC News / trade coverage',
        dateLabel: '2026 season',
        badge: 'watch',
      },
      {
        headline: 'Tea estate villages losing young workers to migration',
        summary: "Around estates like Margaret's Hope, community elders describe villages emptying of young people, compounding wage struggles for the women who still work the gardens.",
        source: 'Matters India',
        dateLabel: 'Mar 2026',
        badge: 'watch',
      },
    ],
  },
  {
    title: 'Sports',
    items: [
      {
        headline: 'Ghoom Jorebunglow SC into Herlihy Cup semis',
        summary: 'Reigning champions Ghoom Jorebunglow Sporting Club beat Red FC Ilam (Nepal) 1-0 to advance to the semi-finals of the Herlihy Cup.',
        source: 'The Darjeeling Chronicle (X/Twitter)',
        dateLabel: '10 Aug 2026',
        badge: 'dated',
      },
    ],
  },
];

function badgeStyle(badge: Badge): React.CSSProperties {
  return {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.4px',
    padding: '3px 9px',
    borderRadius: '999px',
    color: 'white',
    backgroundColor: badge === 'dated' ? '#0F4C5C' : '#c41e3a',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}

export default function NewsDigestAdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [digest, setDigest] = useState<DigestSection[]>(DEFAULT_DIGEST);
  const [lastVerified, setLastVerified] = useState(DEFAULT_LAST_VERIFIED);
  const [isLive, setIsLive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  async function getAdminJwt(): Promise<string | null> {
    const jwtRes = await fetch(endpoint + '/account/jwt', { method: 'POST', headers: H, credentials: 'include' });
    if (!jwtRes.ok) return null;
    const { jwt } = await jwtRes.json();
    return jwt;
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError('');
    try {
      const jwt = await getAdminJwt();
      if (!jwt) {
        setRefreshError('Could not verify admin session.');
        return;
      }
      const res = await fetch('/api/admin/news-digest/refresh', {
        method: 'POST',
        headers: { 'x-admin-jwt': jwt },
      });
      const data = await res.json();
      if (!res.ok) {
        setRefreshError(data.error || 'Refresh failed.');
        return;
      }
      const parsed = JSON.parse(data.digest.sectionsJson);
      setDigest(parsed);
      setLastVerified(data.digest.lastVerified);
      setIsLive(true);
    } catch {
      setRefreshError('Refresh failed. Try again.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(endpoint + '/account', { headers: H, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const labels = (data as any).labels || [];
          const isAdmin = data.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
          if (!isAdmin) {
            setError('Access denied. Admin only.');
            setLoading(false);
            return;
          }
          setUser(data);
          setLoading(false);
          await loadLiveDigest();
        } else {
          setError('Please log in as admin.');
          setLoading(false);
        }
      } catch {
        setError('Failed to verify access.');
        setLoading(false);
      }
    }
    async function loadLiveDigest() {
      try {
        const jwtRes = await fetch(endpoint + '/account/jwt', { method: 'POST', headers: H, credentials: 'include' });
        if (!jwtRes.ok) return;
        const { jwt } = await jwtRes.json();
        const res = await fetch('/api/admin/news-digest', { headers: { 'x-admin-jwt': jwt } });
        if (!res.ok) return;
        const { digest: stored } = await res.json();
        if (stored && stored.sectionsJson) {
          const parsed = JSON.parse(stored.sectionsJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDigest(parsed);
            setLastVerified(stored.lastVerified || DEFAULT_LAST_VERIFIED);
            setIsLive(true);
          }
        }
      } catch {
        // Fall back silently to the bundled default digest.
      }
    }
    checkAuth();
  }, []);

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'system-ui' }}>Loading...</div>;

  if (error || !user) return (
    <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'system-ui' }}>
      <p style={{ color: '#c41e3a', marginBottom: '20px' }}>{error || 'Please log in as admin.'}</p>
      <Link href="/auth"><button style={{ backgroundColor: '#0F4C5C', color: 'white', padding: '12px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Login</button></Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ backgroundColor: '#0F4C5C', color: 'white', padding: '16px 20px', borderBottom: '4px solid #D4AF37', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <Link href="/admin"><button style={{ backgroundColor: 'transparent', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '4px', display: 'block', padding: 0 }}>Back to Admin</button></Link>
            <h1 style={{ margin: 0, fontSize: '20px' }}>News Digest</h1>
          </div>
          <div style={{ fontSize: '12px', color: '#dcecef', textAlign: 'right' }}>
            <div>Last verified: <strong>{lastVerified}</strong></div>
            <div style={{ marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.12)', padding: '3px 10px', borderRadius: '999px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isLive ? '#6fbf73' : '#D4AF37', display: 'inline-block' }} />
              {isLive ? 'Live — auto-refreshes daily' : 'Showing bundled fallback content'}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                marginTop: '8px',
                display: 'block',
                marginLeft: 'auto',
                backgroundColor: refreshing ? 'rgba(255,255,255,0.2)' : '#D4AF37',
                color: refreshing ? '#dcecef' : '#0F4C5C',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: refreshing ? 'default' : 'pointer',
              }}
            >
              {refreshing ? 'Refreshing…' : 'Refresh now (free)'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px 60px' }}>
        {refreshError && (
          <div style={{ padding: '10px 16px', backgroundColor: '#fdecea', border: '1px solid #f3b4ac', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#a3271e' }}>
            {refreshError}
          </div>
        )}
        <div style={{ padding: '14px 18px', backgroundColor: '#fff7e8', border: '1px solid #f0dfb8', borderRadius: '10px', marginBottom: '28px', fontSize: '13px', color: '#6b5b2a' }}>
          Curated regional news for editorial planning — Darjeeling, Kalimpong, Kurseong, Mirik, Siliguri and the wider Gorkha region. Dates shown are each story&apos;s original publish date. Items marked &ldquo;Recent&rdquo;, &ldquo;Watch&rdquo; or &ldquo;Developing&rdquo; don&apos;t have a precise public timestamp yet — verify before using as a dateline. Pulling fresh headlines via the free-RSS refresh replaces the curated summaries with raw wire headlines — re-editorialize before publishing.
        </div>

        {digest.map((section) => (
          <div key={section.title} style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: '#c41e3a', fontWeight: 800, marginBottom: '12px', borderBottom: '2px solid #eee', paddingBottom: '8px' }}>
              {section.title}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {section.items.map((item) => (
                <div key={item.headline} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <p style={{ fontSize: '15px', fontWeight: 700, margin: 0, lineHeight: 1.35 }}>{item.headline}</p>
                    <span style={badgeStyle(item.badge)}>{item.dateLabel}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#3a3630', margin: 0, lineHeight: 1.5 }}>{item.summary}</p>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0, paddingTop: '6px', borderTop: '1px dashed #eee' }}>{item.source}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
