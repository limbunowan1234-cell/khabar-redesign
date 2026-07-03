'use client';
import { useState, useEffect } from 'react';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT };

const TIERS = [
  { name: '✍️ New Writer', min: 0, max: 50, color: '#888' },
  { name: '🥉 Bronze', min: 50, max: 500, color: '#CD7F32' },
  { name: '🥈 Silver', min: 500, max: 2500, color: '#C0C0C0' },
  { name: '🥇 Gold', min: 2500, max: Infinity, color: '#FFD700' }
];

export default function TierProgress({ userId }: { userId: string }) {
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'submitterId', values: [userId] }));
        const q2 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [1000] }));
        const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + q1 + '&queries[]=' + q2, { headers: H, credentials: 'include' });
        if (!res.ok) throw new Error('articles');
        const articlesData = await res.json();
        const articleIds = (articlesData.documents || []).map((a: any) => a.$id);
        if (articleIds.length === 0) { if (alive) { setScore(0); setLoading(false); } return; }

        const q3 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] }));
        const q4 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [1000] }));
        const likesRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/likes/documents?queries[]=' + q3 + '&queries[]=' + q4, { headers: H, credentials: 'include' });
        const likesData = likesRes.ok ? await likesRes.json() : { documents: [] };
        const userLikes = likesData.documents.filter((l: any) => articleIds.includes(l.articleId)).length;
        const commentsRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/comments/documents?queries[]=' + q3 + '&queries[]=' + q4, { headers: H, credentials: 'include' });
        const commentsData = commentsRes.ok ? await commentsRes.json() : { documents: [] };
        const userComments = commentsData.documents.filter((��聅�䤀�����ѥ���%�̹����Ց�̡����ѥ���%��������Ѡ�(������������Ё٥��̀􀡅�ѥ�����ф����յ���́��mt��ɕ�Ս����մ聹յ��Ȱ��聅�䤀����մ������٥��́���������(������������Ёѽх�M��ɔ��٥��̀���͕�1���̀���͕���������(���������������ٔ��͕�M��ɔ�ѽх�M��ɔ��(������􁍅э����(�������������ٔ��͕�1����������͔��(��������(����ɕ��ɸ�������쁅��ٔ�􁙅�͔���(����m�͕�%�t��((������Ё���ɕ��Q��Ȁ�Q%IL������Ѐ���͍�ɔ���й�������͍�ɔ��й��ँ��Q%IMl�t�(������Ё����Q��Ȁ�Q%IL������Ѐ���͍�ɔ��й�������Q%IMmQ%IL�����Ѡ����t�(������Ё������Q�9��Ѐ􁹕��Q��ȹ������͍�ɔ�(������Ё�ɽ�ɕ��A�ɍ��Ѐ􁹕��Q��Ȁ�����ɕ��Q��Ȁ������耠�͍�ɔ������ɕ��Q��ȹ������������Q��ȹ���������ɕ��Q��ȹ������������((��ɕ��ɸ��(�����؁��屔��쁉����ɽչ�耝�����ȵ�Ʌ����Р��Ց����ɝ�����ذ�������Ĥ�����ɝ�����԰��ܰ�а���Ԥ�����������ɑ��I�����耜�������������耜��������ɝ��	��ѽ�耜��������ɑ��耜���ͽ����ɝ�����ذ�������Ȥ�����(�������؁��屔��쁙���M��耜����������]�����耜�����������耜���Ŕ̈́���ѕ��QɅ�͙�ɴ耝����ɍ�͔������ѕ�M������耜���������ɝ��	��ѽ�耜��������e��ȁQ��ȁAɽ�ɕ��𽑥��(�����������������(���������؁��屔��쁡�����耜�����������ɽչ�耜���������ɑ��I�����耜����������ѥ��耝�ձ͔�ĸ�́������є�����(��������耠(����������(�����������؁��屔��쁑������耝���������ѥ����ѕ��耝���������ݕ����������%ѕ��耝��͕���������ɝ��	��ѽ�耜�������(�������������؁��屔��쁙���M��耜����������]�����耜�����������耜�ńńń��������ɕ��Q��ȹ�����𽑥��(�������������؁��屔��쁙���M��耜�����������耜���؜�����͍�ɕ����𽑥��(����������𽑥��(�����������؁��屔���ݥ�Ѡ耜�������������耜����������ɽչ�耜������������ɑ��I�����耜������ٕə���耝�����������ɝ��	��ѽ�耜�������(�������������؁��屔���ݥ�Ѡ��ɽ�ɕ��A�ɍ��Ѐ�������������耜������������ɽչ�聍��ɕ��Q��ȹ����Ȱ��Ʌ�ͥѥ��耝ݥ�Ѡ���́��͔�����(����������𽑥��(�����������؁��屔��쁙���M��耜�����������耜��������(�������������������Q�9��Ѐ���������~:$�5��ѥ�ȁɕ��������聀��������Q�9���������́Ѽ������Q��ȹ�������(����������𽑥��(�����������؁��屔��쁙���M��耜�����������耜���������ɝ��Q��耜����������!�����耜ĸМ����(������������9�܁]ɥѕ��ÊL����	ɽ����ÊL�����M��ٕ����ÊLȰ���������Ȱ����(����������𽑥��(����������(��������(����𽑥��(��<uGE��\�