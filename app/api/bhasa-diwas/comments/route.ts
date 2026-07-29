import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query, ID } from 'node-appwrite';

export async function POST(req: NextRequest) {
  try {
    const { submissionId, userId, userName, text } = await req.json();

    if (!submissionId || !userId || !text || !text.trim()) {
      return NextResponse.json({ error: 'सबै क्षेत्र आवश्यक छन्' }, { status: 400 });
    }

    const client = new Client()
      .setEndpoint('https://nyc.cloud.appwrite.io/v1')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
      .setKey(process.env.APPWRITE_API_KEY || '');

    const databases = new Databases(client);

    const comment = await databases.createDocument(
      'Khabar_db',
      'comments',
      ID.unique(),
      {
        articleId: submissionId,
        userId,
        authorName: (userName || 'Anonymous').substring(0, 100),
        commentText: text.substring(0, 1000),
        parentCommentId: null,
        avatarUrl: '',
        createdAt: new Date().toISOString()
      }
    );

    return NextResponse.json({
      success: true,
      comment: {
        $id: comment.$id,
        $createdAt: comment.$createdAt,
        userName: comment.authorName,
        text: comment.commentText
      }
    });
  } catch (error) {
    console.error('Comment error:', error);
    return NextResponse.json({ error: 'टिप्पणी असफल भयो' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const submissionId = searchParams.get('submissionId');

    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId आवश्यक छ' }, { status: 400 });
    }

    const client = new Client()
      .setEndpoint('https://nyc.cloud.appwrite.io/v1')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
      .setKey(process.env.APPWRITE_API_KEY || '');

    const databases = new Databases(client);

    const response = await databases.listDocuments(
      'Khabar_db',
      'comments',
      [
        Query.equal('articleId', submissionId),
        Query.orderDesc('$createdAt'),
        Query.limit(100)
      ]
    );

    const mapped = response.documents.map((doc: any) => ({
      $id: doc.$id,
      $createdAt: doc.$createdAt,
      userName: doc.authorName,
      text: doc.commentText
    }));

    return NextResponse.json({ comments: mapped });
  } catch (error) {
    console.error('Fetch comments error:', error);
    return NextResponse.json({ error: 'टिप्पणी लोड असफल' }, { status: 500 });
  }
}
