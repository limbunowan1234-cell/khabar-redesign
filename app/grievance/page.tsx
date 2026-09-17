import GrievanceForm from './GrievanceForm';

export const metadata = {
  title: 'Grievance Redressal',
  description: 'File a grievance with Khabar Darjeeling about our content or platform, under the IT Rules, 2021.',
  alternates: { canonical: 'https://khabardarjeeling.in/grievance' }
};

export default function GrievancePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', padding: '40px 20px 100px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#c41e3a', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>← Back to Home</a>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#1a1a1a', margin: '16px 0 8px' }}>Grievance Redressal</h1>

        <div style={{ color: '#333', fontSize: '16px', lineHeight: 1.7, marginBottom: '28px' }}>
          <p>
            Under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code)
            Rules, 2021, we operate a Grievance Redressal mechanism. If you have a complaint about our
            content or platform, use the form below.
          </p>
          <p>
            <strong>What happens next:</strong> we acknowledge every grievance within 24 hours and aim to
            resolve it within 15 days. If you're not satisfied with our response, you may escalate to our
            self-regulatory body, and from there to the Ministry of Information &amp; Broadcasting's
            oversight mechanism.
          </p>
        </div>

        <GrievanceForm />

        <div style={{ marginTop: '32px', padding: '18px', background: '#f9f9f9', borderRadius: '14px', color: '#555', fontSize: '14px', lineHeight: 1.6 }}>
          You can also email us directly at{' '}
          <a href="mailto:grievance@khabardarjeeling.in" style={{ color: '#c41e3a', fontWeight: 700 }}>grievance@khabardarjeeling.in</a>.
        </div>
      </div>
    </div>
  );
}
