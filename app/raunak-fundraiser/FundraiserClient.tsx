'use client';

import { useState } from 'react';

const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const PAGE_URL = 'https://khabardarjeeling.in/raunak-fundraiser';
const SHARE_TEXT_EN = "Help save 2-year-old Raunak, fighting a rare brain tumour at CMC Vellore. Every share helps.";
const SHARE_TEXT_NE = 'सानो रौनकको जीवन बचाउन सहयोग गरिदिनुहोस्। तपाईंको एउटा Share ले पनि ठूलो फरक पार्न सक्छ।';

const RED = '#c41e3a';
const GOLD = '#f5c518';

const CARD: React.CSSProperties = { background: '#fff', borderRadius: '16px', border: '1px solid #eee', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' };
const LABEL: React.CSSProperties = { display: 'block', fontWeight: 700, fontSize: '13px', color: '#1a1a1a', marginBottom: '6px' };
const INPUT: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' };

type Lang = 'en' | 'ne';

const content = {
  en: {
    headline: 'Help Save 2-Year-Old Raunak',
    subhead: 'Fighting a rare brain tumour at CMC Vellore — every share and every rupee brings him closer to the treatment he needs.',
    story: [
      "Raunak Chettri, a 2-year-old boy from Lower Lolay Busty, Kalimpong, is fighting for his life against a rare and aggressive brain tumour.",
      "He has been diagnosed with an Atypical Teratoid/Rhabdoid Tumour (ATRT) — a rare, WHO Grade 4 cancer — located at the fourth ventricle and superior vermis of his brain, along with hydrocephalus (fluid build-up in the brain).",
      "Since 26 June 2026, Raunak has been under continuous treatment at Christian Medical College (CMC), Vellore, one of India's leading centres for paediatric cancer care. He has already undergone emergency brain surgery to remove the tumour and has now started chemotherapy.",
      "This is an age for playing, laughing, and going to school. Instead, Raunak is fighting for his life from a hospital bed.",
      "His parents, Kapil Chettri and Bhumika Sharma, are doing everything they can — but a cost of this scale is far beyond what any family can bear alone.",
      "Every contribution, however small, brings Raunak one step closer to a full recovery. And if you're not able to donate, sharing this appeal can be just as powerful — your one share could reach someone who can help.",
    ],
    quote: '"A small act of help, a big hope — for Raunak\'s life."',
    proofTitle: 'Medical Verification',
    proofIntro: "The following is transcribed from an official letter issued by CMC Vellore's Department of Paediatric Haematology Oncology, dated 20 August 2026:",
    proofBody: [
      'This is to certify that Master Raunak Chettri (CMCH No: AQ20556), S/o Mr. Kapil Chettri, residing at Lower Lolay Busty, Kalimpong, is diagnosed with Atypical Teratoid Rhabdoid Tumour of the superior vermis and fourth ventricle.',
      'He has undergone surgical excision and has been started on chemotherapy. Expenses to date: ₹5.5 lakhs. Further treatment (approx. 1 year) is estimated to cost a further ₹7 lakhs — total estimated expenses: ₹12.5 lakhs. This is an approximate estimate and the cost is likely to be more if there are unforeseen complications.',
    ],
    proofSigned: '— Dr. Leenu Joseph, MD, DCH, DM, Associate Professor, Paediatric Hematology-Oncology, CMC Vellore',
    proofNote: 'Original signed letter:',
    donateTitle: "Support Raunak's Treatment",
    donateSub: 'Scan either QR code with any UPI app to donate directly to the family.',
    shareTitle: 'Share this appeal',
    formTitle: 'Leave a message of support',
    formNote: "This form records your name and message — it does not process any payment. Please complete your donation by scanning a QR code above; your entry here just lets the family know who's behind it.",
    name: 'Name', email: 'Email (optional)', amount: 'Amount donated (optional, ₹)', message: 'Message (optional)',
    submit: 'Submit', submitting: 'Submitting…',
    success: "Thank you — your message has been recorded. Raunak's family will see it.",
  },
  ne: {
    headline: 'सानो नानी रौनकको जीवन बचाउन सहयोग',
    subhead: 'CMC Vellore मा गम्भीर ब्रेन ट्युमरसँग जुधिरहेका रौनकका लागि — तपाईंको हरेक Share र हरेक सहयोगले उनको उपचारलाई नजिक ल्याउँछ।',
    story: [
      'कलिम्पोङ, लोले बस्तीका २ वर्ष ८ महिनाका सानो नानी रौनक क्षेत्री अहिले गम्भीर स्वास्थ्य समस्यासँग जुधिरहेका छन्। रौनकलाई Brain Tumor Cancer (ATRT) तथा Hydrocephalus (दिमागमा पानी जम्ने समस्या) भएको छ।',
      'नानीको उपचार २६ जुन २०२६ देखि CMC Vellore मा निरन्तर भइरहेको छ। लामो समयसम्म अस्पतालमा बसेर उपचार, केमोथेरापी तथा आवश्यक अन्य उपचारहरू गर्नुपर्ने भएकाले परिवारमाथि ठूलो आर्थिक भार परेको छ।',
      'यो उमेरमा खेल्ने, रमाउने र स्कुल जाने समय हो। तर आज सानो रौनक अस्पतालको बेडमा आफ्नो जीवनका लागि संघर्ष गरिरहेका छन्।',
      'परिवारले आफ्नो तर्फबाट सक्दो प्रयास गरिरहेको छ, तर उपचार लामो र खर्चिलो भएकाले ठूलो रकम जुटाउन निकै कठिन भइरहेको छ। त्यसैले रौनकको उपचारलाई निरन्तरता दिन सबै सहयोगी मनहरूसँग हार्दिक सहयोगको अपिल गर्दछौं।',
      'तपाईंले गर्नुभएको सानो सहयोग पनि रौनकको उपचारका लागि ठूलो सहारा बन्न सक्छ। कृपया यो पोस्टलाई Like, Share र Forward गरिदिनुहोस् — तपाईं आफैंले सहयोग गर्न नसक्नुभए पनि यो अपिल अरू मानिसहरूसम्म पुर्‍याइदिनुहोस्।',
    ],
    quote: '"सानो सहयोग, ठूलो आशा — रौनकको जीवनका लागि।"',
    proofTitle: 'चिकित्सा प्रमाण',
    proofIntro: 'तलको विवरण CMC Vellore को Department of Paediatric Haematology Oncology बाट मिति २०.०८.२०२६ मा जारी गरिएको आधिकारिक पत्रबाट लिइएको हो:',
    proofBody: [
      'यसले प्रमाणित गर्दछ कि Master Raunak Chettri (CMCH No: AQ20556), S/o श्री Kapil Chettri, बसोबास Lower Lolay Busty, Kalimpong लाई Atypical Teratoid Rhabdoid Tumour (superior vermis र fourth ventricle) रहेको निदान भएको छ।',
      'उनको शल्यक्रिया भइसकेको छ र केमोथेरापी सुरु गरिएको छ। हालसम्मको खर्च: रु ५.५ लाख। थप उपचार (लगभग १ वर्ष) को अनुमानित खर्च थप रु ७ लाख — कुल अनुमानित खर्च: रु १२.५ लाख। यो अनुमानित रकम मात्र हो, अप्रत्याशित जटिलता आएमा खर्च बढ्न सक्छ।',
    ],
    proofSigned: '— डा. लीनु जोसेफ, MD, DCH, DM, Associate Professor, Paediatric Hematology-Oncology, CMC Vellore',
    proofNote: 'सक्कल हस्ताक्षरित पत्र:',
    donateTitle: 'रौनकको उपचारमा सहयोग गर्नुहोस्',
    donateSub: 'कुनै पनि UPI app बाट QR code स्क्यान गरेर सिधै परिवारलाई सहयोग गर्नुहोस्।',
    shareTitle: 'यो अपिल Share गर्नुहोस्',
    formTitle: 'सहयोगको सन्देश छोड्नुहोस्',
    formNote: 'यो फारमले तपाईंको नाम र सन्देश मात्र रेकर्ड गर्छ — यसले कुनै भुक्तानी प्रक्रिया गर्दैन। कृपया माथिको QR code स्क्यान गरेर आफ्नो दान पूरा गर्नुहोस्; यहाँको एन्ट्रीले परिवारलाई कसले सहयोग गर्‍यो भन्ने थाहा दिन्छ।',
    name: 'नाम', email: 'इमेल (वैकल्पिक)', amount: 'दान गरेको रकम (वैकल्पिक, ₹)', message: 'सन्देश (वैकल्पिक)',
    submit: 'पेश गर्नुहोस्', submitting: 'पेश गर्दै…',
    success: 'धन्यवाद — तपाईंको सन्देश रेकर्ड भयो। रौनकको परिवारले यो देख्नेछ।',
  },
};

function ShareIcon({ d }: { d: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d={d} /></svg>;
}

export default function FundraiserClient() {
  const [lang, setLang] = useState<Lang>('en');
  const t = content[lang];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${WORKER_URL}/donations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: email || undefined, amount: amount || undefined, message: message || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult({ ok: true, message: t.success });
      setName(''); setEmail(''); setAmount(''); setMessage('');
    } catch {
      setResult({ ok: false, message: lang === 'en' ? 'Something went wrong. Please try again.' : 'केही समस्या भयो। फेरि प्रयास गर्नुहोस्।' });
    }
    setSubmitting(false);
  }

  function copyLink() {
    navigator.clipboard?.writeText(PAGE_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const shareText = lang === 'en' ? SHARE_TEXT_EN : SHARE_TEXT_NE;

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7' }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${RED}, #8f1428)`, padding: '48px 20px 60px', textAlign: 'center', color: '#fff' }}>
        <a href="/" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>← Khabar Darjeeling</a>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '16px 0' }}>
          <button onClick={() => setLang('en')} style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: lang === 'en' ? GOLD : 'rgba(255,255,255,0.15)', color: lang === 'en' ? '#1a1a1a' : '#fff' }}>English</button>
          <button onClick={() => setLang('ne')} style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: lang === 'ne' ? GOLD : 'rgba(255,255,255,0.15)', color: lang === 'ne' ? '#1a1a1a' : '#fff' }}>नेपाली</button>
        </div>

        <h1 style={{ fontSize: 'clamp(26px, 5vw, 40px)', fontWeight: 800, margin: '12px auto 12px', maxWidth: '700px', lineHeight: 1.25 }}>{t.headline}</h1>
        <p style={{ fontSize: '16px', maxWidth: '560px', margin: '0 auto', color: 'rgba(255,255,255,0.92)', lineHeight: 1.6 }}>{t.subhead}</p>

        <a href="#donate" style={{ display: 'inline-block', marginTop: '24px', padding: '14px 32px', background: GOLD, color: '#1a1a1a', borderRadius: '30px', fontWeight: 800, fontSize: '15px', textDecoration: 'none' }}>
          {lang === 'en' ? '🙏 Support Raunak' : '🙏 रौनकलाई सहयोग गर्नुहोस्'}
        </a>
      </div>

      {/* Body */}
      <div style={{ maxWidth: '1080px', margin: '-30px auto 0', padding: '0 20px 60px', display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Main column */}
        <div style={{ flex: '2 1 480px', minWidth: '280px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div style={{ ...CARD, padding: '4px', overflow: 'hidden', flex: 1 }}>
              <div style={{ width: '100%', aspectRatio: '1/1', background: '#eee', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
                {lang === 'en' ? 'Raunak, before — photo to be added' : 'रौनक, पहिले — फोटो थपिनेछ'}
              </div>
            </div>
            <div style={{ ...CARD, padding: '4px', overflow: 'hidden', flex: 1 }}>
              <div style={{ width: '100%', aspectRatio: '1/1', background: '#eee', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
                {lang === 'en' ? 'Raunak, at CMC Vellore — photo to be added' : 'रौनक, CMC Vellore मा — फोटो थपिनेछ'}
              </div>
            </div>
          </div>

          <div style={{ ...CARD, padding: '28px 24px' }}>
            {t.story.map((p, i) => (
              <p key={i} style={{ fontSize: '16px', lineHeight: 1.8, color: '#333', marginBottom: '16px' }}>{p}</p>
            ))}
            <p style={{ fontSize: '17px', fontWeight: 700, color: RED, textAlign: 'center', marginTop: '24px', fontStyle: 'italic' }}>{t.quote}</p>
          </div>

          <div style={{ ...CARD, padding: '28px 24px', marginTop: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: RED, marginBottom: '10px' }}>{t.proofTitle}</h2>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '14px', lineHeight: 1.6 }}>{t.proofIntro}</p>
            <div style={{ background: '#fdf8f1', border: '1px solid #eee0c8', borderRadius: '10px', padding: '18px' }}>
              {t.proofBody.map((p, i) => (
                <p key={i} style={{ fontSize: '14px', lineHeight: 1.7, color: '#444', marginBottom: '12px' }}>{p}</p>
              ))}
              <p style={{ fontSize: '13px', color: '#666', fontWeight: 600, marginTop: '14px' }}>{t.proofSigned}</p>
            </div>
            <p style={{ fontSize: '12px', color: '#999', marginTop: '16px', marginBottom: '8px', fontWeight: 700 }}>{t.proofNote}</p>
            <img
              src="/assets/fundraiser/raunak/cmc-letter.jpg"
              alt="Official letter from CMC Vellore's Department of Paediatric Haematology Oncology confirming Raunak Chettri's diagnosis and treatment cost estimate"
              style={{ width: '100%', borderRadius: '10px', border: '1px solid #eee' }}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ flex: '1 1 300px', minWidth: '280px', position: 'sticky', top: '16px' }}>
          <div id="donate" style={{ ...CARD, padding: '24px', marginBottom: '20px', scrollMarginTop: '16px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#1a1a1a', marginBottom: '4px' }}>{t.donateTitle}</h2>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '18px' }}>{t.donateSub}</p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <img src="/assets/fundraiser/raunak/kapil-qr.png" alt="Kapil Chettri UPI QR code" style={{ width: '100%', borderRadius: '8px', border: '1px solid #eee' }} />
                <div style={{ fontSize: '12px', fontWeight: 700, marginTop: '6px' }}>Kapil Chettri</div>
                <div style={{ fontSize: '10px', color: '#999', wordBreak: 'break-all' }}>kapilchettri56@okicici</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <img src="/assets/fundraiser/raunak/bhumika-qr.png" alt="Bhumika Sharma UPI QR code" style={{ width: '100%', borderRadius: '8px', border: '1px solid #eee' }} />
                <div style={{ fontSize: '12px', fontWeight: 700, marginTop: '6px' }}>Bhumika Sharma</div>
                <div style={{ fontSize: '10px', color: '#999', wordBreak: 'break-all' }}>vhoomipranami-1@okicici</div>
              </div>
            </div>
          </div>

          <div style={{ ...CARD, padding: '24px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#1a1a1a', marginBottom: '14px' }}>{t.shareTitle}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + PAGE_URL)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#e8f9ef', color: '#1a7d3a', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>
                <ShareIcon d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.93 6.45 17.5 2 12.04 2zm5.83 14.09c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.13.11-1.82-.11-.42-.13-.96-.31-1.65-.61-2.91-1.26-4.81-4.19-4.95-4.38-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.27-.29.58-.36.78-.36l.56.01c.18.01.42-.07.66.5.24.58.83 2 .9 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.49-.14.14-.28.29-.12.56.16.28.7 1.16 1.51 1.88 1.04.93 1.91 1.22 2.19 1.36.28.14.44.12.6-.07.16-.19.68-.79.87-1.06.19-.28.37-.23.62-.14.26.09 1.63.77 1.91.91.28.14.47.21.53.33.07.13.07.72-.17 1.4z" />
                WhatsApp
              </a>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(PAGE_URL)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#eaf5fd', color: '#0f7bc4', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>
                <ShareIcon d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 01-1.93.07 4.28 4.28 0 004 2.98 8.521 8.521 0 01-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
                Twitter / X
              </a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(PAGE_URL)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#eaf0fd', color: '#1877F2', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>
                <ShareIcon d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
                Facebook
              </a>
              <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#f2f2f2', color: '#444', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>
                <ShareIcon d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
                {copied ? (lang === 'en' ? 'Copied!' : 'कपी भयो!') : (lang === 'en' ? 'Copy Link' : 'लिंक कपी गर्नुहोस्')}
              </button>
            </div>
          </div>

          <div style={{ ...CARD, padding: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#1a1a1a', marginBottom: '4px' }}>{t.formTitle}</h2>
            <p style={{ fontSize: '11px', color: '#999', marginBottom: '16px', lineHeight: 1.5 }}>{t.formNote}</p>

            {result && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', background: result.ok ? '#e8f5e9' : '#ffebee', color: result.ok ? '#2e7d32' : RED, fontSize: '13px', fontWeight: 600 }}>
                {result.message}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={LABEL}>{t.name} *</label>
                <input style={INPUT} type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={LABEL}>{t.email}</label>
                <input style={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={LABEL}>{t.amount}</label>
                <input style={INPUT} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={LABEL}>{t.message}</label>
                <textarea style={{ ...INPUT, minHeight: '70px', resize: 'vertical' }} value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              <button type="submit" disabled={submitting} style={{ width: '100%', padding: '12px', background: submitting ? '#999' : RED, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: submitting ? 'default' : 'pointer' }}>
                {submitting ? t.submitting : t.submit}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
