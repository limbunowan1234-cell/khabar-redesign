import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query, ID } from 'node-appwrite';

export async function POST(req: NextRequest) {
  try {
    const { submissionId, userId } = await req.json();

    if (!submissionId || !userId) {
      return NextResponse.json(
        { error: 'सबमिशन र प्रयोगकर्ता आइडी आवश्यक छ' },
        { status: 400 }
      );
    }

    const client = new Client()
      .setEndpoint('https://nyc.cloud.appwrite.io/v1')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
      .setKey(process.env.APPWRITE_API_KEY || '');

    const databases = new Databases(client);

    const existingVote = await databases.listDocuments(
      'Khabar_db',
      'bhasa_diwas_votes',
      [
        Query.equal('submissionId', submissionId),
        Query.equal('voterId', userId)
      ]
    );

    if (existingVote.documents.length > 0) {
      return NextResponse.json(
        { success: false, error: 'तपाइँ पहिले नै यस रचनामा मत दिइसक्नुभएको छ' },
        { status: 400 }
      );
    }

    await databases.createDocument(
      'Khabar_db',
      'bhasa_diwas_votes',
      ID.unique(),
      {
        submissionId,
        voterId: userId
      }
    );

    const submission = await databases.getDocument(
      'Khabar_db',
      'bhasa_diwas_submissions',
      submissionId
    );

    await databases.updateDocument(
      'Khabar_db',
      'bhasa_diwas_submissions',
      submissionId,
      {
        votes: (submission.votes || 0) + 1
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json(
      { error: 'मत दिन असफल' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const client = new Client()
      .setEndpoint('https://nyc.cloud.appwrite.io/v1')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
      .setKey(process.env.APPWRITE_API_KEY || '');

    const databases = new Databases(client);

    const result: any = {};

    for (const category of ['poetry', 'essay', 'photo']) {
      const response = await databases.listDocuments(
        'Khabar_db',
        'bhasa_diwas_submissions',
        [
          Query.equal('category', category),
          Query.orderDesc('votes'),
          Query.limit(3)
        ]
      );

      result[category] = response.documents;
    }

    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
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
      ...result,
      userVotes
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { error: 'लीडरबोर्ड लोड असफल' },
      { status: 500 }
    );
  }
}