import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category');
    const userId = searchParams.get('userId');

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://api.khabardarjeeling.in/v1')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
      .setKey(process.env.APPWRITE_API_KEY || '');

    const databases = new Databases(client);

    const queries: any[] = [Query.orderDesc('$createdAt')];

    if (category && category !== 'all') {
      queries.push(Query.equal('category', category));
    }

    const response = await databases.listDocuments(
      'Khabar_db',
      'bhasa_diwas_submissions',
      queries
    );

    let userVotes: string[] = [];
    if (userId) {
      const votesResponse = await databases.listDocuments(
        'Khabar_db',
        'bhasa_diwas_votes',
        [Query.equal('voterId', userId)]
      );
      userVotes = votesResponse.documents.map(v => v.submissionId);
    }

    return NextResponse.json({
      submissions: response.documents,
      userVotes,
      total: response.total
    });
  } catch (error) {
    console.error('Submissions fetch error:', error);
    return NextResponse.json(
      { error: 'सबमिशन लोड असफल' },
      { status: 500 }
    );
  }
}