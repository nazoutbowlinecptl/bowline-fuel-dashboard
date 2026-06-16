// app/api/portfolio/route.js
// Aggregates every marina in the registry into one consolidated payload for
// /portfolio. One ROW PER FUEL (gas/diesel split). Live volume + sell price
// come from Sharper; COGS (for profit) from the invoices table, per fuel.

import { MARINAS, marinaCreds, fuelTypes } from '@/lib/marinas';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Total one fuel type's transactions for a marina (sell side, from Sharper).
async function fetchFuel(marina, fuelKey) {
  const fuel = marina.fuels[fuelKey];
  const { reportKey, userKey } = marinaCreds(marina);
  if (!reportKey || !userKey || !fuel?.outlet) return { gallons: 0, revenue: 0 };

  const res = await fetch(marina.apiUrl, {
    headers: { Outlet: String(fuel.outlet), Report: reportKey, Authorization: userKey },
    cache: 'no-store',
  });
  if (!res.ok) return { gallons: 0, revenue: 0 };

  const rows = await res.json();
  const match = (fuel.productMatch || []).map((s) => s.toLowerCase());

  let gallons = 0;
  let revenue = 0; // post-discount total = realized SELL revenue
  for (const r of rows) {
    if (match.length) {
      const product = String(r.prod_name || '').toLowerCase();
      if (!match.some((m) => product.includes(m))) continue;
    }
    const qty = parseFloat(r.itm_quantity) || 0;
    if (qty <= 0) continue; // skip zero-gallon rows (fees/deposits) — matches per-marina dashboards
    gallons += qty;
    revenue += parseFloat(r.itm_total) || 0;
  }
  return { gallons, revenue };
}

// Most recent invoice $/gal for a marina + fuel class (gas vs diesel).
async function fuelCogs(dbName, fuelKey) {
  try {
    const inv =
      fuelKey === 'diesel'
        ? await sql`SELECT price_per_gallon, invoice_date FROM invoices
                    WHERE marina = ${dbName} AND fuel_type ILIKE '%diesel%'
                    ORDER BY invoice_date DESC LIMIT 1`
        : await sql`SELECT price_per_gallon, invoice_date FROM invoices
                    WHERE marina = ${dbName} AND fuel_type NOT ILIKE '%diesel%'
                    ORDER BY invoice_date DESC LIMIT 1`;
    if (inv.length) {
      return { cogsPerGal: parseFloat(inv[0].price_per_gallon) || 0, lastInvoiceDate: inv[0].invoice_date };
    }
  } catch {
    /* no invoices */
  }
  return { cogsPerGal: 0, lastInvoiceDate: null };
}

export async function GET() {
  try {
    const rows = [];

    for (const marina of MARINAS) {
      if (!marina.live) {
        rows.push({ slug: marina.slug, marinaName: marina.name, state: marina.state, status: 'pending' });
        continue;
      }
      const dbName = marina.dbName || marina.slug;

      for (const fuelKey of fuelTypes(marina)) {
        let sell = { gallons: 0, revenue: 0 };
        try {
          sell = await fetchFuel(marina, fuelKey);
        } catch {
          /* keep zeros on error */
        }
        const { cogsPerGal, lastInvoiceDate } = await fuelCogs(dbName, fuelKey);

        const sellPrice = sell.gallons ? sell.revenue / sell.gallons : 0;
        const profit = sell.gallons && cogsPerGal ? sell.revenue - cogsPerGal * sell.gallons : null;

        rows.push({
          slug: marina.slug,
          marinaName: marina.name,
          state: marina.state,
          fuel: fuelKey,
          status: 'live',
          gallons: Math.round(sell.gallons),
          revenue: Math.round(sell.revenue),
          sellPrice,
          cogsPerGal,
          profit: profit == null ? null : Math.round(profit),
          lastInvoiceDate,
        });
      }
    }

    const live = rows.filter((r) => r.status === 'live');
    const totalRevenue = live.reduce((s, r) => s + (r.revenue || 0), 0);
    const totalGallons = live.reduce((s, r) => s + (r.gallons || 0), 0);
    const profitRows = live.filter((r) => r.profit != null);
    const totalProfit = profitRows.length ? profitRows.reduce((s, r) => s + r.profit, 0) : null;
    const liveCount = new Set(live.map((r) => r.slug)).size;

    return Response.json({
      generatedAt: new Date().toISOString(),
      totals: { totalRevenue, totalGallons, totalProfit, liveCount },
      rows,
    });
  } catch (err) {
    return Response.json({ error: 'Failed to build portfolio', detail: err.message }, { status: 500 });
  }
}