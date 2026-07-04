'use client';

export default function SiteFooter({ isDarkMode }: { isDarkMode?: boolean }) {
  const year = new Date().getFullYear();
  const linkStyle = { color: isDarkMode ? '#ccc' : '#555', textDecoration: 'none', fontSize: '14px' };
  return (
    <footer style={{ background: isDarkMode ? '#161616' : '#f7f7f7', borderTop: '3px solid #f5c518', padding: '32px 20px 90px', marginTop: '40px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ flex: '1 1 220px' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#c41e3a', marginBottom: '6px' }}>Khabar Darjeeling</div>
            <div style={{ fontSize: '13px', color: isDarkMode ? '#999' : '#888', lineHeight: 1.5 }}>The Digital Home of Darjeeling. Trusted local news for the Darjeeling &amp; Gorkha community.</div>
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: isDarkMode ? '#fff' : '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Company</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a href="/about" style={linkStyle}>About Us</a>
              <a href="/contact" style={linkStyle}>Contact</a>
              <a href="/privacy" style={linkStyle}>Privacy Policy</a>
            </div>
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: isDarkMode ? '#fff' : '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Follow</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a href="https://www.facebook.com/profile.php?id=61590708777947" target="_blank" rel="noopener noreferrer" style={linkStyle}>Facebook</a>
              <a href="https://www.instagram.com/khabardarjeeling_2026" target="_blank" rel="noopener noreferrer" style={linkStyle}>Instagram</a>
              <a href="https://wa.me/message" target="_blank" rel="noopener noreferrer" style={linkStyle}>WhatsApp</a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid ' + (isDarkMode ? '#2a2a2a' : '#e5e5e5'), paddingTop: '16px', fontSize: '12px', color: isDarkMode ? '#888' : '#999', textAlign: 'center', lineHeight: 1.6 }}>
          © {year} Khabar Darjeeling. All rights reserved.<br />
          Published by Darjeeling Web Studio · Darjeeling, West Bengal, India
        </div>
      </div>
    </footer>
  );
}
