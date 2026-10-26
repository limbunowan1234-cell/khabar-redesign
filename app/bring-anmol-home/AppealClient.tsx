'use client';

import { useState } from 'react';
import Link from 'next/link';

const PAGE_URL = 'https://khabardarjeeling.in/bring-anmol-home';
const SHARE_TEXT_EN = 'Anmol Sinchury from Mirik is trapped in a scam company on the Thailand–Myanmar border. Help bring him home.';
const SHARE_TEXT_NE = 'मिरिकका अनमोल सिन्चौरी थाइल्याण्ड–म्यानमार सीमाको स्क्याम कम्पनीमा फसेका छन्। अनमोललाई सुरक्षित घर फर्काउन सहयोग गरौँ।';

// Decoded from the family's own UPI QR (assets/fundraiser/anmol/anmol-upi-qr.png),
// so the button and the printed ID always match what the QR pays.
const UPI_ID = '8327232974@ptsbi';
const UPI_NAME = 'Mani Prakash Sinchury';
const UPI_LINK = 'upi://pay?pa=8327232974@ptsbi&pn=MANI%20PRAKASH%20SINCHURY';

const RED = '#c41e3a';
const GOLD = '#f5c518';

const CARD: React.CSSProperties = { background: '#fff', borderRadius: '16px', border: '1px solid #eee', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' };

type Lang = 'en' | 'ne';

// The Nepali text is the appeal exactly as Darjeeling Maato Ko Maya
// Foundation published it; the English is a translation of it.
const content = {
  ne: {
    kicker: 'हार्दिक सहयोगको अपिल',
    headline: 'अनमोललाई घर फर्काउने अभियान',
    subhead: 'मिरिकका अनमोल सिन्चौरी थाइल्याण्ड–म्यानमार सीमाको स्क्याम कम्पनीमा फसेका छन्। उहाँलाई सुरक्षित घर फर्काउन सहयोग गरौँ।',
    cta: '🙏 अनमोललाई सहयोग गर्नुहोस्',
    story: [
      'मिरिकको फगडी निवासी अनमोल सिन्चौरी हाल थाइल्याण्ड–म्यानमार सीमावर्ती क्षेत्रमा एक स्क्याम कम्पनीमा फसेको र कुटपिट तथा शारीरिक यातनाका कारण गम्भीर र लाचार अवस्थामा रहेको जानकारी प्राप्त भएको छ।',
      'उहाँलाई सुरक्षित उद्धार गरी घर फर्काउन हामी सम्बन्धित निकायहरूसँग समन्वय गर्दै आवश्यक पहल गरिरहेका छौँ। उहाँलाई घर फर्काउने आशामा परिवारले आफ्नो क्षमताअनुसार ठूलो आर्थिक भार व्यहोरेको र अहिले परिवारको आर्थिक अवस्था अत्यन्तै कमजोर भइसकेको छ। यस कठिन परिस्थितिमा अनमोलको उद्धार तथा सुरक्षित घरफिर्तीका लागि थप आर्थिक सहयोग आवश्यक परेको छ।',
      'त्यसैले दिल्ली–एनसीआरलगायत सम्पूर्ण भारतमा रहनुभएका गोर्खा दाजुभाइ, दिदीबहिनी, सामाजिक संस्था तथा सहयोगी मनहरूलाई सक्दो आर्थिक र मानवीय सहयोग गरिदिन हार्दिक अपिल गर्दछौँ।',
      'एउटी आमाको पीडा बुझौँ, परिवारको विवशतालाई महसुस गरौँ र अनमोललाई सकुशल घर फर्काएर आमाको काखमा ल्याउने यस मानवीय अभियानमा सबै एकजुट बनौँ।',
    ],
    quote: 'मानवता नै हाम्रो पहिचान, सेवा नै हाम्रो धर्म।',
    photoFace: 'अनमोल सिन्चौरी, आँखा वरिपरि चोटका निलडाम',
    photoHead: 'अनमोलको टाउकोमा लागेको चोट',
    donateTitle: 'अनमोललाई सहयोग गर्नुहोस्',
    donateSub: 'कुनै पनि UPI app (Paytm, PhonePe, Google Pay, BHIM) बाट QR स्क्यान गरेर सहयोग गर्नुहोस्।',
    payApp: 'UPI app बाट भुक्तानी गर्नुहोस्',
    payAppNote: 'मोबाइलमा मात्र काम गर्छ',
    copyUpi: 'UPI ID कपी गर्नुहोस्', copiedUpi: 'UPI ID कपी भयो!',
    shareTitle: 'यो अपिल Share गर्नुहोस्',
    copyLink: 'लिंक कपी गर्नुहोस्', copiedLink: 'कपी भयो!',
  },
  en: {
    kicker: 'An urgent appeal for help',
    headline: 'Bring Anmol Home',
    subhead: 'Anmol Sinchury from Mirik is trapped in a scam company on the Thailand–Myanmar border. Help bring him home safely.',
    cta: '🙏 Support Anmol',
    story: [
      'Anmol Sinchury, from Phagadi in Mirik, is currently trapped in a scam company in the Thailand–Myanmar border region. We have received information that he has been beaten and physically tortured, and is in a serious and helpless condition.',
      'We are coordinating with the relevant authorities and taking the necessary steps to rescue him safely and bring him home. In the hope of bringing him back, his family has already carried a heavy financial burden, as far as their means allowed, and their financial situation is now extremely weak. In this difficult situation, more financial help is needed for Anmol’s rescue and safe return.',
      'We therefore appeal to Gorkha brothers and sisters, social organisations and kind-hearted people across India, including Delhi–NCR, to give whatever financial and humanitarian support they can.',
      'Let us understand a mother’s pain, feel the family’s helplessness, and come together in this humanitarian campaign to bring Anmol safely home to his mother’s arms.',
    ],
    quote: 'Humanity is our identity, service is our religion.',
    photoFace: 'Anmol Sinchury, with bruising around both eyes',
    photoHead: 'An injury to the top of Anmol’s head',
    donateTitle: 'Support Anmol',
    donateSub: 'Scan the QR code with any UPI app (Paytm, PhonePe, Google Pay, BHIM) to donate.',
    payApp: 'Pay with a UPI app',
    payAppNote: 'Works on mobile only',
    copyUpi: 'Copy UPI ID', copiedUpi: 'UPI ID copied!',
    shareTitle: 'Share this appeal',
    copyLink: 'Copy Link', copiedLink: 'Copied!',
  },
};

function ShareIcon({ d }: { d: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>;
}

export default function AppealClient() {
  const [lang, setLang] = useState<Lang>('ne');
  const t = content[lang];
  const [copied, setCopied] = useState<'' | 'link' | 'upi'>('');

  function copy(text: string, what: 'link' | 'upi') {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    });
  }

  const shareText = lang === 'en' ? SHARE_TEXT_EN : SHARE_TEXT_NE;

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7' }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${RED}, #8f1428)`, padding: '48px 20px 60px', textAlign: 'center', color: '#fff' }}>
        <Link href="/" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>← Khabar Darjeeling</Link>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '16px 0' }}>
          <button onClick={() => setLang('ne')} style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: lang === 'ne' ? GOLD : 'rgba(255,255,255,0.15)', color: lang === 'ne' ? '#1a1a1a' : '#fff' }}>नेपाली</button>
          <button onClick={() => setLang('en')} style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: lang === 'en' ? GOLD : 'rgba(255,255,255,0.15)', color: lang === 'en' ? '#1a1a1a' : '#fff' }}>English</button>
        </div>

        <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.22em', color: GOLD, textTransform: 'uppercase' }}>Bring Anmol Home</div>
        <h1 style={{ fontSize: 'clamp(26px, 5vw, 40px)', fontWeight: 800, margin: '10px auto 8px', maxWidth: '700px', lineHeight: 1.25 }}>{t.headline}</h1>
        <p style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 12px', color: 'rgba(255,255,255,0.8)' }}>{t.kicker}</p>
        <p style={{ fontSize: '16px', maxWidth: '560px', margin: '0 auto', color: 'rgba(255,255,255,0.92)', lineHeight: 1.6 }}>{t.subhead}</p>

        <a href="#donate" style={{ display: 'inline-block', marginTop: '24px', padding: '14px 32px', background: GOLD, color: '#1a1a1a', borderRadius: '30px', fontWeight: 800, fontSize: '15px', textDecoration: 'none' }}>
          {t.cta}
        </a>
      </div>

      {/* Body */}
      <div style={{ maxWidth: '1080px', margin: '-30px auto 0', padding: '0 20px 60px', display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Main column */}
        <div style={{ flex: '2 1 480px', minWidth: '280px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div style={{ ...CARD, padding: '4px', overflow: 'hidden', flex: 1 }}>
              <img src="/assets/fundraiser/anmol/anmol-face.jpg" alt={t.photoFace} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '12px', display: 'block' }} />
            </div>
            <div style={{ ...CARD, padding: '4px', overflow: 'hidden', flex: 1 }}>
              <img src="/assets/fundraiser/anmol/anmol-head.jpg" alt={t.photoHead} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '12px', display: 'block' }} />
            </div>
          </div>

          <div style={{ ...CARD, padding: '28px 24px' }}>
            {t.story.map((p, i) => (
              <p key={i} style={{ fontSize: '16px', lineHeight: 1.8, color: '#333', marginBottom: '16px' }}>{p}</p>
            ))}
            <p style={{ fontSize: '17px', fontWeight: 700, color: RED, textAlign: 'center', marginTop: '24px', fontStyle: 'italic' }}>{t.quote}</p>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#555', textAlign: 'center', marginTop: '8px' }}>— Darjeeling Maato Ko Maya Foundation / Seva Sanstha</p>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ flex: '1 1 300px', minWidth: '280px', position: 'sticky', top: '16px' }}>
          <div id="donate" style={{ ...CARD, padding: '24px', marginBottom: '20px', scrollMarginTop: '16px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#1a1a1a', marginBottom: '4px' }}>{t.donateTitle}</h2>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '18px', lineHeight: 1.5 }}>{t.donateSub}</p>

            <div style={{ textAlign: 'center' }}>
              <img src="/assets/fundraiser/anmol/anmol-upi-qr.png" alt={`${UPI_NAME} UPI QR code`} style={{ width: '100%', maxWidth: '260px', borderRadius: '8px', border: '1px solid #eee' }} />
              <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '8px' }}>{UPI_NAME}</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: RED, wordBreak: 'break-all', marginTop: '2px' }}>{UPI_ID}</div>
            </div>

            <a href={UPI_LINK} style={{ display: 'block', marginTop: '16px', padding: '12px', borderRadius: '10px', background: RED, color: '#fff', textAlign: 'center', textDecoration: 'none', fontWeight: 800, fontSize: '14px' }}>
              {t.payApp}
            </a>
            <div style={{ fontSize: '11px', color: '#999', textAlign: 'center', marginTop: '4px' }}>{t.payAppNote}</div>
            <button onClick={() => copy(UPI_ID, 'upi')} style={{ width: '100%', marginTop: '10px', padding: '11px', borderRadius: '10px', background: '#f2f2f2', color: '#444', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              {copied === 'upi' ? t.copiedUpi : t.copyUpi}
            </button>
          </div>

          <div style={{ ...CARD, padding: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#1a1a1a', marginBottom: '14px' }}>{t.shareTitle}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + PAGE_URL)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#e8f9ef', color: '#1a7d3a', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>
                <ShareIcon d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.93 6.45 17.5 2 12.04 2zm5.83 14.09c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.13.11-1.82-.11-.42-.13-.96-.31-1.65-.61-2.91-1.26-4.81-4.19-4.95-4.38-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.27-.29.58-.36.78-.36l.56.01c.18.01.42-.07.66.5.24.58.83 2 .9 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.49-.14.14-.28.29-.12.56.16.28.7 1.16 1.51 1.88 1.04.93 1.91 1.22 2.19 1.36.28.14.44.12.6-.07.16-.19.68-.79.87-1.06.19-.28.37-.23.62-.14.26.09 1.63.77 1.91.91.28.14.47.21.53.33.07.13.07.72-.17 1.4z" />
                WhatsApp
              </a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(PAGE_URL)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#eaf0fd', color: '#1877F2', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>
                <ShareIcon d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
                Facebook
              </a>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(PAGE_URL)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#eaf5fd', color: '#0f7bc4', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>
                <ShareIcon d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 01-1.93.07 4.28 4.28 0 004 2.98 8.521 8.521 0 01-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
                Twitter / X
              </a>
              <button onClick={() => copy(PAGE_URL, 'link')} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#f2f2f2', color: '#444', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>
                <ShareIcon d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
                {copied === 'link' ? t.copiedLink : t.copyLink}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
