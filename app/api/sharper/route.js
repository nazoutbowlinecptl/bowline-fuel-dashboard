export const dynamic = 'force-dynamic';

import { getMarina, marinaCreds, fuelTypes } from '@/lib/marinas';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('marina') || 'lakeoconee'; // default keeps the live dashboard working
    const fuelParam = searchParams.get('fuel');               // optional: 'gas' or 'diesel'

    const marina = getMarina(slug);
    if (!marina) {
      return Response.json({ error: `Unknown marina: ${slug}` }, { status: 404 });
    }

    // Pick the fuel's outlet — the requested fuel, or the marina's first fuel.
    const fuelKey = fuelParam && marina.fuels[fuelParam] ? fuelParam : fuelTypes(marina)[0];
    const outlet = marina.fuels[fuelKey]?.outlet;
    const { reportKey, userKey } = marinaCreds(marina);

    if (!outlet || !reportKey || !userKey) {
      return Response.json(
        { error: `Missing config/keys for ${slug}`, detail: { outlet: !!outlet, reportKey: !!reportKey, userKey: !!userKey } },
        { status: 500 }
      );
    }

    const res = await fetch(marina.apiUrl, {
      headers: {
        'Outlet': String(outlet),
        'Report': reportKey,
        'Authorization': userKey,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ error: `Sharper API error: ${res.status}`, detail: errText }, { status: res.status });
    }

    const data = await res.json();
    // Filter to the selected fuel's products. Gas-only marinas have an empty
    // productMatch -> no filter, so they behave exactly as before.
    const match = (marina.fuels[fuelKey].productMatch || []).map(s => s.toLowerCase());
    const transactions = match.length
      ? data.filter(r => {
          const p = String(r.prod_name || '').toLowerCase();
          return match.some(m => p.includes(m));
        })
      : data;
    return Response.json({ transactions });
  } catch (err) {
    return Response.json({ error: 'Failed to fetch', detail: err.message }, { status: 500 });
  }
}