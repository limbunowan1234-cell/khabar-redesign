'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT };

const DOT_COLORS = ['#c41e3a', '#2e7d32', '#7b1fa2', '#e65100', '#1565c0', '#00838f'];

function fmtDateRange(articles: any[]): string {
  if (articles.length === 0) return '';
  const dates = articles.map(a => new Date(a.publishedAt || a.$createdAt)).sort((a, b) => a.getTime() - b.getTime());
  const start = dates[0];
  const end = dates[dates.length - 1];
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  return start.toLocaleDateString('en-US', opts) + ' - ' + end.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
}

function getImageUrl(fileId: string): string {
  if (!fileId) return '';
  return '/api/image-proxy?id=' + fileId;
}

export default function WeeklyPage() {
  const [allIssues, setAllIssues] = useState<number[]>([]);
  const [currentIssue, setCurrentIssue] = useState<number | null>(null);
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pdfMode, setPdfMode] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  async function waitForImages(container: HTMLElement) {
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(imgs.map((img) => {
      if ((img as HTMLImageElement).complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener('load', resolve);
        img.addEventListener('error', resolve);
        setTimeout(resolve, 5000);
      });
    }));
  }

  async function downloadPdf() {
    if (!printRef.current || !(window as any).html2pdf) return;
    setDownloading(true);
    setPdfMode(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (printRef.current) await waitForImages(printRef.current);
    const opt = {
      margin: 0.3,
      filename: 'Khabar-Darjeeling-Weekly-Issue-' + String(currentIssue).padStart(2, '0') + '.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    try {
      await (window as any).html2pdf().set(opt).from(printRef.current).save();
    } catch (e) {
      console.error(e);
    }
    setPdfMode(false);
    setDownloading(false);
  }


  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const wantsPreview = params.get('preview') === 'true';
        const issueParam = params.get('issue');

        const authRes = await fetch(ENDPOINT + '/account', { headers: H, credentials: 'include' });
        const authData = authRes.ok ? await authRes.json() : null;
        const adminCheck = authData?.labels?.includes('admin') || authData?.email === 'nowanad@gmail.com';
        setIsAdmin(!!adminCheck);

        const liveField = (wantsPreview && adminCheck) ? 'isWeeklyPick' : 'weeklyLive';
        setPreviewMode(wantsPreview && adminCheck);

        const q = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: liveField, values: [true] }));
        const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + q + '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [200] })), { headers: H, credentials: 'include' });
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        const docs = data.documents || [];

        const issueNumbers = Array.from(new Set(docs.map((d: any) => d.weeklyIssue).filter(Boolean))).sort((a: any, b: any) => b - a) as number[];
        setAllIssues(issueNumbers);

        const targetIssue = issueParam ? parseInt(issueParam) : issueNumbers[0];
        setCurrentIssue(targetIssue || null);

        const issueArticles = docs.filter((d: any) => d.weeklyIssue === targetIssue);
        setArticles(issueArticles);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid #eee', borderTopColor: '#c41e3a', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!currentIssue || articles.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px' }}>No edition yet</h2>
        <p style={{ color: '#888', fontSize: '14px' }}>Check back Sunday for the next issue of Khabar Darjeeling Weekly.</p>
        <Link href="/" style={{ color: '#c41e3a', fontWeight: 700, textDecoration: 'none', marginTop: '10px' }}>Back to Home</Link>
      </div>
    );
  }

  const lead = articles.find((a: any) => a.isWeeklyLead) || articles[0];
  const secondary = articles.filter((a: any) => a.$id !== lead.$id);
  const dateRange = fmtDateRange(articles);
  const leadImg = getImageUrl(lead.imageFileId);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fdfaf5', paddingBottom: '60px' }}>
      {previewMode && (
        <div style={{ backgroundColor: '#7a1f1f', color: '#fff', textAlign: 'center', padding: '10px', fontSize: '13px', fontWeight: 700 }}>
          PREVIEW MODE - This issue is not live yet
        </div>
      )}

      <div className='weekly-container' style={{ margin: '0 auto', padding: '20px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href='/' style={{ color: '#c41e3a', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>&larr; Back to Home</Link>
        <button onClick={downloadPdf} disabled={downloading} style={{ backgroundColor: '#c41e3a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: downloading ? 0.6 : 1 }}>{downloading ? 'Preparing PDF...' : 'Download PDF'}</button>
      </div>

      <style>{`.weekly-container { max-width: 680px; } .weekly-sections { column-count: 1; } @media (min-width: 900px) { .weekly-container { max-width: 920px; } .weekly-sections { column-count: 2; column-gap: 32px; column-rule: 1px solid #eee; } .weekly-section-item { break-inside: avoid; } }`}</style>
      <div ref={printRef} className='weekly-container' style={{ margin: '20px auto 0', backgroundColor: '#fff', border: '1px solid #e5e0d5', borderRadius: '4px', overflow: 'hidden' }}>

        <div style={{ padding: '24px 28px 18px', borderBottom: '3px double #1a1a1a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginBottom: '10px' }}>
            <span>Issue No. {String(currentIssue).padStart(2, '0')}</span>
            <span>{dateRange}</span>
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '32px', fontWeight: 500, textAlign: 'center', letterSpacing: '1px', margin: 0, color: '#1a1a1a' }}>Khabar Darjeeling Weekly</h1>
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#c41e3a', letterSpacing: '3px', textTransform: 'uppercase', margin: '8px 0 0', fontWeight: 700 }}>Voice of Hills</p>
        </div>

        <div onClick={() => setExpandedId(expandedId === lead.$id ? null : lead.$id)} style={{ cursor: 'pointer' }}>
          <div style={{ padding: '22px 28px', borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'inline-block', backgroundColor: '#fbe4e4', color: '#c41e3a', fontSize: '11px', fontWeight: 700, padding: '3px 12px', borderRadius: '3px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lead Story</div>
            {leadImg && (
              <div style={{ width: '100%', maxHeight: '320px', borderRadius: '4px', overflow: 'hidden', marginBottom: '14px', backgroundColor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={leadImg} alt={lead.title} crossOrigin='anonymous' style={{ width: '100%', maxHeight: '320px', objectFit: 'contain' }} />
              </div>
            )}
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: 500, lineHeight: 1.3, margin: '0 0 10px', color: '#1a1a1a' }}>{lead.title}</h2>
            <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
              {(pdfMode || expandedId === lead.$id) ? (lead.content || '').replace(/<[^>]*>/g, '') : (lead.content || '').replace(/<[^>]*>/g, '').slice(0, 160) + '...'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#888' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#c41e3a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                  {(lead.submitterName || lead.authorName || 'S').charAt(0).toUpperCase()}
                </div>
                <span>By {lead.submitterName || lead.authorName || 'Staff Reporter'}</span>
              </div>
              {expandedId === lead.$id && (
                <Link href={'/article/' + (lead.slug || lead.$id)} onClick={(e) => e.stopPropagation()} style={{ fontSize: '12px', fontWeight: 700, color: '#c41e3a', textDecoration: 'none' }}>Comments &amp; more -&gt;</Link>
              )}
            </div>
          </div>
        </div>

        {secondary.length > 0 && (() => {
          const bySection: Record<string, any[]> = {};
          for (const a of secondary) {
            const sec = a.weeklySection || 'More This Week';
            if (!bySection[sec]) bySection[sec] = [];
            bySection[sec].push(a);
          }
          const sectionNames = Object.keys(bySection);
          let dotIdx = 0;
          return (
            <div className='weekly-sections' style={{ padding: '18px 28px' }}>
              {sectionNames.map((sectionName) => {
                const items = bySection[sectionName];
                return (
                  <div key={sectionName} className='weekly-section-item' style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#c41e3a', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px', borderBottom: '2px solid #c41e3a', paddingBottom: '6px' }}>{sectionName}</p>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {items.map((a: any, i: number) => {
                        const color = DOT_COLORS[dotIdx % DOT_COLORS.length];
                        dotIdx++;
                        return (
                          <div key={a.$id} onClick={() => setExpandedId(expandedId === a.$id ? null : a.$id)} style={{ cursor: 'pointer', padding: '12px 0', borderBottom: i < items.length - 1 ? '1px solid #eee' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                              {getImageUrl(a.imageFileId) && (
                                <div style={{ width: '48px', height: '48px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#eee', flexShrink: 0 }}>
                                  <img src={getImageUrl(a.imageFileId)} alt={a.title} crossOrigin='anonymous' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.4 }}>{a.title}</div>
                                <div style={{ fontSize: '12px', color: '#999', marginTop: '3px' }}>By {a.submitterName || a.authorName || 'Staff Reporter'}</div>
                              </div>
                            </div>
                            {(pdfMode || expandedId === a.$id) && (
                              <div style={{ marginTop: '10px', paddingLeft: '18px' }}>
                                <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{(a.content || '').replace(/<[^>]*>/g, '')}</p>
                                <Link href={'/article/' + (a.slug || a.$id)} onClick={(e) => e.stopPropagation()} style={{ fontSize: '12px', fontWeight: 700, color: '#c41e3a', textDecoration: 'none' }}>Comments &amp; more -&gt;</Link>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {allIssues.length > 1 && (
          <div style={{ padding: '14px 28px', backgroundColor: '#f7f4ee', textAlign: 'center', borderTop: '1px solid #e5e0d5' }}>
            <span style={{ fontSize: '12px', color: '#666', marginRight: '10px' }}>Back issues:</span>
            {allIssues.filter(n => n !== currentIssue).map((n) => (
              <Link key={n} href={'/weekly?issue=' + n} style={{ fontSize: '12px', color: '#c41e3a', textDecoration: 'none', marginRight: '10px', fontWeight: 600 }}>
                Issue {String(n).padStart(2, '0')}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
