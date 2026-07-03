export const metadata = {
  title: 'Contact Us',
  description: 'Contact Khabar Darjeeling — send us news tips, feedback, or business inquiries.',
  alternates: { canonical: 'https://khabardarjeeling.space/contact' }
};

export default function ContactPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', padding: '40px 20px 100px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#c41e3a', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>← Back to Home</a>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#1a1a1a', margin: '16px 0 24px' }}>Contact Us</h1>

        <div style={{ color: '#333', fontSize: '16px', lineHeight: 1.7, marginBottom: '32px' }}>
          <p>We'd love to hear from you. Whether you have a news tip, feedback, a correction, or a business inquiry, reach out through any of the channels below and we'll get back to you.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <a href="mailto:nowanad@gmail.com" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', background: '#f9f9f9', borderRadius: '14px', textDecoration: 'none', color: '#1a1a1a', border: '1px solid #eee' }}>
            <span style={{ fontSize: '24px' }}>✉️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Email</div>
              <div style={{ color: '#c41e3a', fontSize: '14px' }}>nowanad@gmail.com</div>
            </div>
          </a>

          <a href="https://wa.me/message" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', background: '#f9f9f9', borderRadius: '14px', textDecoration: 'none', color: '#1a1a1a', border: '1px solid #eee' }}>
            <span style={{ fontSize: '24px' }}>💬</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>WhatsApp</div>
              <div style={{ color: '#25D366', fontSize: '14px' }}>Message us on WhatsApp</div>
            </div>
          </a>

          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', background: '#f9f9f9', borderRadius: '14px', textDecoration: 'none', color: '#1a1a1a', border: '1px solid #eee' }}>
            <span style={{ fontSize: '24px' }}>📘</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Facebook</div>
              <div style={{ color: '#1877F2', fontSize: '14px' }}>Follow us on Facebook</div>
            </div>
          </a>

          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', background: '#f9f9f9', borderRadius: '14px', textDecoration: 'none', color: '#1a1a1a', border: '1px solid #eee' }}>
            <span style={{ fontSize: '24px' }}>📷</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Instagram</div>
              <div style={{ color: '#E4405F', fontSize: '14px' }}>Follow us on Instagram</div>
            </div>
          </a>
        </div>

        <div style={{ marginTop: '32px', padding: '18px', background: 'linear-gradient(135deg, rgba(196,30,58,0.08), rgba(245,197,24,0.05))', borderRadius: '14px', color: '#555', fontSize: '14px', lineHeight: 1.6 }}>
          <strong style={{ color: '#c41e3a' }}>Editorial Office:</strong> Darjeeling, West Bengal, India<br />
          Published by Darjeeling Web Studio
        </div>
      </div>
    </div>
  );
}
