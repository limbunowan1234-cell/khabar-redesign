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
              <a href="/terms" style={linkStyle}>Terms of Service</a>
            </div>
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: isDarkMode ? '#fff' : '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Follow</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a href="https://www.facebook.com/profile.php?id=61590708777947" target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, display: 'flex', alignItems: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>Facebook</a>
              <a href="https://www.instagram.com/khabardarjeeling_2026" target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, display: 'flex', alignItems: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}><path d="M12 2c2.72 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.46.66.25 1.22.6 1.77 1.15.55.55.9 1.11 1.15 1.77.24.64.41 1.37.46 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.46 2.43a4.9 4.9 0 01-1.15 1.77 4.9 4.9 0 01-1.77 1.15c-.64.24-1.37.41-2.43.46-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.46a4.9 4.9 0 01-1.77-1.15 4.9 4.9 0 01-1.15-1.77c-.24-.64-.41-1.37-.46-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.46-2.43.25-.66.6-1.22 1.15-1.77A4.9 4.9 0 015.44 2.53c.64-.24 1.37-.41 2.43-.46C8.94 2.01 9.28 2 12 2zm0 5a5 5 0 100 10 5 5 0 000-10zm0 8.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4zm5.2-8.4a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z"/></svg>Instagram</a>
              <a href="https://wa.me/message" target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, display: 'flex', alignItems: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.93 6.45 17.5 2 12.04 2zm5.83 14.09c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.13.11-1.82-.11-.42-.13-.96-.31-1.65-.61-2.91-1.26-4.81-4.19-4.95-4.38-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.27-.29.58-.36.78-.36l.56.01c.18.01.42-.07.66.5.24.58.83 2 .9 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.49-.14.14-.28.29-.12.56.16.28.7 1.16 1.51 1.88 1.04.93 1.91 1.22 2.19 1.36.28.14.44.12.6-.07.16-.19.68-.79.87-1.06.19-.28.37-.23.62-.14.26.09 1.63.77 1.91.91.28.14.47.21.53.33.07.13.07.72-.17 1.4z"/></svg>WhatsApp</a>
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
