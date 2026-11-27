'use client';
import Link from 'next/link';

export default function Terms() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <header style={{ backgroundColor: '#c41e3a', color: 'white', padding: '20px', textAlign: 'center', borderBottom: '3px solid #f5c518' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800' }}>Terms of Service</h1>
      </header>
      
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', backgroundColor: 'white', marginTop: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '30px' }}>
          <strong>Effective Date:</strong> July 2026
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#c41e3a', marginTop: '30px', marginBottom: '12px' }}>1. Acceptance of Terms</h2>
        <p>By accessing and using Khabar Darjeeling (khabardarjeeling.in), you agree to be bound by these Terms of Service. If you do not agree, do not use this site.</p>

        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#c41e3a', marginTop: '30px', marginBottom: '12px' }}>2. Intellectual Property & Copyright</h2>
        <p>All content published on Khabar Darjeeling is the intellectual property of <strong>Khabar Darjeeling</strong> or its contributing writers, and is protected by copyright law.</p>
        <p><strong>Writer Attribution:</strong> Each article is credited to a named writer. The writer's name must be visibly credited in any permitted use.</p>

        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#c41e3a', marginTop: '30px', marginBottom: '12px' }}>3. Permitted Use</h2>
        <p>You may:</p>
        <ul style={{ marginLeft: '20px' }}>
          <li><strong>View and read</strong> articles for personal, non-commercial use</li>
          <li><strong>Share individual articles</strong> on social media with the original source link intact</li>
          <li><strong>Quote short excerpts</strong> (under 150 words) for commentary, provided you credit Khabar Darjeeling and link to the full article</li>
        </ul>

        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#c41e3a', marginTop: '30px', marginBottom: '12px' }}>4. Prohibited Use</h2>
        <p>You may <strong>not</strong>:</p>
        <ul style={{ marginLeft: '20px' }}>
          <li>Reproduce or republish entire articles without written permission</li>
          <li>Use automated tools (scrapers, bots) to extract content</li>
          <li>Use our content for commercial purposes</li>
          <li>Remove or alter copyright notices or writer credits</li>
          <li>Mirror our content on another website</li>
          <li>Use our articles to train AI models without permission</li>
        </ul>

        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#c41e3a', marginTop: '30px', marginBottom: '12px' }}>5. User-Generated Content</h2>
        <p>Comments and replies remain your property, but grant Khabar Darjeeling permission to display and moderate them. We may delete comments at our sole discretion.</p>

        <h3 id="community-rules" style={{ fontSize: '16px', fontWeight: '800', marginTop: '18px', marginBottom: '8px' }}>Community rules (website and Android app)</h3>
        <p>Anyone posting a comment, story, poem, photo or opinion on Khabar Darjeeling agrees to these rules. We have <strong>zero tolerance</strong> for objectionable content and abusive users. Do not post:</p>
        <ul style={{ marginLeft: '20px' }}>
          <li>Hate speech, or attacks on anyone for their community, caste, religion, gender, sexuality, disability or origin</li>
          <li>Harassment, bullying, threats, or encouragement of violence or self-harm</li>
          <li>Sexual or pornographic content, or anything that sexualises minors</li>
          <li>Spam, advertising, scams, or links to malware</li>
          <li>False news presented as fact, or impersonation of another person or organisation</li>
          <li>Other people's private information, or content you do not have the rights to</li>
          <li>Anything illegal under Indian law</li>
        </ul>
        <h3 style={{ fontSize: '16px', fontWeight: '800', marginTop: '18px', marginBottom: '8px' }}>Reporting and blocking</h3>
        <p>Every comment and story has a <strong>Report</strong> option, and in the Android app you can also <strong>Block</strong> a user to hide everything they post. Reports come to our editors, who review them within 24 hours. A comment reported by several readers is hidden until it is reviewed. Content that breaks these rules is removed, and accounts that break them are suspended or banned. You can also email reports to <strong>contact@khabardarjeeling.in</strong>.</p>

        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#c41e3a', marginTop: '30px', marginBottom: '12px' }}>6. Disclaimers</h2>
        <p>Content is provided "as-is" without warranty. We do not guarantee accuracy or timeliness. We are not liable for decisions made based on our content.</p>

        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#c41e3a', marginTop: '30px', marginBottom: '12px' }}>7. Contact</h2>
        <p>For permissions or copyright concerns:</p>
        <ul style={{ marginLeft: '20px' }}>
          <li><strong>Email:</strong> <a href="mailto:contact@khabardarjeeling.in" style={{ color: '#c41e3a', textDecoration: 'none', fontWeight: '700' }}>contact@khabardarjeeling.in</a></li>
        </ul>

        <hr style={{ margin: '40px 0', border: 'none', borderTop: '1px solid #ddd' }} />
        <p style={{ fontSize: '13px', color: '#888', textAlign: 'center', marginTop: '30px' }}>
          © 2026 Khabar Darjeeling. All rights reserved.
        </p>
      </div>

      <footer style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
        <Link href="/" style={{ color: '#c41e3a', textDecoration: 'none', fontWeight: '700' }}>← Back to Home</Link>
      </footer>
    </div>
  );
}
