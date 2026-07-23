import type { Metadata } from 'next';
import WeeklyClient from './WeeklyClient';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const SITE = 'https://khabardarjeeling.in';

async function fetchWeeklyData(): Promise<{ articles: any[]; allIssues: number[]; currentIssue: number | null }> {
  try {
    const q = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'weeklyLive', values: [true] }));
    const res = await fetch(
      ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + q + '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [200] })),
      { headers: { 'X-Appwrite-Project': PROJECT }, next: { revalidate: 300 } }
    );
    if (!res.ok) return { articles: [], allIssues: [], currentIssue: null };
    const data = await res.json();
    const docs = data.documents || [];

    const issueNumbers = Array.from(new Set(docs.map((d: any) => d.weeklyIssue).filter(Boolean))).sort((a: any, b: any) => b - a) as number[];
    const currentIssue = issueNumbers[0] || null;
    const articles = docs.filter((d: any) => d.weeklyIssue === currentIssue);

    return { articles, allIssues: issueNumbers, currentIssue };
  } catch {
    return { articles: [], allIssues: [], currentIssue: null };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { currentIssue } = await fetchWeeklyData();
  const title = currentIssue
    ? 'Khabar Darjeeling Weekly - Issue ' + String(currentIssue).padStart(2, '0')
    : 'Khabar Darjeeling Weekly';
  const description = 'Khabar Darjeeling Weekly - the digital newspaper edition featuring the best stories from Darjeeling, Kalimpong, Kurseong and the Gorkha community, published every Sunday.';
  return {
    title,
    description,
    alternates: { canonical: SITE + '/weekly' },
    openGraph: { title, description, url: SITE + '/weekly', siteName: 'Khabar Darjeeling' },
  };
}

export default async function Page() {
  const { articles, allIssues, currentIssue } = await fetchWeeklyData();
  return <WeeklyClient initialArticles={articles} initialAllIssues={allIssues} initialCurrentIssue={currentIssue} />;
}
