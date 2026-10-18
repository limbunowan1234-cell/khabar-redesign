import type { Metadata } from 'next';
import SimonGame from './SimonGame';

const URL = 'https://khabardarjeeling.in/play/simon-speed';

export const metadata: Metadata = {
  title: 'Play Simon Speed Online - Monthly Leaderboard',
  description: 'Play Simon Speed free in your browser. Watch the neon pads, repeat the pattern and climb the monthly Top 10 in Easy, Medium and Hard. Made by Darjeeling Web Studio.',
  alternates: { canonical: URL },
  openGraph: {
    title: 'Simon Speed - can you make the Top 10?',
    description: 'A neon memory game with a monthly leaderboard for Easy, Medium and Hard.',
    url: URL,
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default function SimonSpeedPage() {
  return <SimonGame />;
}
