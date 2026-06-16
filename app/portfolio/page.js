// app/portfolio/page.js
'use client';

import { useEffect, useState } from 'react';

const fmtUSD = (n) => (n == null ? '—' : '$' + Math.round(n).toLocaleString());

function daysSince(d) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export default function PortfolioPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setData(d)))
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div style={{ color: '#f87171', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>Error: {err}</div>;
  if (!data) return <div style={{ color: '#6b7280', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>Loading portfolio…</div>;

  const { totals, rows } = data;
  const live = rows.filter((r) => r.status === 'live');

  // Alphabetical by marina, then fuel (gas before diesel).
  const sorted = [...rows].sort((a, b) => {
    const n = a.marinaName.localeCompare(b.marinaName);
    return n !== 0 ? n : String(a.fuel || '').localeCompare(String(b.fuel || ''));
  });

  // Group to marina level for the bottom panels.
  const byMarina = {};
  for (const r of live) {
    if (!byMarina[r.slug]) byMarina[r.slug] = { name: r.marinaName, slug: r.slug, gallons: 0, profit: null, lastInvoiceDate: null };
    byMarina[r.slug].gallons += r.gallons || 0;
    if (r.profit != null) byMarina[r.slug].profit = (byMarina[r.slug].profit || 0) + r.profit;
    if (r.lastInvoiceDate && (!byMarina[r.slug].lastInvoiceDate || new Date(r.lastInvoiceDate) > new Date(byMarina[r.slug].lastInvoiceDate))) {
      byMarina[r.slug].lastInvoiceDate = r.lastInvoiceDate;
    }
  }
  const marinaList = Object.values(byMarina).sort((a, b) => a.name.localeCompare(b.name));
  const maxGallons = Math.max(1, ...marinaList.map((m) => m.gallons));
  const profitMarinas = marinaList.filter((m) => m.profit != null);
  const maxProfit = Math.max(1, ...profitMarinas.map((m) => Math.abs(m.profit)));
  const staleManagers = marinaList.filter((m) => {
    const d = daysSince(m.lastInvoiceDate);
    return d == null || d > 21;
  });

  const card = { background: '#0d1117', border: '1px solid #1a2030', borderRadius: 8, padding: '0.8rem 1rem' };
  const label = { fontSize: 9, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b5563', margin: 0 };

  return (
    <div style={{ background: '#0a0c10', color: '#e5e7eb', minHeight: '100vh', padding: '1.25rem 1.5rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #1f2937', paddingBottom: '0.7rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#6b7280', textTransform: 'uppercase' }}>
          Bowline Capital · Portfolio Fuel Operations
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.03em', color: '#f9fafb', margin: '0.15rem 0 0' }}>
          All Marinas · Consolidated View
        </h1>
        <p style={{ fontSize: 11, color: '#4b5563', margin: '0.15rem 0 0' }}>
          {totals.liveCount} live · {marinaList.length} total
        </p>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={card}><p style={label}>Revenue · 7d</p><p style={{ fontSize: 18, color: '#34d399', margin: '0.3rem 0 0' }}>{fmtUSD(totals.totalRevenue)}</p></div>
        <div style={card}><p style={label}>Profit · 7d</p><p style={{ fontSize: 18, color: totals.totalProfit == null ? '#4b5563' : '#34d399', margin: '0.3rem 0 0' }}>{fmtUSD(totals.totalProfit)}</p></div>
        <div style={card}><p style={label}>Gallons · 7d</p><p style={{ fontSize: 18, color: '#f9fafb', margin: '0.3rem 0 0' }}>{Math.round(totals.totalGallons).toLocaleString()}</p></div>
        <div style={card}><p style={label}>Live Marinas</p><p style={{ fontSize: 18, color: '#f9fafb', margin: '0.3rem 0 0' }}>{totals.liveCount}</p></div>
      </div>

      {/* Main table — alphabetical, one row per fuel */}
      <div style={{ ...card, marginBottom: '1rem' }}>
        <p style={{ ...label, marginBottom: '0.6rem' }}>Marinas · gas & diesel</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: '#6b7280', textAlign: 'left' }}>
              <th style={{ padding: '4px 8px' }}>Marina</th>
              <th>State</th><th>Fuel</th>
              <th>Sell $/gal</th><th>Revenue · 7d</th><th>Profit · 7d</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={`${r.slug}-${r.fuel || i}`} style={{ borderTop: '1px solid #1a2030' }}>
                <td style={{ padding: '6px 8px' }}>
                  {r.status === 'live'
                    ? <a href={`/${r.slug}`} style={{ color: '#e5e7eb', textDecoration: 'none' }}>{r.marinaName} →</a>
                    : <span style={{ color: '#6b7280' }}>{r.marinaName}</span>}
                </td>
                <td style={{ color: '#9ca3af' }}>{r.state}</td>
                <td style={{ color: '#9ca3af', textTransform: 'capitalize' }}>{r.fuel || '—'}</td>
                <td>{r.status === 'live' ? '$' + (r.sellPrice || 0).toFixed(2) : '—'}</td>
                <td style={{ color: '#34d399' }}>{r.status === 'live' ? fmtUSD(r.revenue) : '—'}</td>
                <td style={{ color: r.profit == null ? '#4b5563' : '#34d399' }}>{r.status === 'live' ? fmtUSD(r.profit) : '—'}</td>
                <td><span style={{ color: r.status === 'live' ? '#34d399' : '#6b7280' }}>● {r.status === 'live' ? 'Live' : 'Pending'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 9, color: '#374151', margin: '0.6rem 0 0' }}>
          Sell $/gal = realized sale price (revenue ÷ gallons, last 7d). Profit = revenue − fuel cost; shows once an invoice is logged for that fuel.
        </p>
      </div>

      {/* Bottom row: volume + profit + manager activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '0.6rem' }}>
        <div style={card}>
          <p style={{ ...label, marginBottom: '0.6rem' }}>Volume by marina · 7d (gallons)</p>
          {marinaList.map((m) => (
            <div key={m.slug} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span>{m.name}</span><span style={{ color: '#9ca3af' }}>{m.gallons.toLocaleString()}</span>
              </div>
              <div style={{ height: 4, background: '#1a2030', borderRadius: 2 }}>
                <div style={{ width: `${(m.gallons / maxGallons) * 100}%`, height: '100%', background: '#34d399', borderRadius: 2 }} />
              </div>
            </div>
          ))}
          {!marinaList.length && <p style={{ color: '#6b7280', fontSize: 11 }}>No live marinas yet.</p>}
        </div>

        <div style={card}>
          <p style={{ ...label, marginBottom: '0.6rem' }}>Profit by marina · 7d</p>
          {profitMarinas.length ? profitMarinas.map((m) => (
            <div key={m.slug} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span>{m.name}</span>
                <span style={{ color: m.profit < 0 ? '#f87171' : '#9ca3af' }}>{fmtUSD(m.profit)}</span>
              </div>
              <div style={{ height: 4, background: '#1a2030', borderRadius: 2 }}>
                <div style={{ width: `${(Math.abs(m.profit) / maxProfit) * 100}%`, height: '100%', background: m.profit < 0 ? '#f87171' : '#34d399', borderRadius: 2 }} />
              </div>
            </div>
          )) : <p style={{ color: '#6b7280', fontSize: 11 }}>Populates as invoices are logged.</p>}
        </div>

        <div style={card}>
          <p style={{ ...label, marginBottom: '0.6rem' }}>Manager activity · last invoice</p>
          {staleManagers.length ? staleManagers.map((m) => {
            const d = daysSince(m.lastInvoiceDate);
            return (
              <div key={m.slug} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                <span>{m.name}</span>
                <span style={{ color: '#fbbf24' }}>{d == null ? 'no invoices' : `${d}d ago`}</span>
              </div>
            );
          }) : <p style={{ color: '#6b7280', fontSize: 11 }}>All current (≤21 days).</p>}
        </div>
      </div>
    </div>
  );
}