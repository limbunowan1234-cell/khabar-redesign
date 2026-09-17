export const metadata = {
  title: 'Code of Ethics',
  description: 'Code of Ethics for Khabar Darjeeling — the editorial principles we hold ourselves to as a news publisher.',
  alternates: { canonical: 'https://khabardarjeeling.in/code-of-ethics' }
};

const H2: React.CSSProperties = { fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' };
const PLACEHOLDER: React.CSSProperties = { background: '#fff8e1', border: '1px dashed #e0c060', borderRadius: '10px', padding: '14px 16px', color: '#8a6d1a', fontSize: '14px', fontStyle: 'italic' };

export default function CodeOfEthicsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', padding: '40px 20px 100px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#c41e3a', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>← Back to Home</a>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#1a1a1a', margin: '16px 0 8px' }}>Code of Ethics</h1>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px' }}>Last updated: {new Date().getFullYear()}</p>

        <div style={{ color: '#333', fontSize: '16px', lineHeight: 1.7 }}>
          <p>
            Khabar Darjeeling is a digital news publisher under the Information Technology (Intermediary
            Guidelines and Digital Media Ethics Code) Rules, 2021. In line with Rule 3 of that framework,
            we hold our reporting to the Norms of Journalistic Conduct set out by the Press Council of
            India, and to the additional principles below.
          </p>

          <h2 style={H2}>Accuracy and Verification</h2>
          <div style={PLACEHOLDER}>[Paste your Accuracy and Verification policy here.]</div>

          <h2 style={H2}>Fairness and Impartiality</h2>
          <div style={PLACEHOLDER}>[Paste your Fairness and Impartiality policy here.]</div>

          <h2 style={H2}>Sourcing and Attribution</h2>
          <div style={PLACEHOLDER}>[Paste your Sourcing and Attribution policy here.]</div>

          <h2 style={H2}>Privacy and Sensitivity</h2>
          <div style={PLACEHOLDER}>[Paste your Privacy and Sensitivity policy here — e.g. minors, victims of crime, communal/religious sensitivity.]</div>

          <h2 style={H2}>Conflicts of Interest</h2>
          <div style={PLACEHOLDER}>[Paste your Conflicts of Interest policy here.]</div>

          <h2 style={H2}>Corrections and Retractions</h2>
          <div style={PLACEHOLDER}>[Paste your Corrections and Retractions policy here.]</div>

          <h2 style={H2}>User-Generated Content and Comments</h2>
          <div style={PLACEHOLDER}>[Paste your policy on comments, reader submissions, and moderation here.]</div>

          <h2 style={H2}>Advertising and Sponsored Content</h2>
          <div style={PLACEHOLDER}>[Paste your policy on labeling sponsored/advertising content here.]</div>

          <h2 style={H2}>Grievance Redressal</h2>
          <p>
            If you believe a piece of our content violates this Code of Ethics, you can file a complaint
            through our <a href="/grievance" style={{ color: '#c41e3a', fontWeight: 700 }}>Grievance Redressal</a> page.
            We aim to acknowledge every complaint within 24 hours and resolve it within 15 days, as required
            under Rule 13 of the IT Rules, 2021.
          </p>

          <h2 style={H2}>Contact</h2>
          <p>For questions about this Code of Ethics, email us at <a href="mailto:nowanad@gmail.com" style={{ color: '#c41e3a' }}>nowanad@gmail.com</a>.</p>
        </div>
      </div>
    </div>
  );
}
