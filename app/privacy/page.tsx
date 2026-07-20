export const metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Khabar Darjeeling — how we collect, use, and protect your information.',
  alternates: { canonical: 'https://khabardarjeeling.space/privacy' }
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', padding: '40px 20px 100px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#c41e3a', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>← Back to Home</a>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#1a1a1a', margin: '16px 0 8px' }}>Privacy Policy</h1>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px' }}>Last updated: {new Date().getFullYear()}</p>

        <div style={{ color: '#333', fontSize: '16px', lineHeight: 1.7 }}>
          <p>Khabar Darjeeling ("we", "our", "us") operates the website khabardarjeeling.space. This page explains how we handle your information when you use our news platform.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Information We Collect</h2>
          <p>When you create an account, we collect your name, email address, and any profile details you choose to add (photo, bio). When you read articles, comment, like, or bookmark, we store this activity to power your profile, followers, and personalized experience. We may also collect basic technical data such as device type and browser for security and analytics.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>How We Use Your Information</h2>
          <p>We use your information to provide and improve the service, display your profile and contributions, respond to your messages, keep the platform secure, and understand how readers use the site so we can make it better.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Cookies</h2>
          <p>We use cookies to keep you logged in and to remember your preferences. Third-party services we use, including advertising and analytics partners, may also set cookies to serve relevant content and measure performance. You can control cookies through your browser settings.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Push Notifications</h2>
          <p>Users can opt in to receive browser push notifications about new articles and updates. When you subscribe, we collect your browser endpoint, encryption keys (p256dh and auth token), and user ID to deliver notifications. Push subscriptions can be disabled at any time from your browser settings or by clicking the notification bell on our site. We do not share push subscription data with third parties.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Advertising</h2>
          <p>We may display advertisements served by third-party ad networks such as Google AdSense. These partners may use cookies and similar technologies to show ads based on your visits to this and other websites. Google's use of advertising cookies enables it and its partners to serve ads based on your visit to our site. You can opt out of personalized advertising by visiting Google's Ads Settings.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Third-Party Services</h2>
          <p>We rely on trusted providers to run the platform, including Appwrite for data and authentication, Vercel for hosting, and Cloudflare for security and delivery. These providers process data only as needed to operate the service.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Your Rights</h2>
          <p>You can access, update, or delete your account information at any time from your profile. To request full deletion of your data, contact us at the email below.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Children's Privacy</h2>
          <p>Our service is not directed to children under 13, and we do not knowingly collect their personal information.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Data Retention</h2>
          <p>We retain your account data for as long as your account is active. If you delete your account, we remove your personal data within 30 days, except where required by law.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Contact</h2>
          <p>For any questions about this Privacy Policy, email us at <a href="mailto:nowanad@gmail.com" style={{ color: '#c41e3a' }}>nowanad@gmail.com</a>.</p>
        </div>
      </div>
    </div>
  );
}
