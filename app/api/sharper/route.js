export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = 'https://lakeoconee-api.sharpermms.com/api/v1/web-data-source';
    const res = await fetch(url, {
      headers: {
        'Outlet': '2',
        'Report': process.env.SHARPER_REPORT_API,
        'Authorization': process.env.SHARPER_USER_API,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ error: `Sharper API error: ${res.status}`, detail: errText }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ transactions: data });
  } catch (err) {
    return Response.json({ error: 'Failed to fetch', detail: err.message }, { status: 500 });
  }
}