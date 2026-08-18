'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

// Routed through /api/image-proxy (same-origin) rather than Appwrite's
// storage URL directly. html2canvas needs to read the image's pixels to
// draw it into the export canvas, which requires either a same-origin
// image or a CORS-clean cross-origin load — a same-origin proxy sidesteps
// the whole question instead of depending on Appwrite's CORS config
// matching whatever origin the page happens to be served from.
function getImageUrl(a: any): string {
  const id = a?.imageFileId;
  if (!id || ['Text', 'null', 'undefined', ''].includes(String(id))) return '';
  if (String(id).startsWith('http')) return id;
  return '/api/image-proxy?id=' + id + '&bucket=article-image';
}

function shortDescription(article: any): string {
  const raw = (article?.content || article?.sideHeader || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return raw.length > 220 ? raw.slice(0, 220).trim() + '…' : raw;
}

interface Props {
  darjeelingArticles: any[];
  otherDistrictArticles: any[];
  topHeadline: any;
  otherNews: any[];
}

export default function DailyUpdatesPosterClient({ darjeelingArticles, otherDistrictArticles, topHeadline, otherNews }: Props) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'image' | 'pdf' | null>(null);
  const [status, setStatus] = useState('');

  const selectedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const year = new Date().getFullYear();

  async function downloadPoster(format: 'image' | 'pdf') {
    if (!posterRef.current) return;
    setDownloading(true);
    setDownloadFormat(format);
    setStatus('Generating…');
    try {
      // html2canvas snapshots whatever is currently painted — if the
      // headline image hasn't finished loading yet, it captures blank.
      const imgs = Array.from(posterRef.current.querySelectorAll('img'));
      await Promise.all(imgs.map((img) => (img.complete && img.naturalWidth > 0) ? Promise.resolve() : new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      })));

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(posterRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      if (format === 'image') {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `KhabarDarjeeling-DailyUpdates-${selectedDate.replace(/\s+/g, '-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const { jsPDF } = await import('jspdf');
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`KhabarDarjeeling-DailyUpdates-${selectedDate.replace(/\s+/g, '-')}.pdf`);
      }
      setStatus((format === 'image' ? 'PNG' : 'PDF') + ' downloaded!');
    } catch (err) {
      console.error('Download failed:', err);
      setStatus('Download failed — try again.');
    }
    setDownloading(false);
    setDownloadFormat(null);
    setTimeout(() => setStatus(''), 3000);
  }

  const headlineImg = getImageUrl(topHeadline);

  return (
    <div className="du-page">
      <style>{`
        .du-page { min-height: 100vh; background-color: #f3f4f6; padding: 32px 16px; }
        .du-controls { max-width: 900px; margin: 0 auto 24px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between; background-color: white; padding: 16px; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
        .du-controls-btns { display: flex; gap: 10px; flex-wrap: wrap; }
        .du-btn { display: flex; align-items: center; gap: 8px; padding: 10px 18px; color: white; font-weight: 700; font-size: 14px; border: none; border-radius: 8px; }
        .du-poster-wrap { max-width: 900px; margin: 0 auto; }
        .du-header { background-color: white; border-bottom: 4px solid #f59e0b; padding: 44px 32px; text-align: center; }
        .du-title { font-size: 46px; font-weight: 900; letter-spacing: -1px; color: #1f2937; margin: 0 0 12px; }
        .du-subtitle { color: #4b5563; font-size: 17px; margin: 0 0 18px; }
        .du-meta { display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 15px; color: #4b5563; }
        .du-date { font-weight: 700; font-size: 18px; }
        .du-content { padding: 28px 32px; }
        .du-news-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
        .du-col-header { background-color: #fcd34d; color: #1f2937; padding: 14px 18px; font-weight: 900; font-size: 16px; letter-spacing: 0.4px; }
        .du-col-body { background-color: #fffbeb; border: 2px solid #fcd34d; padding: 20px; min-height: 280px; }
        .du-headline-tag { background-color: #dc2626; color: white; padding: 14px 20px; font-weight: 900; font-size: 18px; display: flex; align-items: center; gap: 10px; letter-spacing: 0.4px; }
        .du-headline-body { padding: 26px; }
        .du-headline-title { font-size: 26px; font-weight: 900; color: #1f2937; margin: 0 0 10px; line-height: 1.25; }
        .du-headline-desc { font-size: 15px; line-height: 1.6; color: #374151; margin: 0; }
        .du-other { border: 4px solid #1f2937; padding: 26px; background-color: white; }
        .du-other h3 { font-size: 20px; font-weight: 900; color: #1f2937; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.4px; }
        .du-footer { background-color: #f3f4f6; border-top: 1px solid #e5e7eb; padding: 20px 32px; text-align: center; color: #4b5563; font-size: 13px; }

        @media (max-width: 640px) {
          .du-page { padding: 16px 10px; }
          .du-controls { padding: 12px; gap: 10px; margin-bottom: 16px; }
          .du-btn { padding: 9px 14px; font-size: 12px; }
          .du-header { padding: 24px 16px; }
          .du-title { font-size: 27px; letter-spacing: -0.5px; margin-bottom: 8px; }
          .du-subtitle { font-size: 13px; margin-bottom: 12px; }
          .du-meta { font-size: 12px; gap: 8px; }
          .du-date { font-size: 14px; }
          .du-content { padding: 16px 14px; }
          .du-news-grid { grid-template-columns: 1fr; gap: 14px; margin-bottom: 18px; }
          .du-col-header { padding: 10px 14px; font-size: 13px; }
          .du-col-body { padding: 14px; min-height: 0; }
          .du-headline-tag { padding: 10px 14px; font-size: 14px; }
          .du-headline-body { padding: 16px; }
          .du-headline-title { font-size: 19px; margin-bottom: 6px; }
          .du-headline-desc { font-size: 13px; }
          .du-other { padding: 16px; border-width: 3px; }
          .du-other h3 { font-size: 15px; margin-bottom: 10px; }
          .du-footer { padding: 14px 16px; font-size: 11px; }
        }
      `}</style>

      {/* Download controls */}
      <div className="du-controls">
        <div className="du-controls-btns">
          <button
            onClick={() => downloadPoster('image')}
            disabled={downloading}
            className="du-btn"
            style={{ backgroundColor: downloading ? '#9ca3af' : '#d97706', cursor: downloading ? 'default' : 'pointer' }}
          >
            {downloading && downloadFormat === 'image' ? '⏳' : '⬇️'} Download as PNG
          </button>
          <button
            onClick={() => downloadPoster('pdf')}
            disabled={downloading}
            className="du-btn"
            style={{ backgroundColor: downloading ? '#9ca3af' : '#dc2626', cursor: downloading ? 'default' : 'pointer' }}
          >
            {downloading && downloadFormat === 'pdf' ? '⏳' : '⬇️'} Download as PDF
          </button>
        </div>
        <span style={{ fontSize: '13px', color: '#4b5563' }}>{status || 'Save as poster image or PDF'}</span>
      </div>

      {/* Poster */}
      <div className="du-poster-wrap">
        <div ref={posterRef} style={{ backgroundColor: '#f9fafb' }}>
          <div className="du-header">
            <h1 className="du-title">DAILY UPDATES</h1>
            <p className="du-subtitle">
              In Association with <strong style={{ color: '#b45309' }}>Khabar Darjeeling</strong>
            </p>
            <div className="du-meta">
              <span className="du-date">📅 {selectedDate}</span>
              <span>•</span>
              <span style={{ color: '#6b7280' }}>To help you stay informed…</span>
            </div>
          </div>

          <div className="du-content">
            {/* Two-column news */}
            <div className="du-news-grid">
              <NewsColumn title="• DARJEELING •" articles={darjeelingArticles} />
              <NewsColumn title="• KALIMPONG, KURSEONG & BEYOND •" articles={otherDistrictArticles} />
            </div>

            {/* Top headline */}
            <div style={{ marginBottom: '28px' }}>
              <div className="du-headline-tag">📈 TOP HEADLINE OF THE DAY</div>
              <div style={{ backgroundColor: 'white', border: '2px solid #dc2626' }}>
                {topHeadline ? (
                  <>
                    <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#d1d5db', overflow: 'hidden' }}>
                      {headlineImg ? (
                        <img src={headlineImg} alt={topHeadline.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #c41e3a, #a01830)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '48px', opacity: 0.4 }}>📰</span>
                        </div>
                      )}
                    </div>
                    <div className="du-headline-body">
                      <h2 className="du-headline-title">{topHeadline.title}</h2>
                      {shortDescription(topHeadline) && (
                        <p className="du-headline-desc">{shortDescription(topHeadline)}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>No headline available yet.</div>
                )}
              </div>
            </div>

            {/* Other news */}
            <div className="du-other">
              <h3>In Other News…</h3>
              {otherNews.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>No additional stories right now.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {otherNews.map((a, i) => (
                    <li key={a.$id} style={{ display: 'flex', gap: '10px', marginBottom: i < otherNews.length - 1 ? '14px' : 0, fontSize: '15px', lineHeight: 1.5, color: '#1f2937', fontWeight: 500 }}>
                      <span style={{ color: '#1f2937', fontWeight: 700, flexShrink: 0 }}>•</span>
                      <span>{a.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="du-footer">
            <p style={{ margin: 0 }}>© {year} Khabar Darjeeling | Bringing you daily updates from Darjeeling and beyond</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '20px auto 0', backgroundColor: 'white', padding: '14px 18px', borderRadius: '8px', borderLeft: '4px solid #f59e0b', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', fontSize: '13px', color: '#374151' }}>
        <strong>💡 Tip:</strong> Download as PNG to share on WhatsApp, Facebook, or Instagram, or PDF for printing.
      </div>

      <div style={{ maxWidth: '900px', margin: '14px auto 0', textAlign: 'center' }}>
        <Link href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>← Back to Home</Link>
      </div>
    </div>
  );
}

function NewsColumn({ title, articles }: { title: string; articles: any[] }) {
  return (
    <div>
      <div className="du-col-header">{title}</div>
      <div className="du-col-body">
        {articles.length === 0 ? (
          <p style={{ color: '#a3824a', fontSize: '13px', margin: 0 }}>No recent stories yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {articles.map((a, i) => (
              <li key={a.$id} style={{ display: 'flex', gap: '10px', marginBottom: i < articles.length - 1 ? '14px' : 0, fontSize: '14px', lineHeight: 1.5, color: '#1f2937', fontWeight: 500 }}>
                <span style={{ color: '#b45309', fontWeight: 700, flexShrink: 0, fontSize: '17px' }}>•</span>
                <span>{a.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
