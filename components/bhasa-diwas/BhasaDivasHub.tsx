'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import SubmissionForm from '@/components/bhasa-diwas/SubmissionForm';
import SubmissionFeed from '@/components/bhasa-diwas/SubmissionFeed';
import Leaderboard from '@/components/bhasa-diwas/Leaderboard';
import WinnersGallery from '@/components/bhasa-diwas/WinnersGallery';

const S = {
  page: { minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' },
  siteHeader: {
    background: '#b91c1c', color: 'white', padding: '14px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky' as const, top: 0, zIndex: 100, flexWrap: 'wrap' as const, gap: '12px'
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoBadge: {
    width: '44px', height: '44px', borderRadius: '50%', background: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0
  },
  headerTitleBox: { display: 'flex', flexDirection: 'column' as const },
  headerTitle: { fontSize: '20px', fontWeight: 700, color: 'white', textDecoration: 'none', lineHeight: 1.2 },
  headerTagline: { fontSize: '12px', color: 'rgba(255,255,255,0.85)', marginTop: '2px' },
  homeBtn: {
    background: 'white', color: '#b91c1c', padding: '8px 20px', borderRadius: '20px',
    fontWeight: 600, textDecoration: 'none', fontSize: '14px'
  },
  hero: { background: 'linear-gradient(135deg, #b91c1c, #7f1d1d)', color: 'white', padding: '60px 20px', textAlign: 'center' as const },
  heroTitle: { fontSize: '42px', fontWeight: 700, margin: '0 0 10px' },
  heroSub: { fontSize: '20px', margin: '0 0 8px', opacity: 0.95 },
  heroTag: { fontSize: '16px', opacity: 0.9, margin: '0 0 16px' },
  dateBadge: { background: 'rgba(255,255,255,0.25)', display: 'inline-block', padding: '8px 20px', borderRadius: '20px', border: '2px solid #facc15', fontWeight: 600 },
  introBox: { background: 'white', borderLeft: '4px solid #b91c1c', padding: '30px', margin: '30px auto', maxWidth: '900px', borderRadius: '4px' },
  introTitle: { fontSize: '24px', fontWeight: 700, color: '#b91c1c', marginBottom: '16px' },
  introText: { color: '#374151', lineHeight: 1.7 },
  tabBar: { background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap' as const, maxWidth: '900px', margin: '0 auto' },
  content: { maxWidth: '900px', margin: '0 auto', padding: '30px 20px' },
  card: { background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '30px' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' },
  footer: { background: '#1f2937', color: 'white', padding: '40px 20px', textAlign: 'center' as const, marginTop: '40px' },
  backLink: {
    display: 'inline-block', color: 'white', textDecoration: 'none', fontWeight: 600,
    padding: '10px 24px', border: '2px solid white', borderRadius: '6px', marginBottom: '16px'
  },
  sponsoredText: { fontSize: '14px', color: '#9ca3af', marginTop: '12px' }
};

function tabBtn(active: boolean) {
  return {
    padding: '14px 24px', fontWeight: 600, background: 'none', border: 'none',
    borderBottom: active ? '3px solid #b91c1c' : '3px solid transparent',
    color: active ? '#b91c1c' : '#6b7280', cursor: 'pointer', fontSize: '15px'
  };
}

export default function BhasaDivasHub() {
  const [activeTab, setActiveTab] = useState('submit');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any>({});

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch('/api/bhasa-diwas/vote');
        const data = await res.json();
        setLeaderboard(data);
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      }
    };
    fetchLeaderboard();
  }, [refreshTrigger]);

  const handleSubmissionSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab('browse');
  };

  const tabs = [
    { id: 'submit', label: '📝 सबमिट' },
    { id: 'browse', label: '🔍 सबमिशन' },
    { id: 'leaderboard', label: '🏆 शीर्ष' },
    { id: 'winners', label: '🎖️ विजेता' }
  ];

  return (
    <div style={S.page}>
      <div style={S.siteHeader}>
        <div style={S.headerLeft}>
          <div style={S.logoBadge}>
            <Image src="/assets/logo.png" alt="Khabar Darjeeling" width={44} height={44} style={{ objectFit: 'cover' }} />
          </div>
          <div style={S.headerTitleBox}>
            <Link href="/" style={S.headerTitle}>Khabar Darjeeling</Link>
            <div style={S.headerTagline}>Hamro Khabar, Hami Lekhaw</div>
          </div>
        </div>
        <Link href="/" style={S.homeBtn}>Home</Link>
      </div>

      <div style={S.hero}>
        <h1 style={S.heroTitle}>नेपाली भाषा दिवस</h1>
        <p style={S.heroSub}>Nepali Bhasa Diwas</p>
        <p style={S.heroTag}>हाम्रो भाषा, हाम्रो पहिचान</p>
        <div style={S.dateBadge}>अगस्ट १–१९</div>
      </div>

      <div style={S.introBox}>
        <h2 style={S.introTitle}>नेपाली भाषाको महत्व</h2>
        <p style={S.introText}>
          नेपाली भाषा केवल संवादको माध्यम मात्र होइन, यो हाम्रो पहिचान, संस्कृति, इतिहास र सभ्यताको आधार हो। त्यसैले नेपाली भाषा दिवसले हामीलाई आफ्नो मातृभाषाप्रति प्रेम, सम्मान र जिम्मेवारीको भावना जगाउने अवसर प्रदान गर्दछ।
        </p>
      </div>

      <div style={S.tabBar}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabBtn(activeTab === tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={S.content}>
        {activeTab === 'submit' && (
          <div style={S.card}>
            <SubmissionForm onSuccess={handleSubmissionSuccess} />
          </div>
        )}

        {activeTab === 'browse' && (
          <SubmissionFeed refreshTrigger={refreshTrigger} />
        )}

        {activeTab === 'leaderboard' && (
          <div style={S.grid3}>
            <Leaderboard category="poetry" leaderboard={leaderboard.poetry || []} />
            <Leaderboard category="essay" leaderboard={leaderboard.essay || []} />
            <Leaderboard category="photo" leaderboard={leaderboard.photo || []} />
          </div>
        )}

        {activeTab === 'winners' && (
          <WinnersGallery />
        )}
      </div>

      <div style={S.footer}>
        <Link href="/" style={S.backLink}>← Back to Home</Link>
        <p style={S.sponsoredText}>Sponsored by KhabarDarjeeling</p>
      </div>
    </div>
  );
}