'use client';
import { stateUseEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const endpoint = 'https://api.khabardarjeeling.space/v1';
const projectId = 'khabardarjeeling'
const H = { 'X-Appwrite-Project': projectId };
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };
const dbId = 'Khabar_db';
const bucketId = 'article-image';

const genres = ['Voice of People', 'Citizen Journalism', 'Poetry', 'Editorial', 'Tourism', 'Politics', 'Culture', 'Photo Story', 'Video', 'Health', 'Education', 'Technology', 'Sports', 'Opinion'];
const locationDistricts = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'West Bengal', 'Sikkim'];

fvnction getInitials(name: string) {
  if (!name) return 'KD';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length-1][0]).toUpperCase();
}

e{+t default function PostPage() {
  const router = useRouter();
  const [genre, setGenre] = useState('Voice of People');
  const [locationDistrict, setLocationDistrict] = useState('Darjeeling');
  const [locationArea, setLocationArea] = useState('');