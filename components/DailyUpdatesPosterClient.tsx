'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const BUCKET = 'article-image';

function getImageUrl(a: any): string {
  const id = a?.imageFileId;
  if (!id || ['Text', 'null', 'undefined', ''].includes(String(id))) return '';
  if (String(id).startsWith('http')) return id;
  return ENDPOINT + '/storage/buckets/' + BUCKET + '/files/' + id + '/view?project=' + PROJECT;
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '32px 16px' }}>
      {/* Download controls */}
      <div style={{ maxWidth: '900px', margin: '0 auto 24px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => downloadPoster('image')}
            disabled={downloading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', backgroundColor: downloading ? '#9ca3af' : '#d97706', color: 'white', fontWeight: 700, fontSize: '14px', border: 'none', borderRadius: '8px', cursor: downloading ? 'default' : 'pointer' }}
          >
            {downloading && downloadFormat === 'image' ? '⏳' : '⬇️'} Download as PNG
          </button>
          <button
            onClick={() => downloadPoster('pdf')}
            disabled={downloading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', backgroundColor: downloading ? '#9ca3af' : '#dc2626', color: 'white', fontWeight: 700, fontSize: '14px', border: 'none', borderRadius: '8px', cursor: downloading ? 'default' : 'pointer' }}
          >
            {downloading && downloadFormat === 'pdf' ? '⏳' : '⬇️'} Download as PDF
          </button>
        </div>
        <span style={{ fontSize: '13px', color: '#4b5563' }}>{status || 'Save as poster image or PDF'}</span>
      </div>

      {/* Poster */}
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div ref={posterRef} style={{ backgroundColor: '#f9fafb' }}>
          <div style={{ backgroundColor: 'white', borderBottom: '4px solid #f59e0b', padding: '44px 32px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '46px', fontWeight: 900, letterSpacing: '-1px', color: '#1f2937', margin: '0 0 12px' }}>DAILY UPDATES</h1>
            <p style={{ color: '#4b5563', fontSize: '17px', margin: '0 0 18px' }}>
              In Association with <strong style={{ color: '#b45309' }}>Khabar Darjeeling</strong>
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '15px', color: '#4b5563' }}>
              <span style={{ fontWeight: 700, fontSize: '18px' }}>📅 {selectedDate}</span>
              <span>•</span>
              <span style={{ color: '#6b7280' }}>To help you stay informed…</span>
            </div>
          </div>

          <div style={{ padding: '28px 32px' }}>
            {/* Two-column news */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
              <NewsColumn title="• DARJEELING •" articles={darjeelingArticles} />
              <NewsColumn title="• KALIMPONG, KURSEONG & BEYOND •" articles={otherDistrictArticles} />
            </div>

            {/* Top headline */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ backgroundColor: '#dc2626', color: 'white', padding: '14px 20px', fontWeight: 900, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.4px' }}>
                📈 TOP HEADLINE OF THE DAY
              </div>
              <div style={{ backgroundColor: 'white', border: '2px solid #dc2626' }}>
                {topHeadline ? (
                  <>
                    <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#d1d5db', overflow: 'hidden' }}>
                      {headlineImg ? (
                        <img src={headlineImg} alt={topHeadline.title} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #c41e3a, #a01830)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '48px', opacity: 0.4 }}>📰</span>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '26px' }}>
                      <h2 style={{ fontSize: '26px', fontWeight: 900, color: '#1f2937', margin: '0 0 10px', lineHeight: 1.25 }}>{topHeadline.title}</h2>
                      {shortDescription(topHeadline) && (
                        <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#374151', margin: 0 }}>{shortDescription(topHeadline)}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>No headline available yet.</div>
                )}
              </div>
            </div>

            {/* Other news */}
            <div style={{ border: '4px solid #1f2937', padding: '26px', backgroundColor: 'white' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#1f2937', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>In Other News…</h3>
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

          <div style={{ backgroundColor: '#f3f4f6', borderTop: '1px solid #e5e7eb', padding: '20px 32px', textAlign: 'center', color: '#4b5563', fontSize: '13px' }}>
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
      <div style={{ backgroundColor: '#fcd34d', color: '#1f2937', padding: '14px 18px', fontWeight: 900, fontSize: '16px', letterSpacing: '0.4px' }}>{title}</div>
      <div style={{ backgroundColor: '#fffbeb', border: '2px solid #fcd34d', padding: '20px', minHeight: '280px' }}>
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
