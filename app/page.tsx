'use client';
import SiteFooter from '@/components/SiteFooter';
import { trackApkDownload } from '@/lib/appwrite';
import WeatherWidget from '@/components/WeatherWidget';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';
import TopCreators from '@/components/TopCreators';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const DB = 'Khabar_db';
const APK_URL = 'https://github.com/limbunowan1234-cell/Khabar-darjeeling/releases/download/v1.0.0/KhabarDarjeeling-v1.0.0.2.apk';

const categories = ['All', 'Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'West Bengal', 'Politics', 'Sports', 'Culture', 'Education', 'Health', 'Entertainment', 'Technology', 'Tea Gardens', 'Tourism', 'Crime', 'Opinion'];

function getCategoryColor(cat: string): string {
  const colors: { [key: string]: string } = {
    'Darjeeling': '#c41e3a', 'Kalimpong': '#e65100', 'Kurseong': '#0F4C5C', 'Mirik': '#7b1fa2',
    'Siliguri': '#1565c0', 'West Bengal': '#f57f17', 'Politics': '#c41e3a', 'Sports': '#2e7d32',
    'Culture': '#f5c518', 'Education': '#0097a7', 'Health': '#d32f2f', 'Entertainment': '#7b1fa2',
    'Technology': '#0F4C5C', 'Tea Gardens': '#6d4c41', 'Tourism': '#00695c', 'Crime': '#212121', 'Opinion': '#c41e3a'
  };
  return colors[cat] || '#0F4C5C';
}

function getImageUrl(article: any): string {
  if (!article.imageFileId) return '';
  return ENDPOINT + '/storage/buckets/article-image/files/' + article.imageFileId + '/view?project=' + projectId;
}

function truncateText(text: string, words: number): string {
  if (!text) return '';
  const w = text.split(' ').slice(0, words).join(' ');
  return text.split(' ').length > words ? w + '...' : w;
}

function readingTime(content: string): string {
  if (!content) return '1 min';
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / 200) + ' min read';
}

function fmtDate(d: string): string {
  try {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function getInitials(name: string): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getTopArticles(articles: any[], period: string): any[] {
  const now = new Date().getTime();
  const msPerDay = 86400000;
  let f = articles;
  if (period === 'Today') f = articles.filter(a => (now - new Date(a.$createdAt).getTime()) < msPerDay);
  else if (period === 'Week') f = articles.filter(a => (now - new Date(a.$createdAt).getTime()) < msPerDay * 7);
  return [...f].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
}

// HERO SECTION WITH 3 FEATURED ARTICLES
function HeroSection({ articles, isDarkMode }: any) {
  const shuffled = [...articles].sort(() => Math.random() - 0.5).slice(0, 3);
  if (shuffled.length === 0) return null;

  return (
    <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
      {/* HERO GRADIENT */}
      <div style={{ background: 'linear-gradient(135deg, #c41e3a 0%, #a01830 100%)', padding: '40px 24px', textAlign: 'center', color: 'white' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '900', margin: '0 0 8px', lineHeight: '1.2' }}>??? ??????????</h1>
        <p style={{ fontSize: '16px', margin: 0, opacity: 0.95, fontWeight: '500' }}>The Digital Home of Darjeeling</p>
      </div>

      {/* 3 FEATURED ARTICLES */}
      {/* MOBILE CAROUSEL — Mobile only */}
      <div style={{ display: 'block', padding: '0 20px 20px', '@media (min-width: 1024px)': { display: 'none' } }}>
        <div style={{ overflowX: 'auto', overflowY: 'hidden', scrollBehavior: 'smooth', paddingBottom: '10px' }}>
          <TopCreators />
        </div>
      </div>

      {/* DESKTOP + MOBILE MAIN LAYOUT */}
      <div style={{ display: 'flex', gap: '24px', padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* LEFT SIDEBAR — Desktop only */}
        <div style={{ display: 'none', width: '260px', flexShrink: 0, '@media (min-width: 1024px)': { display: 'flex' } }}>
          <TopCreators />
        </div>

        {/* MAIN ARTICLES GRID */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {shuffled.map((article) => {
          const img = getImageUrl(article);
          const preview = truncateText(article.content || article.summary || '', 30);
          return (
            <Link key={article.$id} href={'/article/' + article.$id} style={{ textDecoration: 'none', display: 'block', borderRadius: '10px', overflow: 'hidden', transition: 'transform 0.3s' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
              {img && <img src={img} alt={article.title} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              <div style={{ padding: '12px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f9f9' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#c41e3a', textTransform: 'uppercase', marginBottom: '6px' }}>{article.category || 'News'}</div>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a', margin: '0 0 6px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.title}</h3>
                <p style={{ fontSize: '12px', color: isDarkMode ? '#aaa' : '#666', margin: '0 0 8px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview}</p>
                <div style={{ fontSize: '10px', color: isDarkMode ? '#777' : '#999' }}>?? {(article.views || 0).toLocaleString()}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DesktopCard({ article, isDarkMode, featured }: any) {
  const imgUrl = article.youtube_id ? 'https://img.youtube.com/vi/' + article.youtube_id + '/maxresdefault.jpg' : getImageUrl(article);
  const author = article.submitterName || article.authorName || 'Staff Reporter';
  const catColor = getCategoryColor(article.category);
  const hasImage = !!imgUrl;
  const preview = truncateText(article.content || '', 50); // 50-word preview

  if (!featured) {
    if (hasImage) {
      return (
        <Link href={'/article/' + article.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', minHeight: '220px' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.15)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'; }}>
            <div style={{ position: 'relative', overflow: 'hidden' }}>
              <img src={imgUrl} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '220px' }} onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.background = 'linear-gradient(135deg,' + catColor + ',#1a1a1a)'; (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div style={{ position: 'absolute', top: '12px', left: '12px', backgroundColor: catColor, color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{article.category}</div>
              {article.isFeatured && <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: '#f5c518', color: '#1a1a1a', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>FEATURED</div>}
              {article.isBreaking && <div style={{ position: 'absolute', bottom: '12px', left: '12px', backgroundColor: '#c41e3a', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>BREAKING</div>}
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '1px solid ' + (isDarkMode ? '#2a2a2a' : '#f0f0f0') }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', lineHeight: '1.35', margin: '0 0 10px' }}>{article.title}</h2>
                {/* NEW: 50-word preview */}
                <p style={{ color: isDarkMode ? '#bbb' : '#666', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview}</p>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: catColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700' }}>{getInitials(author)}</div>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: isDarkMode ? '#ddd' : '#444' }}>{author}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: isDarkMode ? '#777' : '#999' }}>
                  <span>{fmtDate(article.publishedAt || article.$createdAt)}</span>
                  <span>�</span>
                  <span>{readingTime(article.content)}</span>
                  {article.views > 0 && <span>� {article.views.toLocaleString()} views</span>}
                </div>
              </div>
            </div>
          </div>
        </Link>
      );
    } else {
      return (
        <Link href={'/article/' + article.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', marginBottom: '20px', minHeight: '160px', position: 'relative', background: 'linear-gradient(135deg,' + catColor + ' 0%,' + catColor + 'cc 60%,#1a1a1a 100%)' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)'; }}>
            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,rgba(255,255,255,0.03) 0px,rgba(255,255,255,0.03) 1px,transparent 1px,transparent 12px)' }} />
            <div style={{ position: 'relative', padding: '28px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '160px', boxSizing: 'border-box' }}>
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>{article.category}</span>
                  {article.isBreaking && <span style={{ backgroundColor: '#f5c518', color: '#1a1a1a', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>BREAKING</span>}
                  {article.isFeatured && <span style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: catColor, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>FEATURED</span>}
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'white', lineHeight: '1.3', margin: '0 0 10px', textShadow: '0 2px 8px rgba(0,0,0,0.3)', maxWidth: '80%' }}>{article.title}</h2>
                {/* NEW: 50-word preview for no-image cards */}
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.6', margin: 0, maxWidth: '75%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.25)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', border: '2px solid rgba(255,255,255,0.4)' }}>{getInitials(author)}</div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>{author}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                  <span>{fmtDate(article.publishedAt || article.$createdAt)}</span>
                  <span>�</span>
                  <span>{readingTime(article.content)}</span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      );
    }
  }

  if (hasImage) {
    return (
      <Link href={'/article/' + article.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', marginBottom: '12px', cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(4px)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; }}>
          <div style={{ width: '4px', backgroundColor: catColor, flexShrink: 0 }} />
          <img src={imgUrl} alt={article.title} style={{ width: '110px', height: '90px', objectFit: 'cover', flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
            <div>
              <span style={{ display: 'inline-block', backgroundColor: catColor + '22', color: catColor, padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>{article.category}</span>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a', lineHeight: '1.4', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.title}</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: isDarkMode ? '#999' : '#888' }}>
              <span>{author}</span><span>�</span><span>{fmtDate(article.publishedAt || article.$createdAt)}</span><span>�</span><span>{readingTime(article.content)}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  } else {
    return (
      <Link href={'/article/' + article.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', marginBottom: '12px', cursor: 'pointer', background: 'linear-gradient(135deg,' + catColor + '15,' + catColor + '05)', border: '1px solid ' + catColor + '33' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(4px)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; }}>
          <div style={{ width: '6px', backgroundColor: catColor, flexShrink: 0 }} />
          <div style={{ padding: '14px 16px', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ backgroundColor: catColor, color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{article.category}</span>
              {article.isBreaking && <span style={{ backgroundColor: '#c41e3a', color: 'white', padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700' }}>BREAKING</span>}
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', lineHeight: '1.4', margin: '0 0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.title}</h3>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#aaa' : '#666', lineHeight: '1.5', margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: isDarkMode ? '#777' : '#999' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: catColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '700' }}>{getInitials(author)}</div>
              <span style={{ fontWeight: '600', color: isDarkMode ? '#bbb' : '#555' }}>{author}</span>
              <span>�</span><span>{fmtDate(article.publishedAt || article.$createdAt)}</span>
              <span>�</span><span>{readingTime(article.content)}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }
}

function MobileCard({ article, isDarkMode, index }: any) {
  const imgUrl = article.youtube_id ? 'https://img.youtube.com/vi/' + article.youtube_id + '/maxresdefault.jpg' : getImageUrl(article);
  const author = article.submitterName || article.authorName || 'Staff Reporter';
  const catColor = getCategoryColor(article.category);
  const hasImage = !!imgUrl;
  const isDiscover = index % 3 !== 2;
  const preview = truncateText(article.content || '', 30); // shorter preview for mobile

  if (isDiscover) {
    if (hasImage) {
      return (
        <Link href={'/article/' + article.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '12px' }}>
            <div style={{ position: 'relative', height: '200px', overflow: 'hidden' }}>
              <img src={imgUrl} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.background = 'linear-gradient(135deg,' + catColor + ',#1a1a1a)'; (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.75) 100%)' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 14px 14px' }}>
                <span style={{ backgroundColor: catColor, color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{article.category}</span>
                {article.isBreaking && <span style={{ backgroundColor: '#f5c518', color: '#1a1a1a', padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', marginLeft: '6px' }}>BREAKING</span>}
              </div>
            </div>
            <div style={{ padding: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', lineHeight: '1.4', margin: '0 0 10px' }}>{article.title}</h3>
              {/* NEW: 30-word preview for mobile */}
              <p style={{ fontSize: '13px', color: isDarkMode ? '#bbb' : '#666', lineHeight: '1.4', margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: catColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', flexShrink: 0 }}>{getInitials(author)}</div>
                <span style={{ fontSize: '12px', color: isDarkMode ? '#aaa' : '#666', fontWeight: '500' }}>{author}</span>
                <span style={{ fontSize: '12px', color: isDarkMode ? '#777' : '#999', marginLeft: 'auto' }}>{readingTime(article.content)}</span>
              </div>
            </div>
          </div>
        </Link>
      );
    } else {
      return (
        <Link href={'/article/' + article.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '12px', background: 'linear-gradient(135deg,' + catColor + ' 0%,' + catColor + 'aa 60%,#1a1a1a 100%)', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,rgba(255,255,255,0.03) 0px,rgba(255,255,255,0.03) 1px,transparent 1px,transparent 10px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', padding: '20px 16px' }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{article.category}</span>
                {article.isBreaking && <span style={{ backgroundColor: '#f5c518', color: '#1a1a1a', padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700' }}>BREAKING</span>}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'white', lineHeight: '1.35', margin: '0 0 12px', textShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>{article.title}</h3>
              {/* NEW: 30-word preview for mobile gradient card */}
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5', margin: '0 0 16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.25)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', border: '2px solid rgba(255,255,255,0.4)' }}>{getInitials(author)}</div>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>{author}</span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginLeft: 'auto' }}>{readingTime(article.content)}</span>
              </div>
            </div>
          </div>
        </Link>
      );
    }
  }

  if (hasImage) {
    return (
      <Link href={'/article/' + article.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '12px', display: 'flex' }}>
          <div style={{ width: '4px', backgroundColor: getCategoryColor(article.category), flexShrink: 0 }} />
          <img src={imgUrl} alt={article.title} style={{ width: '100px', height: '90px', objectFit: 'cover', flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a', lineHeight: '1.4', margin: '0 0 6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.title}</h3>
            <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: isDarkMode ? '#999' : '#888' }}>
              <span style={{ color: catColor, fontWeight: '600' }}>{article.category}</span>
              <span>{fmtDate(article.publishedAt || article.$createdAt)}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  } else {
    return (
      <Link href={'/article/' + article.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '12px', display: 'flex', background: isDarkMode ? '#1e1e1e' : 'white', border: '1px solid ' + catColor + '33' }}>
          <div style={{ width: '6px', backgroundColor: catColor, flexShrink: 0 }} />
          <div style={{ padding: '12px', flex: 1, minWidth: 0 }}>
            <span style={{ backgroundColor: catColor, color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{article.category}</span>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', lineHeight: '1.4', margin: '6px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.title}</h3>
            <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: isDarkMode ? '#999' : '#888' }}>
              <span>{author}</span><span>�</span><span>{fmtDate(article.publishedAt || article.$createdAt)}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }
}

function TopTen({ articles, isDarkMode }: any) {
  const [activePeriod, setActivePeriod] = useState('Today');
  const top = getTopArticles(articles, activePeriod);
  return (
    <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '10px', borderBottom: '2px solid #f5c518' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Top 10</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['Today', 'Week', 'Month'].map(p => (
            <button key={p} onClick={() => setActivePeriod(p)} style={{ padding: '3px 8px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700', backgroundColor: activePeriod === p ? '#c41e3a' : isDarkMode ? '#2a2a2a' : '#f5f5f5', color: activePeriod === p ? 'white' : isDarkMode ? '#aaa' : '#666' }}>{p}</button>
          ))}
        </div>
      </div>
      {top.length === 0 ? (
        <p style={{ fontSize: '13px', color: isDarkMode ? '#666' : '#aaa', textAlign: 'center', padding: '10px' }}>No articles yet</p>
      ) : (
        top.map((a, i) => (
          <Link key={a.$id} href={'/article/' + a.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', gap: '8px', padding: '7px 0', borderBottom: i < top.length - 1 ? '1px solid ' + (isDarkMode ? '#2a2a2a' : '#f5f5f5') : 'none', alignItems: 'flex-start', cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '5px', backgroundColor: i < 3 ? '#c41e3a' : isDarkMode ? '#2a2a2a' : '#f5f5f5', color: i < 3 ? 'white' : isDarkMode ? '#aaa' : '#999', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', flexShrink: 0, marginTop: '2px' }}>{i + 1}</span>
              <span style={{ fontSize: '12px', fontWeight: '600', color: isDarkMode ? '#ddd' : '#1a1a1a', lineHeight: '1.4' }}>{a.title}</span>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}

function calcContestScore(a: any): number {
  return (a.views || 0) * 0.5 + (a.likes || 0) * 1 + (a.comments || 0) * 3;
}

function ContestPreview({ articles, isDarkMode }: any) {
  const contestArticles = [...articles].filter((a: any) => a.isContestEntry === true).sort((a, b) => calcContestScore(b) - calcContestScore(a)).slice(0, 5);
  if (contestArticles.length === 0) return null;
  return (
    <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #f5c518' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Contest Top 5</h3>
        <Link href="/contest" style={{ textDecoration: 'none', fontSize: '12px', color: '#c41e3a', fontWeight: '700' }}>See All</Link>
      </div>
      {contestArticles.map((a: any, i: number) => {
        const imgUrl = getImageUrl(a);
        const medal = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : '#' + (i + 1);
        return (
          <Link key={a.$id} href={'/article/' + a.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: i < contestArticles.length - 1 ? '1px solid ' + (isDarkMode ? '#2a2a2a' : '#f5f5f5') : 'none', alignItems: 'center', cursor: 'pointer' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', flexShrink: 0, width: '24px', textAlign: 'center', color: '#c41e3a' }}>{medal}</span>
              {imgUrl ? (
                <img src={imgUrl} alt={a.title} style={{ width: '52px', height: '40px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div style={{ width: '52px', height: '40px', backgroundColor: '#c41e3a22', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#c41e3a' }}>{medal}</span>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: isDarkMode ? '#ddd' : '#1a1a1a', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: isDarkMode ? '#888' : '#aaa' }}>{a.submitterName || a.authorName || 'Author'}</p>
              </div>
            </div>
          </Link>
        );
      })}
      <Link href="/contest" style={{ textDecoration: 'none' }}>
        <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#c41e3a', borderRadius: '8px', textAlign: 'center', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>View Full Leaderboard</div>
      </Link>
    </div>
  );
}

// NEW: BREAKING NEWS SIDEBAR WIDGET
function BreakingNewsSidebar({ articles, isDarkMode }: any) {
  const breaking = articles.filter((a: any) => a.isBreaking).slice(0, 3);
  if (breaking.length === 0) return null;
  return (
    <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px', borderLeft: '4px solid #c41e3a' }}>
      <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#c41e3a', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>?? Breaking News</h3>
      {breaking.map((a: any, i: number) => (
        <Link key={a.$id} href={'/article/' + a.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ paddingBottom: '10px', marginBottom: i < breaking.length - 1 ? '10px' : 0, borderBottom: i < breaking.length - 1 ? '1px solid ' + (isDarkMode ? '#2a2a2a' : '#f5f5f5') : 'none' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '700', color: isDarkMode ? '#ddd' : '#1a1a1a', margin: '0 0 4px', lineHeight: '1.3' }}>{a.title}</h4>
            <div style={{ fontSize: '11px', color: isDarkMode ? '#777' : '#999' }}>{fmtDate(a.$createdAt)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function Home() {
  const { initAuth, user, logOut } = useAuthStore();
  const [articles, setArticles] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [shown, setShown] = useState(12);
  const [isMobile, setIsMobile] = useState(false);
  const [activeNav, setActiveNav] = useState('home');
  const [showMenu, setShowMenu] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (showBanner) {
      const timer = setTimeout(() => setShowBanner(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showBanner]);

  useEffect(() => {
    async function load() {
      await initAuth();
      try {
        const res = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })),
          { headers: H, credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          setArticles(data.documents || []);
          setFiltered(data.documents || []);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    let f = articles;
    if (selectedCategory !== 'All') f = f.filter(a => a.category?.toLowerCase() === selectedCategory.toLowerCase());
    if (searchQuery) f = f.filter(a => a.title?.toLowerCase().includes(searchQuery.toLowerCase()) || (a.content || '').toLowerCase().includes(searchQuery.toLowerCase()));
    setFiltered(f);
    setShown(12);
  }, [searchQuery, selectedCategory, articles]);

  const breakingArticles = articles.filter(a => a.isBreaking).slice(0, 6);
  const featuredArticle = articles.find(a => a.isFeatured) || articles[0];
  const trendingArticles = [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  const gridArticles = filtered.filter(a => a.$id !== featuredArticle?.$id);
  const isAdmin = (user as any)?.labels?.includes('admin') || user?.email === 'nowanad@gmail.com';

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #c41e3a 0%, #a01830 100%)' }}>
      <style>{'.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ textAlign: 'center' }}>
        {/* BIGGER LOGO */}
        <img src="/assets/logo.png" alt="KhabarDarjeeling" style={{ width: '100px', height: '100px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', marginBottom: '20px', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '800', margin: '0 0 6px' }}>Khabar Darjeeling</h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', margin: '0 0 30px' }}>Hamro Khabar, Hami Lekhaw</p>
        <div className="spin" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', margin: '0 auto' }} />
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginTop: '16px' }}>Loading latest news...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: isDarkMode ? '#121212' : '#f0f2f5', color: isDarkMode ? '#e0e0e0' : '#1a1a1a', paddingBottom: isMobile ? '70px' : '0' }}>
      <style>{'.ticker-wrap{overflow:hidden;flex:1}.ticker-track{display:inline-flex;white-space:nowrap;animation:tickerScroll 35s linear infinite}.ticker-track:hover{animation-play-state:paused}@keyframes tickerScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}.cat-pill{transition:all 0.2s;cursor:pointer;border:none}'}</style>

      {showBanner && (
        <div style={{ backgroundColor: '#f5c518', color: '#c41e3a', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderBottom: '2px solid #c41e3a' }}>
          <div style={{ flex: 1, fontSize: isMobile ? '14px' : '16px', fontWeight: '700', textAlign: 'center' }}>We are now updated with new features! Check it out!</div>
          <button onClick={() => setShowBanner(false)} style={{ backgroundColor: 'transparent', border: 'none', color: '#c41e3a', cursor: 'pointer', fontSize: '20px', flexShrink: 0, padding: '0', width: '30px', height: '30px' }}>X</button>
        </div>
      )}

      {isMobile && showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: '280px', height: '100vh', backgroundColor: isDarkMode ? '#1e1e1e' : 'white', zIndex: 200, boxShadow: '-4px 0 20px rgba(0,0,0,0.2)', overflowY: 'auto' }}>
            <div style={{ backgroundColor: '#c41e3a', padding: '20px', borderBottom: '3px solid #f5c518' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'white', fontWeight: '800', fontSize: '18px' }}>Menu</span>
                <button onClick={() => setShowMenu(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>X</button>
              </div>
              {user && <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', marginTop: '8px' }}>{user.name}</div>}
            </div>
            <div style={{ padding: '16px' }}>
              {[
                { href: '/', label: 'Home' },
                { href: '/post', label: 'Create Post' },
                { href: '/contest', label: 'Story Contest 2026' },
                { href: '/profile', label: 'My Profile' },
                { href: '/bookmarks', label: 'Saved Articles' },
                ...(isAdmin ? [{ href: '/admin', label: 'Admin Panel' }] : []),
              ].map(item => (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                  <div onClick={() => setShowMenu(false)} style={{ padding: '14px 12px', fontSize: '15px', fontWeight: '600', color: isDarkMode ? '#ddd' : '#1a1a1a', borderBottom: '1px solid ' + (isDarkMode ? '#333' : '#f0f0f0'), cursor: 'pointer' }}>{item.label}</div>
                </Link>
              ))}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '2px solid #f5c518' }}>
                <p style={{ fontSize: '12px', fontWeight: '700', color: isDarkMode ? '#aaa' : '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Follow Us</p>
                <a href="https://www.facebook.com/profile.php?id=61590708777947" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: '#1877f2', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px', marginBottom: '8px' }}>Facebook</a>
                <a href="https://www.instagram.com/khabardarjeeling_2026" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px', marginBottom: '8px' }}>Instagram</a>
                <a href="https://whatsapp.com/channel/0029VbD933y3LdQQ0g9Z682b" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: '#25D366', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px', marginBottom: '8px' }}>WhatsApp Channel</a>
                <a href={APK_URL} download onClick={() => { trackApkDownload(); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: '#1a1a1a', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>Download APK</a>
              </div>
              {user ? (
                <button onClick={() => { logOut(); setShowMenu(false); }} style={{ width: '100%', padding: '12px', backgroundColor: '#ffebee', color: '#c41e3a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', marginTop: '16px' }}>Logout</button>
              ) : (
                <Link href="/auth" style={{ textDecoration: 'none' }}>
                  <button onClick={() => setShowMenu(false)} style={{ width: '100%', padding: '12px', backgroundColor: '#c41e3a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', marginTop: '16px' }}>Login / Sign Up</button>
                </Link>
              )}
            </div>
          </div>
        </>
      )}

      {/* BIGGER LOGO IN HEADER */}
      <header style={{ backgroundColor: isDarkMode ? '#1e1e1e' : '#c41e3a', color: 'white', padding: '10px 16px', borderBottom: '3px solid #f5c518', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* INCREASED FROM 42px to 56px */}
            <img src="/assets/logo.png" alt="KhabarDarjeeling" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <h1 style={{ margin: 0, fontSize: isMobile ? '16px' : '20px', fontWeight: '800', lineHeight: '1.2' }}>Khabar Darjeeling</h1>
              {!isMobile && <p style={{ margin: 0, fontSize: '10px', opacity: 0.8 }}>Hamro Khabar, Hami Lekhaw</p>}
            </div>
          </Link>
          {!isMobile && <input type="text" placeholder="Search news..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1, maxWidth: '280px', padding: '8px 16px', borderRadius: '20px', border: 'none', fontSize: '14px', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', outline: 'none' }} />}
          {!isMobile && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Link href="/post" style={{ textDecoration: 'none' }}><button style={{ backgroundColor: '#f5c518', color: '#1a1a1a', border: 'none', padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>Post</button></Link>
              <Link href="/contest" style={{ textDecoration: 'none' }}><button style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>Contest</button></Link>
              {user ? (
                <>
                  <Link href="/profile" style={{ textDecoration: 'none' }}><button style={{ backgroundColor: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Profile</button></Link>
                  {isAdmin && <Link href="/admin" style={{ textDecoration: 'none' }}><button style={{ backgroundColor: '#f5c518', color: '#1a1a1a', border: 'none', padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>Admin</button></Link>}
                  <button onClick={() => logOut()} style={{ backgroundColor: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)', padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Logout</button>
                </>
              ) : (
                <Link href="/auth" style={{ textDecoration: 'none' }}><button style={{ backgroundColor: '#f5c518', color: '#1a1a1a', border: 'none', padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>Login</button></Link>
              )}
              <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}>{isDarkMode ? 'L' : 'D'}</button>
            </div>
          )}
          {isMobile && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', fontSize: '12px' }}>{isDarkMode ? 'L' : 'D'}</button>
              <button onClick={() => setShowMenu(true)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px' }}>&#9776;</button>
            </div>
          )}
        </div>
        <div style={{ maxWidth: '1280px', margin: '8px auto 0', display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {categories.map((cat) => (
            <button key={cat} className="cat-pill" onClick={() => setSelectedCategory(cat)} style={{ backgroundColor: selectedCategory === cat ? '#f5c518' : 'rgba(255,255,255,0.15)', color: selectedCategory === cat ? '#1a1a1a' : 'white', padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>{cat}</button>
          ))}
        </div>
      </header>

      {breakingArticles.length > 0 && (
        <div style={{ backgroundColor: '#a01830', color: 'white', padding: '8px 0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ flexShrink: 0, fontWeight: '700', fontSize: '11px', letterSpacing: '1px', backgroundColor: '#6b0f1f', padding: '8px 14px', whiteSpace: 'nowrap' }}>BREAKING</div>
            <div className="ticker-wrap">
              <div className="ticker-track">
                {[...breakingArticles, ...breakingArticles].map((a, i) => (
                  <Link key={a.$id + i} href={'/article/' + a.$id} style={{ color: 'white', textDecoration: 'none', padding: '0 24px', fontSize: '13px', fontWeight: '500' }}>{a.title}</Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isMobile && (
        <div style={{ padding: '10px 16px', backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderBottom: '1px solid ' + (isDarkMode ? '#333' : '#eee'), display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input id="mobile-search" type="text" placeholder="Search news..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1, padding: '10px 16px', borderRadius: '20px', border: '1px solid ' + (isDarkMode ? '#444' : '#ddd'), fontSize: '14px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5', color: isDarkMode ? '#fff' : '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
          <Link href="/post" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <button style={{ backgroundColor: '#c41e3a', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', whiteSpace: 'nowrap' }}>Post</button>
          </Link>
        </div>
      )}

      {isMobile && !searchQuery && selectedCategory === 'All' && (
        <div style={{ padding: '10px 16px 0' }}>
          <WeatherWidget variant="banner" isDarkMode={isDarkMode} />
          <a href={APK_URL} download onClick={() => { trackApkDownload(); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#1a1a1a', color: 'white', borderRadius: '12px', padding: '12px 16px', textDecoration: 'none', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '13px' }}>Download our Android App</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>Faster news, offline reading</div>
            </div>
            <span style={{ backgroundColor: '#f5c518', color: '#1a1a1a', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>Download</span>
          </a>
          <a href="https://whatsapp.com/channel/0029VbD933y3LdQQ0g9Z682b" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#25D366', color: 'white', borderRadius: '12px', padding: '12px 16px', textDecoration: 'none', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '13px' }}>Follow on WhatsApp</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Breaking news and alerts</div>
            </div>
            <span style={{ backgroundColor: 'white', color: '#25D366', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>Follow</span>
          </a>
        </div>
      )}

      {isMobile ? (
        <div style={{ padding: '4px 16px 16px' }}>
          {/* HERO SECTION ON MOBILE */}
          {!searchQuery && selectedCategory === 'All' && <div style={{ marginBottom: '16px' }}><HeroSection articles={articles} isDarkMode={isDarkMode} /></div>}
          {!searchQuery && selectedCategory === 'All' && <div style={{ marginBottom: '16px' }}><TopTen articles={articles} isDarkMode={isDarkMode} /></div>}
          {!searchQuery && selectedCategory === 'All' && <ContestPreview articles={articles} isDarkMode={isDarkMode} />}
          {featuredArticle && !searchQuery && selectedCategory === 'All' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ width: '4px', height: '16px', backgroundColor: '#f5c518', borderRadius: '2px', display: 'inline-block' }} />
                <span style={{ fontSize: '13px', fontWeight: '700', color: isDarkMode ? '#fff' : '#c41e3a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Featured</span>
              </div>
              <MobileCard article={featuredArticle} isDarkMode={isDarkMode} index={0} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ width: '4px', height: '16px', backgroundColor: '#f5c518', borderRadius: '2px', display: 'inline-block' }} />
            <span style={{ fontSize: '13px', fontWeight: '700', color: isDarkMode ? '#fff' : '#c41e3a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{selectedCategory !== 'All' ? selectedCategory : searchQuery ? 'Results' : 'Latest News'}</span>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: isDarkMode ? '#999' : '#888' }}>{filtered.length} stories</span>
          </div>
          {filtered.slice(0, shown).map((article, i) => (<MobileCard key={article.$id} article={article} isDarkMode={isDarkMode} index={i} />))}
          {shown < filtered.length && (
            <button onClick={() => setShown(s => s + 10)} style={{ width: '100%', padding: '14px', backgroundColor: '#c41e3a', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' }}>Load More ({filtered.length - shown} more)</button>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px', display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: '24px' }}>
          <aside>
            <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px', position: 'sticky', top: '100px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #f5c518' }}>Categories</h3>
              {categories.map((cat) => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', backgroundColor: selectedCategory === cat ? '#c41e3a' : 'transparent', color: selectedCategory === cat ? 'white' : isDarkMode ? '#ddd' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: selectedCategory === cat ? '700' : '500', marginBottom: '2px' }} onMouseEnter={(e) => { if (selectedCategory !== cat) e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : '#f5f5f5'; }} onMouseLeave={(e) => { if (selectedCategory !== cat) e.currentTarget.style.backgroundColor = 'transparent'; }}>{cat}</button>
              ))}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '2px solid #f5c518' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Follow Us</h3>
                <a href="https://www.facebook.com/profile.php?id=61590708777947" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', backgroundColor: '#1877f2', color: 'white', borderRadius: '6px', textDecoration: 'none', fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>Facebook</a>
                <a href="https://www.instagram.com/khabardarjeeling_2026" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: 'white', borderRadius: '6px', textDecoration: 'none', fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>Instagram</a>
                <a href="https://whatsapp.com/channel/0029VbD933y3LdQQ0g9Z682b" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', backgroundColor: '#25D366', color: 'white', borderRadius: '6px', textDecoration: 'none', fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>WhatsApp</a>
                <a href={APK_URL} download onClick={() => { trackApkDownload(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', backgroundColor: '#1a1a1a', color: 'white', borderRadius: '6px', textDecoration: 'none', fontWeight: '600', fontSize: '12px' }}>Download App</a>
              </div>
            </div>
          </aside>
          <main>
            {/* HERO SECTION WITH 3 FEATURED ARTICLES */}
            {!searchQuery && selectedCategory === 'All' && <HeroSection articles={articles} isDarkMode={isDarkMode} />}
            
            {featuredArticle && !searchQuery && selectedCategory === 'All' && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ width: '4px', height: '20px', backgroundColor: '#f5c518', borderRadius: '2px', display: 'inline-block' }} />
                  <h2 style={{ fontSize: '16px', fontWeight: '800', color: isDarkMode ? '#fff' : '#c41e3a', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Featured Story</h2>
                </div>
                <DesktopCard article={featuredArticle} isDarkMode={isDarkMode} featured={true} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ width: '4px', height: '20px', backgroundColor: '#f5c518', borderRadius: '2px', display: 'inline-block' }} />
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: isDarkMode ? '#fff' : '#c41e3a', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{selectedCategory !== 'All' ? selectedCategory : searchQuery ? 'Search Results' : 'Latest News'}</h2>
              <span style={{ marginLeft: 'auto', fontSize: '13px', color: isDarkMode ? '#999' : '#888' }}>{filtered.length} articles</span>
            </div>
            {gridArticles.slice(0, shown).map((article) => (<DesktopCard key={article.$id} article={article} isDarkMode={isDarkMode} featured={false} />))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: isDarkMode ? '#666' : '#ccc' }}>
                <p style={{ fontSize: '18px', fontWeight: '600' }}>No articles found</p>
              </div>
            )}
            {shown < gridArticles.length && (
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <button onClick={() => setShown(s => s + 10)} style={{ backgroundColor: '#c41e3a', color: 'white', border: 'none', padding: '12px 32px', borderRadius: '30px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>Load More ({gridArticles.length - shown} more)</button>
              </div>
            )}
          </main>
          <aside>
            {/* NEW: BREAKING NEWS WIDGET ON RIGHT SIDEBAR */}
            <WeatherWidget variant="card" isDarkMode={isDarkMode} />
            <BreakingNewsSidebar articles={articles} isDarkMode={isDarkMode} />
            <TopTen articles={articles} isDarkMode={isDarkMode} />
            <ContestPreview articles={articles} isDarkMode={isDarkMode} />
            <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #f5c518' }}>Trending</h3>
              {trendingArticles.map((a, i) => (
                <Link key={a.$id} href={'/article/' + a.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', gap: '10px', paddingBottom: '12px', marginBottom: '12px', borderBottom: i < trendingArticles.length - 1 ? '1px solid ' + (isDarkMode ? '#333' : '#f0f0f0') : 'none', cursor: 'pointer' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', flexShrink: 0 }}>{i + 1}</div>
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: isDarkMode ? '#ddd' : '#1a1a1a', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</p>
                      <div style={{ fontSize: '11px', color: isDarkMode ? '#888' : '#aaa', marginTop: '4px' }}>{(a.views || 0).toLocaleString()} views</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/contest" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'linear-gradient(135deg, #c41e3a, #a01830)', borderRadius: '10px', padding: '20px', marginBottom: '20px', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ color: 'white', fontWeight: '800', fontSize: '15px', marginBottom: '4px' }}>Story Contest 2026</div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', marginBottom: '12px' }}>Rs.10,000 Prize Pool</div>
                <div style={{ backgroundColor: '#f5c518', color: '#1a1a1a', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '13px', display: 'inline-block' }}>Enter Now</div>
              </div>
            </Link>
            <a href={APK_URL} download onClick={() => { trackApkDownload(); }} style={{ textDecoration: 'none' }}>
              <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>Download App</div>
                  <div style={{ fontSize: '11px', color: isDarkMode ? '#aaa' : '#888' }}>Android APK available</div>
                </div>
                <span style={{ backgroundColor: '#c41e3a', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>Get</span>
              </div>
            </a>
            <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #f5c518' }}>Quick Links</h3>
              {[{ label: 'Post a Story', href: '/post', color: '#c41e3a' }, { label: 'Story Contest', href: '/contest', color: '#e65100' }, { label: 'My Bookmarks', href: '/bookmarks', color: '#0F4C5C' }, { label: 'My Profile', href: '/profile', color: '#7b1fa2' }].map(item => (
                <a key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', marginBottom: '6px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f9f9', borderRadius: '8px', textDecoration: 'none', borderLeft: '3px solid ' + item.color }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: isDarkMode ? '#ddd' : '#1a1a1a' }}>{item.label}</span>
                  <span style={{ color: item.color, fontWeight: '700', fontSize: '16px' }}>?</span>
                </a>
              ))}
            </div>
            <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '2px solid #f5c518' }}>About</h3>
              <p style={{ fontSize: '13px', color: isDarkMode ? '#aaa' : '#666', lineHeight: '1.6', margin: '0 0 12px' }}>The Digital Home of Darjeeling � bringing you the latest news from the hills, tea gardens, and Gorkha community.</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['Darjeeling', 'Kalimpong', 'GTA', 'Tea Gardens', 'Politics'].map(tag => (
                  <span key={tag} onClick={() => setSelectedCategory(tag)} style={{ padding: '4px 10px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f0f0f0', color: isDarkMode ? '#ddd' : '#555', borderRadius: '20px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>{tag}</span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

            {isMobile && (
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderTop: '1px solid ' + (isDarkMode ? '#333' : '#eee'), display: 'flex', zIndex: '200', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)' }}>
          {[
            { id: 'home', href: '/', icon: '??', label: 'Home' },
            { id: 'search', href: '#', icon: '??', label: 'Search' },
            { id: 'post', href: '/post', icon: '??', label: 'Post' },
            { id: 'contest', href: '/contest', icon: '??', label: 'Contest' },
            { id: 'profile', href: user ? '/profile' : '/auth', icon: '??', label: user ? 'Profile' : 'Login' },
            ...(isAdmin ? [{ id: 'admin', href: '/admin', icon: '??', label: 'Admin' }] : []),
          ].map((item) => (
            <Link key={item.id} href={item.href} style={{ flex: 1, textDecoration: 'none' }}>
              <div onClick={() => { setActiveNav(item.id); if (item.id === 'search') { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => { const el = document.getElementById('mobile-search'); if (el) el.focus(); }, 300); } }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', cursor: 'pointer' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: activeNav === item.id ? '#c41e3a' : isDarkMode ? '#2a2a2a' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: '600', color: activeNav === item.id ? '#c41e3a' : isDarkMode ? '#888' : '#999' }}>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      )}
        <SiteFooter isDarkMode={isDarkMode} />

      {!isMobile && (
        <footer style={{ backgroundColor: isDarkMode ? '#1e1e1e' : '#1a1a1a', color: '#aaa', padding: '24px 20px', textAlign: 'center', marginTop: '40px' }}>
          <p style={{ margin: 0, fontSize: '14px' }}>� 2026 Khabar Darjeeling. All rights reserved.</p>
        </footer>
      )}
    </div>
  );
}
