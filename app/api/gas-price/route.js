export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apiKey = process.env.EIA_API_KEY;
    const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${apiKey}&frequency=weekly&data[0]=value&facets[product][]=EPM0U&facets[duoarea][]=R10&sort[0][column]=period&sort[0][direction]=desc&length=1`;

    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    const price = data?.response?.data?.[0]?.value;
    return Response.json({ price: parseFloat(price) });
  } catch (err) {
    console.error('EIA fetch error:', err);
    return Response.json({ price: null, error: 'Failed to fetch' }, { status: 500 });
  }
}