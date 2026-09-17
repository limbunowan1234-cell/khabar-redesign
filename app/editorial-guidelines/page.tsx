export const metadata = {
  title: 'Editorial Guidelines',
  description: 'Editorial Guidelines for Khabar Darjeeling — how we report, verify, and publish the news.',
  alternates: { canonical: 'https://khabardarjeeling.in/editorial-guidelines' }
};

const H2: React.CSSProperties = { fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' };

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
          <p>
            We prioritise stories with direct relevance to the Darjeeling, Kalimpong, Kurseong, Mirik,
            Siliguri, and wider Gorkha/hill community — local governance, safety alerts (weather,
            landslides, health), regional politics, culture, and community achievements. National and
            international stories are covered when they materially affect the region (e.g. flooding
            upstream in Nepal/Sikkim, policy changes affecting hill districts) or are of clear public
            interest to our readers. We do not run a story purely because it is trending elsewhere if it
            has no real relevance to our audience.
          </p>

          <h2 style={H2}>Fact-Checking Process</h2>
          <p>
            Before publishing, a reporter identifies and records at least one verifiable source for each
            material claim in a story — an official statement, a document, direct eyewitness testimony, or
            established reporting from another credible outlet. Breaking/developing stories (e.g. a
            landslide, an accident) may go up with an explicit "developing story" note while details are
            still being confirmed, and are updated as verified information comes in rather than left
            uncorrected.
          </p>

          <h2 style={H2}>Reporter and Contributor Standards</h2>
          <p>
            Staff reporters are expected to follow this document and our Code of Ethics in full. Reader
            contributions (opinion pieces, poetry, photo submissions, contest entries) are held to a
            lighter but real standard: no plagiarism, no hate speech or communal incitement, and clear
            labelling as reader-submitted rather than staff-reported content. Contributor bylines are never
            used to publish something the actual named person did not write or approve.
          </p>

          <h2 style={H2}>Language and Translation</h2>
          <p>
            We publish in Nepali, Hindi, and English. When a story is translated from one language to
            another, the translation is checked for accuracy of meaning, not just word-for-word
            correspondence — a mistranslation that changes a claim's meaning is treated as seriously as a
            factual error in the original language.
          </p>

          <h2 style={H2}>Images and Media</h2>
          <p>
            Images are either taken by our own contributors, submitted with the submitter's confirmation
            that they have the right to share them, or properly credited when sourced from elsewhere. We do
            not use manipulated or out-of-context images to illustrate a story, and stock/illustrative
            images are labelled as such rather than presented as photos of the actual event.
          </p>

          <h2 style={H2}>Anonymous Sources</h2>
          <p>
            We prefer named, on-record sources. Anonymity is granted only where a source faces real risk
            (retaliation, job loss, safety) for speaking on record, and only when an editor has confirmed
            the source's identity and credibility internally, even though it isn't published. We do not
            grant anonymity merely as a convenience to avoid attribution.
          </p>

          <h2 style={H2}>Sensitive Topics</h2>
          <p>
            Coverage of political unrest, statehood movements (e.g. Gorkhaland-related demonstrations),
            communal or ethnic tension, and crime involving minors or sexual violence is reviewed with
            extra care before publishing — checking language for anything that could be read as inflaming
            tension between communities, and following the privacy protections in our Code of Ethics for
            victims and minors.
          </p>

          <h2 style={H2}>Editorial Review and Sign-Off</h2>
          <p>
            Staff-reported news articles are reviewed by an editor before publishing. Reader-submitted
            content (contest entries, opinion pieces, photo stories) goes through a moderation check for
            the standards above before it goes live, but is not held to the same fact-checking bar as
            staff-reported news.
          </p>

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
