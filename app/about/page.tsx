export const metadata = {
  title: 'About Us',
  description: 'About Khabar Darjeeling — the digital home of Darjeeling and the Gorkha community.',
  alternates: { canonical: 'https://khabardarjeeling.in/about' }
};

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', padding: '40px 20px 100px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#c41e3a', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>← Back to Home</a>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#1a1a1a', margin: '16px 0 24px' }}>About Khabar Darjeeling</h1>

        <div style={{ color: '#333', fontSize: '16px', lineHeight: 1.7 }}>
          <p style={{ fontSize: '18px', fontWeight: 600, color: '#c41e3a', marginBottom: '20px' }}>The Digital Home of Darjeeling.</p>

          <p>Khabar Darjeeling is a digital news platform built for the people of Darjeeling, Kalimpong, Kurseong, Mirik, and the wider Gorkha community. Our mission is to deliver fast, reliable, and locally rooted news that matters to the hills — in English, Hindi, and Nepali.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>What We Cover</h2>
          <p>From breaking local news and politics to tea garden updates, tourism, education, sports, culture, and community stories, we bring the voices of the hills to one trusted place. We cover the stories national outlets often overlook.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Citizen Journalism</h2>
          <p>We believe the community tells its own story best. Khabar Darjeeling empowers local writers and citizen journalists to publish, earn recognition through our tier and badge system, and build an audience — giving everyday people a platform to inform and connect.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Our Values</h2>
          <p>Accuracy, community, and independence guide everything we publish. We aim to be a platform the hills can trust, built with modern technology to stay fast, accessible, and free to read.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Who We Are</h2>
          <p>Khabar Darjeeling is an independent digital media project developed by Darjeeling Web Studio, dedicated to strengthening the online presence and voice of the Darjeeling and Gorkha community.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' }}>Get In Touch</h2>
          <p>Have a story, tip, or feedback? Reach us at <a href="mailto:nowanad@gmail.com" style={{ color: '#c41e3a' }}>nowanad@gmail.com</a> or visit our <a href="/contact" style={{ color: '#c41e3a' }}>Contact page</a>.</p>
        </div>
      </div>
    </div>
  );
}
  
