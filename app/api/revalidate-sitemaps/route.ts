import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    // Revalidate sitemaps
    revalidatePath('/sitemap.ts');
    revalidatePath('/news-sitemap.xml');
    
    console.log('Sitemaps revalidated at', new Date().toISOString());
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}