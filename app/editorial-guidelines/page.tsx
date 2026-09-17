export const metadata = {
  title: 'Editorial Guidelines',
  description: 'Editorial Guidelines for Khabar Darjeeling — how we report, verify, and publish the news.',
  alternates: { canonical: 'https://khabardarjeeling.in/editorial-guidelines' }
};

const H2: React.CSSProperties = { fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' };
const PLACEHOLDER: React.CSSProperties = { background: '#fff8e1', border: '1px dashed #e0c060', borderRadius: '10px', padding: '14px 16px', color: '#8a6d1a', fontSize: '14px', fontStyle: 'italic' };

export default function EditorialGuidelinesPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', padding: '40px 20px 100px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#c41e3a', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>← Back to Home</a>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#1a1a1a', margin: '16px 0 8px' }}>Editorial Guidelines</h1>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px' }}>Last updated: {new Date().getFullYear()}</p>

        <div style={{ color: '#333', fontSize: '16px', lineHeight: 1.7 }}>
          <p>
            These Editorial Guidelines set out how Khabar Darjeeling's staff, reporters, and contributors
            gather, verify, and publish content, in support of the principles in our{' '}
            <a href="/code-of-ethics" style={{ color: '#c41e3a', fontWeight: 700 }}>Code of Ethics</a>.
          </p>

          <h2 style={H2}>Story Selection</h2>
          <div style={PLACEHOLDER}>[Paste your story selection criteria here — e.g. relevance to the Darjeeling/Gorkha community, public interest.]</div>

          <h2 style={H2}>Fact-Checking Process</h2>
          <div style={PLACEHOLDER}>[Paste your fact-checking process here — how many sources required, verification steps before publishing.]</div>

          <h2 style={H2}>Reporter and Contributor Standards</h2>
          <div style={PLACEHOLDER}>[Paste your standards for staff reporters vs. reader contributors/citizen journalists here.]</div>

          <h2 style={H2}>Language and Translation</h2>
          <div style={PLACEHOLDER}>[Paste your guidelines for Nepali/Hindi/English content and translation accuracy here.]</div>

          <h2 style={H2}>Images and Media</h2>
          <div style={PLACEHOLDER}>[Paste your policy on image sourcing, credit, and manipulation here.]</div>

          <h2 style={H2}>Anonymous Sources</h2>
          <div style={PLACEHOLDER}>[Paste your policy on when and how anonymous sources may be used here.]</div>

          <h2 style={H2}>Sensitive Topics</h2>
          <div style={PLACEHOLDER}>[Paste your guidelines for reporting on political unrest, communal issues, crime victims, and minors here.]</div>

          <h2 style={H2}>Editorial Review and Sign-Off</h2>
          <div style={PLACEHOLDER}>[Paste your internal review/approval process before publishing here.]</div>

          <h2 style={H2}>Related Policies</h2>
          <p>
            See also our <a href="/code-of-ethics" style={{ color: '#c41e3a', fontWeight: 700 }}>Code of Ethics</a>,{' '}
            <a href="/privacy" style={{ color: '#c41e3a', fontWeight: 700 }}>Privacy Policy</a>, and{' '}
            <a href="/grievance" style={{ color: '#c41e3a', fontWeight: 700 }}>Grievance Redressal</a> process.
          </p>

          <h2 style={H2}>Contact</h2>
          <p>For questions about these Editorial Guidelines, email us at <a href="mailto:nowanad@gmail.com" style={{ color: '#c41e3a' }}>nowanad@gmail.com</a>.</p>
        </div>
      </div>
    </div>
  );
}
