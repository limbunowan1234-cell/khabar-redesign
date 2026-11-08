import Link from 'next/link';
import styles from './PostStoryPromo.module.css';

// Photo banner that sits between stories and invites readers to write.
// Posting is free for everyone, which the badge and the button both say.
const PHOTO = 'https://khabar-worker.limbunowan1234.workers.dev/cdn/articles/45424665-7f42-41d1-87cf-70b79375e360.jpg';

const PROMPTS = [
  { kicker: 'Write what the hills taught you', line: 'A festival your family has kept alive for generations.' },
  { kicker: 'Every lane has a story', line: 'The tea-garden path you walk every single morning.' },
  { kicker: 'Tell it your way', line: 'A small act of kindness that someone showed you.' },
  { kicker: 'Be the first to report it', line: 'What is changing in your village this week?' },
];

const IDEAS = ['A local hero', 'A festival memory', 'Your village today', 'A poem or a recipe'];

// `index` picks a different prompt each time the banner repeats in a feed.
// Article pages pass their own heading and button wording ("Write yours").
export default function PostStoryPromo({
  index = 0,
  heading = 'Your story belongs on Khabar Darjeeling',
  buttonLabel = 'Post your story — it’s free',
}: {
  index?: number;
  heading?: string;
  buttonLabel?: string;
}) {
  const prompt = PROMPTS[index % PROMPTS.length];
  return (
    <aside className={styles.promo} aria-label="Post your story">
      <div className={styles.photo} style={{ backgroundImage: 'url(' + PHOTO + ')' }} />
      <div className={styles.shade} />
      <div className={styles.body}>
        <span className={styles.badge}>Free for everyone</span>
        <h3 className={styles.title}>{heading}</h3>
        <p className={styles.kicker}>{prompt.kicker}</p>
        <p className={styles.line}>&ldquo;{prompt.line}&rdquo;</p>
        <div className={styles.chips} aria-hidden="true">
          {IDEAS.map((idea) => <span key={idea} className={styles.chip}>{idea}</span>)}
        </div>
        <Link href="/post" className={styles.btn}>{buttonLabel} <span aria-hidden="true">&rarr;</span></Link>
      </div>
      <span className={styles.credit}>Photo: Johannes Bahrdt / Wikimedia Commons (CC BY-SA 4.0)</span>
    </aside>
  );
}
