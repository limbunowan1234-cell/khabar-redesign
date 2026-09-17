export const metadata = {
  title: 'Code of Ethics',
  description: 'Code of Ethics for Khabar Darjeeling — the editorial principles we hold ourselves to as a news publisher.',
  alternates: { canonical: 'https://khabardarjeeling.in/code-of-ethics' }
};

const H2: React.CSSProperties = { fontSize: '20px', fontWeight: 800, color: '#c41e3a', margin: '28px 0 10px' };

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
          <p>
            We publish only what we have taken reasonable steps to verify. Every factual claim — a
            number, a quote, an official statement, a death toll, an election result — is checked
            against at least one primary source (an official statement, a document, a named witness, or
            direct reporting) before publication wherever one is available. Where a story develops
            quickly and full verification isn't yet possible, we say so plainly in the piece rather than
            presenting an unconfirmed claim as settled fact. We do not publish rumours, unverified social
            media claims, or forwarded messages as news.
          </p>

          <h2 style={H2}>Fairness and Impartiality</h2>
          <p>
            We report on politics, community disputes, and public issues in the Darjeeling and Gorkha
            region without favouring any political party, candidate, or organisation. Where a story
            involves a dispute or an accusation against a person or institution, we make a genuine effort
            to include their side, or to record that they were asked and declined to respond. Opinion and
            editorial pieces are clearly labelled as such and kept distinct from news reporting.
          </p>

          <h2 style={H2}>Sourcing and Attribution</h2>
          <p>
            We attribute information to its source wherever possible — an official, an eyewitness, a
            document, another outlet's reporting. When we republish or build on reporting first done by
            another publication, we credit it. We do not present someone else's original reporting as our
            own.
          </p>

          <h2 style={H2}>Privacy and Sensitivity</h2>
          <p>
            We take particular care in reporting on minors, victims of crime and sexual violence, medical
            conditions, and communally or religiously sensitive matters. We do not identify minors involved
            in criminal cases (as victims, witnesses, or accused) or survivors of sexual violence, and we
            avoid publishing content likely to incite communal or ethnic tension between communities in the
            hills. Personal details unrelated to the public interest of a story (home addresses, phone
            numbers, financial details) are withheld unless the person has consented or the information is
            already lawfully public.
          </p>

          <h2 style={H2}>Conflicts of Interest</h2>
          <p>
            Our reporters and contributors disclose any personal, financial, political, or family
            connection to a story they are covering, and do not cover stories where that connection would
            reasonably be seen to compromise their objectivity. Sponsored content and paid partnerships
            are handled entirely separately from editorial coverage and never influence what we choose to
            report on or how we report it.
          </p>

          <h2 style={H2}>Corrections and Retractions</h2>
          <p>
            When we get something wrong, we correct it. Factual errors are corrected as soon as we're
            aware of them, with a visible note on the article stating what was changed and when. Where an
            error is serious enough to have misled readers in a material way, we publish a clear
            retraction rather than a quiet edit. Anyone can report a suspected error to us through our{' '}
            <a href="/grievance" style={{ color: '#c41e3a', fontWeight: 700 }}>Grievance Redressal</a> page
            or by emailing us directly.
          </p>

          <h2 style={H2}>User-Generated Content and Comments</h2>
          <p>
            Reader comments and reader-submitted content (photos, poetry, opinion pieces, contest entries)
            are welcomed but moderated. We remove content that is defamatory, incites violence or hatred
            against any community, harasses an individual, or is sexually explicit. Comments are attached
            to the commenter's own account and are not treated as our own editorial statements, but we
            still take responsibility for moderating what remains visible on our platform.
          </p>

          <h2 style={H2}>Advertising and Sponsored Content</h2>
          <p>
            Advertisements and sponsored content are visually and textually distinguished from our
            editorial content and labelled as such. We do not accept advertising for products or services
            we know to be fraudulent, illegal, or harmful, and advertisers have no influence over our
            independent news coverage.
          </p>

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
