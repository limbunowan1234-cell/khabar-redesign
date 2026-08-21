import type { Metadata } from 'next';
import BhasaDiwasSubmissionDetail from '@/components/bhasa-diwas/BhasaDiwasSubmissionDetail';

const SITE = 'https://khabardarjeeling.in';
// Week 11 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

const CATEGORY_LABELS: Record<string, string> = {
  poetry: 'Poetry',
  essay: 'Essay',
  photo: 'Photography'
};

function clean(text: string, max = 150): string {
  if (!text) return 'A Nepali Bhasa Diwas submission on Khabar Darjeeling.';
  const t = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max).trim() + '...' : t;
}

async function fetchSubmission(id: string): Promise<any> {
  try {
    const res = await fetch(WORKER_URL + '/bhasa-diwas/submissions/' + encodeURIComponent(id), { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const sub = await fetchSubmission(id);
  if (!sub) return { title: 'Submission | Nepali Bhasa Diwas | Khabar Darjeeling' };

  const categoryLabel = CATEGORY_LABELS[sub.category] || sub.category;
  const title = sub.title + ' - ' + categoryLabel + ' | Nepali Bhasa Diwas';
  const description = clean(sub.description);
  const url = SITE + '/nepali-bhasa-diwas/' + id;
  const image = sub.imageFileId
    ? SITE + '/api/image-proxy?fileId=' + sub.imageFileId + '&bucket=6a67a307002f71e8dcf5'
    : SITE + '/assets/bhasa-diwas-hero.png';
  const looksLowQuality = (sub.title || '').trim().length < 5 || (sub.description || '').trim().length < 100;


  return {
    title,
    robots: looksLowQuality ? { index: false, follow: true } : { index: true, follow: true },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Khabar Darjeeling',
      type: 'article',
      publishedTime: sub.$createdAt,
      authors: [sub.submitterName || 'Khabar Darjeeling'],
      images: [{ url: image, width: 1200, height: 630, alt: sub.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BhasaDiwasSubmissionDetail id={id} />;
}
