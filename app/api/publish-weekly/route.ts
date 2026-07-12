const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': process.env.APPWRITE_API_KEY || '', 'Content-Type': 'application/json' };

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const q = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'isWeeklyPick', values: [true] })) +
      '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'weeklyLive', values: [false] })) +
      '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] }));

    const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + q, { headers: H });
    const data = await res.json();
    const picks = data.documents || [];

    if (picks.length === 0) {
      return Response.json({ success: true, message: 'No pending weekly picks to publish', published: 0 });
    }

    await Promise.all(
      picks.map((a: any) =>
        fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents/' + a.$id, {
          method: 'PATCH',
          headers: H,
          body: JSON.stringify({ data: { weeklyLive: true } })
        })
      )
    );

    return Response.json({ success: true, published: picks.length, issue: picks[0]?.weeklyIssue || null });
  } catch (err: any) {
    console.error('publish-weekly error:', err);
    return Response.json({ error: err.message || 'Failed to publish weekly' }, { status: 500 });
  }
}
