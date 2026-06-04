'use client';

import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [inventory, setInventory] = useState('');
  const [capacity, setCapacity] = useState('12000');
  const [manualPrice, setManualPrice] = useState('');
  const [targetMargin, setTargetMargin] = useState(30);

  const [transactions, setTransactions] = useState([]);
  const [sharperUpdated, setSharperUpdated] = useState(null);
  const [showTxTable, setShowTxTable] = useState(false);

  // Invoice state
  const [invoices, setInvoices] = useState([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [marinaVendor, setMarinaVendor] = useState('Rossee Oil Co Inc');
  const [editingVendor, setEditingVendor] = useState(false);
  const [tempVendor, setTempVendor] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0, 10));
  const [invFuelType, setInvFuelType] = useState('90 Octane');
  const [invGallons, setInvGallons] = useState('');
  const [invTotalCost, setInvTotalCost] = useState('');
  const [invPdfDataUrl, setInvPdfDataUrl] = useState(null);
  const [invPdfFileName, setInvPdfFileName] = useState('');

  useEffect(() => { fetchSharperTransactions(); }, []);

  useEffect(() => {
    setInventory(localStorage.getItem('inventory') || '');
    setCapacity(localStorage.getItem('capacity') || '12000');
    setManualPrice(localStorage.getItem('manualPrice') || '');
    setTargetMargin(parseFloat(localStorage.getItem('targetMargin')) || 30);
    const savedInvoices = localStorage.getItem('invoices');
    const savedVendor = localStorage.getItem('marinaVendor');
    if (savedInvoices) setInvoices(JSON.parse(savedInvoices));
    if (savedVendor) setMarinaVendor(savedVendor);
  }, []);

  useEffect(() => { localStorage.setItem('inventory', inventory); }, [inventory]);
  useEffect(() => { localStorage.setItem('capacity', capacity); }, [capacity]);
  useEffect(() => { localStorage.setItem('manualPrice', manualPrice); }, [manualPrice]);
  useEffect(() => { localStorage.setItem('targetMargin', targetMargin); }, [targetMargin]);
  useEffect(() => {
    try { localStorage.setItem('invoices', JSON.stringify(invoices)); }
    catch (e) { alert('Storage limit reached. Consider removing older invoices.'); }
  }, [invoices]);
  useEffect(() => { localStorage.setItem('marinaVendor', marinaVendor); }, [marinaVendor]);

  function handlePdfUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      alert('PDF must be under 4MB for browser storage');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      setInvPdfDataUrl(evt.target.result);
      setInvPdfFileName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function handleSaveInvoice() {
    if (!invDate || !invGallons || !invTotalCost) {
      alert('Please fill in date, gallons, and total cost');
      return;
    }
    const gallons = parseFloat(invGallons);
    const totalCost = parseFloat(invTotalCost);
    if (gallons <= 0 || totalCost <= 0) {
      alert('Gallons and Total Cost must be positive');
      return;
    }
    const newInvoice = {
      id: Date.now(),
      date: invDate,
      vendor: marinaVendor,
      fuelType: invFuelType,
      gallons,
      totalCost,
      pricePerGallon: totalCost / gallons,
      pdfDataUrl: invPdfDataUrl,
      pdfFileName: invPdfFileName,
    };
    setInvoices([...invoices, newInvoice]);
    setInvDate(new Date().toISOString().slice(0, 10));
    setInvGallons('');
    setInvTotalCost('');
    setInvPdfDataUrl(null);
    setInvPdfFileName('');
    setShowInvoiceModal(false);
  }

  function handleDeleteInvoice(id) {
    if (confirm('Delete this invoice?')) {
      setInvoices(invoices.filter(inv => inv.id !== id));
    }
  }

  function viewPdf(dataUrl) {
    const w = window.open();
    w.document.write(`<iframe src="${dataUrl}" style="width:100%;height:100vh;border:none;"></iframe>`);
  }
  
  async function fetchSharperTransactions() {
    try {
      const res = await fetch('/api/sharper');
      const data = await res.json();
      if (!data.transactions) return;
      const parsed = data.transactions.map(r => {
        const subtotal = parseFloat(r.itm_subtotal) || 0;
        const discount = parseFloat(r.itm_discount) || 0;
        const total = parseFloat(r.itm_total) || 0;
        const qty = parseFloat(r.itm_quantity) || 0;
        return {
          time: r.ord_time_created,
          date: r.ord_date_created,
          quantity: qty,
          subtotal, discount, total,
          listedPerGal: qty ? subtotal / qty : 0,
          effectivePerGal: qty ? total / qty : 0,
          discountPct: subtotal ? (discount / subtotal) * 100 : 0,
        };
      }).filter(t => t.quantity > 0);
      setTransactions(parsed);
      setSharperUpdated(new Date().toLocaleString());
    } catch (err) {
      console.error('Failed to fetch Sharper data:', err);
    }
  }

  const parseDate = (d) => { if (!d) return null; const dt = new Date(d); return isNaN(dt) ? null : dt; };
  const allTxWithDate = transactions.map(t => ({ ...t, dateObj: parseDate(t.date) })).filter(t => t.dateObj);
  const maxDate = allTxWithDate.length ? new Date(Math.max(...allTxWithDate.map(t => t.dateObj))) : null;
  const cutoff = maxDate ? new Date(maxDate.getTime() - 2 * 24 * 60 * 60 * 1000) : null;
  const recentTx = allTxWithDate.filter(t => t.dateObj > cutoff).sort((a, b) => new Date(b.time) - new Date(a.time));
  const mostRecentInvoice = invoices.length > 0 
    ? [...invoices].sort((a, b) => new Date(b.date) - new Date(a.date))[0] 
    : null;
  const effectiveCOGS = mostRecentInvoice ? mostRecentInvoice.pricePerGallon : null;

  // Invoice chart: last 3 months
  const invoiceChartData = (() => {
    if (invoices.length < 2) return null;
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recent = invoices
      .filter(inv => new Date(inv.date) >= ninetyDaysAgo)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (recent.length < 2) return null;
    return recent;
  })();

  const totalGallons = recentTx.reduce((s, t) => s + t.quantity, 0);
  const totalSubtotal = recentTx.reduce((s, t) => s + t.subtotal, 0);
  const totalRevenue = recentTx.reduce((s, t) => s + t.total, 0);
  const discountedTx = recentTx.filter(t => t.discount > 0);
  const pctDiscounted = recentTx.length ? (discountedTx.length / recentTx.length) * 100 : 0;
  const avgDiscountPct = discountedTx.length ? discountedTx.reduce((s, t) => s + t.discountPct, 0) / discountedTx.length : 0;
  const listedAvg = totalGallons ? totalSubtotal / totalGallons : null;
  const effectiveAvg = totalGallons ? totalRevenue / totalGallons : null;
  const hasTxData = recentTx.length > 0;

  const weekTrend = (() => {
    if (allTxWithDate.length === 0 || !effectiveCOGS) return [];
    const buckets = {};
    allTxWithDate.forEach(t => {
      const d = t.dateObj;
      const wkStart = new Date(d);
      wkStart.setDate(d.getDate() - d.getDay());
      const wkKey = wkStart.toISOString().slice(0, 10);
      if (!buckets[wkKey]) buckets[wkKey] = { subtotal: 0, total: 0, qty: 0, count: 0 };
      buckets[wkKey].subtotal += t.subtotal;
      buckets[wkKey].total += t.total;
      buckets[wkKey].qty += t.quantity;
      buckets[wkKey].count += 1;
    });
    const sortedKeys = Object.keys(buckets).sort();
    return sortedKeys.slice(-12).map(k => {
      const b = buckets[k];
      const listedP = b.qty ? b.subtotal / b.qty : 0;
      const effectiveP = b.qty ? b.total / b.qty : 0;
      const listedM = listedP && effectiveCOGS ? ((listedP - effectiveCOGS) / listedP) * 100 : 0;
      const effectiveM = effectiveP && effectiveCOGS ? ((effectiveP - effectiveCOGS) / effectiveP) * 100 : 0;
      return { week: k, listedMargin: listedM, effectiveMargin: effectiveM, count: b.count, gallons: b.qty };
    });
  })();

  const listedPrice = hasTxData ? listedAvg : (manualPrice ? parseFloat(manualPrice) : null);
  const effectivePrice = hasTxData ? effectiveAvg : listedPrice;
  const suggestedPrice = effectiveCOGS ? (effectiveCOGS / (1 - targetMargin / 100)).toFixed(2) : null;
  const listedMargin = listedPrice && effectiveCOGS ? (((listedPrice - effectiveCOGS) / listedPrice) * 100) : null;
  const effectiveMargin = effectivePrice && effectiveCOGS ? (((effectivePrice - effectiveCOGS) / effectivePrice) * 100) : null;
  const marginDeviation = effectiveMargin !== null ? (effectiveMargin - targetMargin) : null;
  const marginLeakage = listedMargin !== null && effectiveMargin !== null ? listedMargin - effectiveMargin : null;
  const inventoryPct = inventory && capacity ? Math.min((parseFloat(inventory) / parseFloat(capacity)) * 100, 100) : null;

  // Invoice chart SVG dimensions
  const IC_W = 340, IC_H = 80, IC_PADL = 40, IC_PADB = 20, IC_PADT = 8;
  const ic_inW = IC_W - IC_PADL, ic_inH = IC_H - IC_PADB - IC_PADT;
  const ic_prices = invoiceChartData ? invoiceChartData.map(i => i.pricePerGallon) : [];
  const ic_minP = ic_prices.length ? Math.floor((Math.min(...ic_prices) - 0.1) * 10) / 10 : 0;
  const ic_maxP = ic_prices.length ? Math.ceil((Math.max(...ic_prices) + 0.1) * 10) / 10 : 5;
  const ic_dates = invoiceChartData ? invoiceChartData.map(i => new Date(i.date).getTime()) : [];
  const ic_minD = ic_dates.length ? Math.min(...ic_dates) : 0;
  const ic_maxD = ic_dates.length ? Math.max(...ic_dates) : 1;
  const ic_X = (d) => IC_PADL + ((d - ic_minD) / (ic_maxD - ic_minD || 1)) * ic_inW;
  const ic_Y = (v) => IC_PADT + ic_inH - ((v - ic_minP) / (ic_maxP - ic_minP)) * ic_inH;
  const ic_path = invoiceChartData ? invoiceChartData.map((inv, i) => `${i === 0 ? 'M' : 'L'} ${ic_X(new Date(inv.date).getTime())} ${ic_Y(inv.pricePerGallon)}`).join(' ') : '';
  const ic_yTicks = [ic_minP, (ic_minP + ic_maxP) / 2, ic_maxP];

  const MT_W = 360, MT_H = 100, MT_PADL = 38, MT_PADB = 18, MT_PADT = 8;
  const mt_inW = MT_W - MT_PADL, mt_inH = MT_H - MT_PADB - MT_PADT;
  const allMargins = weekTrend.flatMap(w => [w.listedMargin, w.effectiveMargin]).concat([targetMargin]);
  const mt_min = allMargins.length ? Math.floor(Math.min(...allMargins) - 2) : 0;
  const mt_max = allMargins.length ? Math.ceil(Math.max(...allMargins) + 2) : 40;
  const mt_X = (i) => MT_PADL + (i / Math.max(weekTrend.length - 1, 1)) * mt_inW;
  const mt_Y = (v) => MT_PADT + mt_inH - ((v - mt_min) / (mt_max - mt_min)) * mt_inH;
  const listedPath = weekTrend.length > 1 ? weekTrend.map((w, i) => `${i === 0 ? 'M' : 'L'} ${mt_X(i)} ${mt_Y(w.listedMargin)}`).join(' ') : '';
  const effectivePath = weekTrend.length > 1 ? weekTrend.map((w, i) => `${i === 0 ? 'M' : 'L'} ${mt_X(i)} ${mt_Y(w.effectiveMargin)}`).join(' ') : '';
  const mt_yTicks = [mt_min, Math.round((mt_min + mt_max) / 2), mt_max];

  const RING_SIZE = 110, STROKE = 9;
  const R = (RING_SIZE - STROKE) / 2, CIRCUMFERENCE = 2 * Math.PI * R;
  const ringProgress = inventoryPct ? (inventoryPct / 100) * CIRCUMFERENCE : 0;
  const ringColor = inventoryPct ? inventoryPct < 25 ? '#ef4444' : inventoryPct < 50 ? '#f59e0b' : '#22c55e' : '#1f2937';

  const barColor = effectiveMargin === null ? '#1f2937' : Math.abs(marginDeviation) < 2 ? '#22c55e' : Math.abs(marginDeviation) < 5 ? '#f59e0b' : '#ef4444';

  const cardStyle = { background: '#0d1117', border: '1px solid #1a2030', borderRadius: '0.75rem', padding: '1rem' };
  const labelStyle = { fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b5563', margin: 0 };
  const sublabelStyle = { fontSize: '0.6rem', color: '#374151', margin: '0.15rem 0 0' };

  return (
    <main style={{ minHeight: '100vh', background: '#0a0c10', color: '#e5e7eb', padding: '1rem 1.5rem', fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1f2937', paddingBottom: '0.7rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.15rem' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', color: '#6b7280', textTransform: 'uppercase' }}>Bowline Capital</span>
              <span style={{ color: '#1f2937' }}>|</span>
              <span style={{ fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.08em', color: '#4b5563', textTransform: 'uppercase' }}>Fuel Margins</span>
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#f9fafb', margin: 0 }}>Lake Oconee Marina</h1>
            <p style={{ fontSize: '0.7rem', color: '#4b5563', marginTop: '0.1rem' }}>144 Collis Marina Rd NE · Eatonton, GA 31024 · Region: Georgia · Vendor: {marinaVendor}</p>
            {sharperUpdated && <p style={{ fontSize: '0.6rem', color: '#374151', margin: '0.2rem 0 0' }}>Sharper synced: {sharperUpdated}</p>}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={() => setShowInvoiceModal(true)} style={{ background: '#1e3a5f', border: '1px solid #2c5282', color: '#bfdbfe', padding: '0.35rem 0.7rem', borderRadius: '0.4rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}>
              + Log Invoice {invoices.length > 0 && <span style={{ color: '#60a5fa', marginLeft: '0.25rem' }}>({invoices.length})</span>}
            </button>
            <button onClick={fetchSharperTransactions} style={{ background: '#111827', border: '1px solid #1f2937', color: '#9ca3af', padding: '0.35rem 0.7rem', borderRadius: '0.4rem', fontSize: '0.7rem', cursor: 'pointer' }}>↻ Refresh</button>
          </div>
        </div>

        {/* Simplified Status Banner */}
        {effectiveMargin !== null && (
          <div style={{ background: '#0d1117', border: '1px solid #1a2030', borderRadius: '0.5rem', padding: '0.5rem 0.9rem', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
              Effective margin <span style={{ color: '#34d399', fontWeight: 700 }}>{effectiveMargin.toFixed(1)}%</span> vs. target <span style={{ color: '#60a5fa', fontWeight: 700 }}>{targetMargin}%</span>
            </span>
          </div>
        )}

        {/* Row 1: COGS | Suggested | Inventory */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>

          <div style={cardStyle}>
            {mostRecentInvoice ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.15rem' }}>
                  <p style={labelStyle}>Effective COGS · Last Invoice</p>
                  <span style={{ fontSize: '0.55rem', color: '#374151', background: '#111827', border: '1px solid #1f2937', borderRadius: '4px', padding: '1px 5px' }}>{mostRecentInvoice.vendor}</span>
                </div>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: '#fbbf24', letterSpacing: '-0.04em', margin: '0.3rem 0' }}>
                  ${mostRecentInvoice.pricePerGallon.toFixed(3)}<span style={{ fontSize: '0.8rem', color: '#4b5563', fontWeight: 400 }}>/gal</span>
                </p>
                <div style={{ borderTop: '1px solid #1a2030', paddingTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                  <div>
                    <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Date</p>
                    <p style={{ fontSize: '0.75rem', color: '#e5e7eb', margin: '0.15rem 0 0', fontWeight: 600 }}>{mostRecentInvoice.date}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Gallons</p>
                    <p style={{ fontSize: '0.75rem', color: '#e5e7eb', margin: '0.15rem 0 0', fontWeight: 600 }}>{mostRecentInvoice.gallons.toLocaleString()}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Total</p>
                    <p style={{ fontSize: '0.75rem', color: '#e5e7eb', margin: '0.15rem 0 0', fontWeight: 600 }}>${mostRecentInvoice.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
                {invoiceChartData && (
                  <div style={{ marginTop: '0.6rem' }}>
                    <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: '0 0 0.2rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>COGS Trend · Last 3 Months</p>
                    <svg width="100%" viewBox={`0 0 ${IC_W} ${IC_H + 10}`} style={{ overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="invoiceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {ic_yTicks.map((tick, i) => (
                        <g key={i}>
                          <line x1={IC_PADL} y1={ic_Y(tick)} x2={IC_W} y2={ic_Y(tick)} stroke="#1a2030" strokeWidth="1" strokeDasharray="3,3" />
                          <text x={IC_PADL - 4} y={ic_Y(tick) + 3} textAnchor="end" fontSize="8" fill="#374151">${tick.toFixed(2)}</text>
                        </g>
                      ))}
                      <path d={`${ic_path} L ${ic_X(ic_maxD)} ${IC_PADT + ic_inH} L ${ic_X(ic_minD)} ${IC_PADT + ic_inH} Z`} fill="url(#invoiceGrad)" />
                      <path d={ic_path} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      {invoiceChartData.map((inv, i) => (
                        <circle key={i} cx={ic_X(new Date(inv.date).getTime())} cy={ic_Y(inv.pricePerGallon)} r="2.5" fill="#fbbf24" />
                      ))}
                      {invoiceChartData.map((inv, i) => {
                        if (i === 0 || i === invoiceChartData.length - 1) {
                          return <text key={i} x={ic_X(new Date(inv.date).getTime())} y={IC_H + 4} textAnchor="middle" fontSize="7.5" fill="#374151">{inv.date.slice(5)}</text>;
                        }
                        return null;
                      })}
                    </svg>
                  </div>
                )}
                <p style={{ fontSize: '0.55rem', color: '#374151', margin: '0.4rem 0 0', textAlign: 'right' }}>{mostRecentInvoice.fuelType}</p>
              </>
            ) : (
              <>
                <p style={labelStyle}>Effective COGS</p>
                <p style={sublabelStyle}>From fuel invoices</p>
                <div style={{ padding: '2rem 0', textAlign: 'center' }}>
                  <p style={{ fontSize: '1.4rem', color: '#374151', margin: 0, fontWeight: 600 }}>—</p>
                  <p style={{ fontSize: '0.65rem', color: '#6b7280', margin: '0.5rem 0 0' }}>No fuel invoices logged yet</p>
                  <button onClick={() => setShowInvoiceModal(true)} style={{ marginTop: '0.6rem', background: '#1e3a5f', border: '1px solid #2c5282', color: '#bfdbfe', padding: '0.4rem 0.9rem', borderRadius: '0.4rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}>
                    + Log First Invoice
                  </button>
                </div>
              </>
            )}
          </div>

          <div style={cardStyle}>
            <p style={labelStyle}>Suggested Price</p>
            <p style={sublabelStyle}>Maintains {targetMargin}% margin</p>
            {suggestedPrice ? <p style={{ fontSize: '2rem', fontWeight: 700, color: '#60a5fa', letterSpacing: '-0.04em', margin: '0.4rem 0 0' }}>${suggestedPrice}<span style={{ fontSize: '0.8rem', color: '#4b5563', fontWeight: 400 }}>/gal</span></p> : <p style={{ color: '#374151', fontSize: '1.5rem' }}>—</p>}
            <div style={{ marginTop: '0.6rem', borderTop: '1px solid #1a2030', paddingTop: '0.5rem' }}>
              <p style={{ fontSize: '0.6rem', color: '#4b5563', margin: '0 0 0.2rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Target Margin (%)</p>
              <input
                type="number" step="1" min="1" max="99"
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value === '' ? '' : parseFloat(e.target.value))}
                onBlur={(e) => { if (!e.target.value || isNaN(e.target.value)) setTargetMargin(30); }}
                onWheel={(e) => e.target.blur()}
                style={{ width: '100%', background: '#060809', color: '#f9fafb', border: '1px solid #1a2030', borderRadius: '0.4rem', padding: '0.3rem 0.55rem', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={cardStyle}>
            <p style={{ ...labelStyle, marginBottom: '0.5rem' }}>Fuel Inventory</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: RING_SIZE, height: RING_SIZE }}>
                <svg width={RING_SIZE} height={RING_SIZE} style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R} fill="none" stroke="#0f1923" strokeWidth={STROKE} />
                  <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R} fill="none" stroke={ringColor} strokeWidth={STROKE} strokeDasharray={`${ringProgress} ${CIRCUMFERENCE}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  {inventoryPct !== null ? (
                    <>
                      <p style={{ fontSize: '1.1rem', fontWeight: 700, color: ringColor, margin: 0, letterSpacing: '-0.03em' }}>{inventoryPct.toFixed(0)}%</p>
                      <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: 0 }}>capacity</p>
                    </>
                  ) : <p style={{ fontSize: '0.55rem', color: '#374151', margin: 0 }}>Enter<br />values</p>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                <div>
                  <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: '0 0 0.15rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Current</p>
                  <input type="number" placeholder="0" value={inventory} onChange={(e) => setInventory(e.target.value)} onWheel={(e) => e.target.blur()} style={{ width: '100%', background: '#060809', color: '#f9fafb', border: '1px solid #1a2030', borderRadius: '0.4rem', padding: '0.3rem 0.55rem', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: '0 0 0.15rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Max Capacity</p>
                  <input type="number" placeholder="0" value={capacity} readOnly style={{ width: '100%', background: '#0a0c10', color: '#6b7280', border: '1px solid #1a2030', borderRadius: '0.4rem', padding: '0.3rem 0.55rem', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box', cursor: 'not-allowed' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Listed | Effective | Margin Bullet */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
          <div style={cardStyle}>
            <p style={labelStyle}>Listed Price Charged</p>
            <p style={sublabelStyle}>{hasTxData ? `Live from Sharper · ${recentTx.length} tx (2 days)` : 'Manual entry'}</p>
            {listedPrice !== null ? (
              <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#60a5fa', letterSpacing: '-0.04em', margin: '0.35rem 0' }}>${listedPrice.toFixed(3)}<span style={{ fontSize: '0.75rem', color: '#4b5563', fontWeight: 400 }}>/gal</span></p>
            ) : (
              <input
                type="number" step="0.01" placeholder="0.000"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                onWheel={(e) => e.target.blur()}
                style={{ width: '100%', background: '#060809', color: '#f9fafb', border: '1.5px solid #374151', borderRadius: '0.4rem', padding: '0.4rem 0.55rem', fontSize: '1.1rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box', marginTop: '0.35rem' }}
              />
            )}
            {listedMargin !== null && (
              <div style={{ marginTop: '0.3rem', borderTop: '1px solid #1a2030', paddingTop: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.6rem', color: '#4b5563', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Margin</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa' }}>{listedMargin.toFixed(1)}%</span>
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <p style={labelStyle}>Effective Price Realized</p>
            <p style={sublabelStyle}>{hasTxData ? 'Post-discount realized' : 'No discount data'}</p>
            {effectivePrice !== null ? (
              <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#34d399', letterSpacing: '-0.04em', margin: '0.35rem 0' }}>${effectivePrice.toFixed(3)}<span style={{ fontSize: '0.75rem', color: '#4b5563', fontWeight: 400 }}>/gal</span></p>
            ) : (
              <p style={{ color: '#374151', fontSize: '1.4rem', margin: '0.35rem 0' }}>—</p>
            )}
            {effectiveMargin !== null && (
              <div style={{ marginTop: '0.3rem', borderTop: '1px solid #1a2030', paddingTop: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.6rem', color: '#4b5563', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Margin</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>{effectiveMargin.toFixed(1)}%</span>
              </div>
            )}
            {marginLeakage !== null && marginLeakage > 0.1 && (
              <p style={{ fontSize: '0.6rem', color: '#f59e0b', margin: '0.2rem 0 0', fontWeight: 500 }}>
                ↓ {marginLeakage.toFixed(1)} pts leakage
              </p>
            )}
          </div>

          <div style={cardStyle}>
            <p style={{ ...labelStyle, marginBottom: '0.15rem' }}>Effective Margin vs. Target</p>
            {(() => {
              const BULLET_W = 220, BULLET_H = 22, minM = 0, maxM = 50;
              const actualPct = effectiveMargin !== null ? Math.min(Math.max((effectiveMargin - minM) / (maxM - minM), 0), 1) : 0;
              const targetPct = Math.min(Math.max((Number(targetMargin) - minM) / (maxM - minM), 0), 1);
              const targetX = targetPct * BULLET_W;
              const actualX = actualPct * BULLET_W;
              return (
                <div style={{ width: '100%', marginTop: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '0.6rem' }}>
                    <div>
                      <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: '0 0 0.1rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Actual</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, letterSpacing: '-0.03em', color: effectiveMargin !== null ? barColor : '#374151' }}>{effectiveMargin !== null ? `${effectiveMargin.toFixed(1)}%` : '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: '0 0 0.1rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Target</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, letterSpacing: '-0.03em', color: '#60a5fa' }}>{targetMargin}%</p>
                    </div>
                    {marginDeviation !== null && (
                      <div>
                        <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: '0 0 0.1rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Gap</p>
                        <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, letterSpacing: '-0.03em', color: barColor }}>{marginDeviation >= 0 ? '+' : ''}{marginDeviation.toFixed(1)}%</p>
                      </div>
                    )}
                  </div>
                  <svg width="100%" viewBox={`0 0 ${BULLET_W} ${BULLET_H + 12}`} style={{ overflow: 'visible' }}>
                    <rect x={0} y={0} width={BULLET_W} height={BULLET_H} rx="3" fill="#0f1923" />
                    <rect x={0} y={BULLET_H * 0.25} width={actualX} height={BULLET_H * 0.5} rx="2" fill={barColor} style={{ transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
                    <rect x={targetX - 1.5} y={-2} width={3} height={BULLET_H + 4} rx="1.5" fill="#ffffff" opacity="0.7" />
                    {[0, 10, 20, 30, 40, 50].map(tick => (
                      <text key={tick} x={((tick - minM) / (maxM - minM)) * BULLET_W} y={BULLET_H + 9} fontSize="7" fill="#374151" textAnchor="middle">{tick}%</text>
                    ))}
                  </svg>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Row 3: Margin Trend | Volume Trend | Tx Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: weekTrend.length > 0 ? '1.3fr 1.3fr 1fr' : '1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
          {weekTrend.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                <div>
                  <p style={labelStyle}>Margin Trend (12 weeks)</p>
                </div>
                <div style={{ display: 'flex', gap: '0.7rem', fontSize: '0.6rem' }}>
                  <span style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: 8, height: 2, background: '#60a5fa', display: 'inline-block' }}></span> Listed
                  </span>
                  <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: 8, height: 2, background: '#34d399', display: 'inline-block' }}></span> Effective
                  </span>
                </div>
              </div>
              <svg width="100%" viewBox={`0 0 ${MT_W} ${MT_H + 10}`} style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="effectiveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {mt_yTicks.map((tick, i) => (
                  <g key={i}>
                    <line x1={MT_PADL} y1={mt_Y(tick)} x2={MT_W} y2={mt_Y(tick)} stroke="#1a2030" strokeWidth="1" strokeDasharray="3,3" />
                    <text x={MT_PADL - 4} y={mt_Y(tick) + 3} textAnchor="end" fontSize="8" fill="#374151">{tick}%</text>
                  </g>
                ))}
                {targetMargin >= mt_min && targetMargin <= mt_max && (
                  <line x1={MT_PADL} y1={mt_Y(targetMargin)} x2={MT_W} y2={mt_Y(targetMargin)} stroke="#9ca3af" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
                )}
                {weekTrend.length > 1 && (
                  <>
                    <path d={`${effectivePath} L ${mt_X(weekTrend.length - 1)} ${MT_PADT + mt_inH} L ${MT_PADL} ${MT_PADT + mt_inH} Z`} fill="url(#effectiveGrad)" />
                    <path d={effectivePath} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={listedPath} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2,2" />
                  </>
                )}
                {weekTrend.map((w, i) => (
                  <g key={i}>
                    <circle cx={mt_X(i)} cy={mt_Y(w.effectiveMargin)} r="2.5" fill="#34d399" />
                    <circle cx={mt_X(i)} cy={mt_Y(w.listedMargin)} r="2.5" fill="#60a5fa" />
                  </g>
                ))}
                {weekTrend.map((w, i) => {
                  if (i % 2 !== 0 && i !== weekTrend.length - 1) return null;
                  return <text key={i} x={mt_X(i)} y={MT_H + 4} textAnchor="middle" fontSize="7.5" fill="#374151">{w.week.slice(5)}</text>;
                })}
              </svg>
            </div>
          )}

          {weekTrend.length > 0 && (() => {
            const VT_W = 360, VT_H = 100, VT_PADL = 38, VT_PADB = 18, VT_PADT = 8;
            const vt_inW = VT_W - VT_PADL, vt_inH = VT_H - VT_PADB - VT_PADT;
            const vt_max = Math.max(...weekTrend.map(w => w.gallons)) * 1.1 || 100;
            const vt_min = 0;
            const vt_X = (i) => VT_PADL + (i / Math.max(weekTrend.length - 1, 1)) * vt_inW;
            const vt_Y = (v) => VT_PADT + vt_inH - ((v - vt_min) / (vt_max - vt_min)) * vt_inH;
            const barW = (vt_inW / weekTrend.length) * 0.6;
            const totalGalAllWeeks = weekTrend.reduce((s, w) => s + w.gallons, 0);
            const avgGalPerWeek = totalGalAllWeeks / weekTrend.length;
            const lastWeekGal = weekTrend[weekTrend.length - 1].gallons;
            const wowChange = weekTrend.length > 1 ? ((lastWeekGal - weekTrend[weekTrend.length - 2].gallons) / weekTrend[weekTrend.length - 2].gallons) * 100 : 0;
            return (
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <div>
                    <p style={labelStyle}>Weekly Fuel Volume</p>
                    <p style={sublabelStyle}>Gallons sold per week, last 12 weeks</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: wowChange >= 0 ? '#22c55e' : '#ef4444', margin: 0 }}>
                      {wowChange >= 0 ? '▲' : '▼'} {Math.abs(wowChange).toFixed(1)}%
                    </p>
                    <p style={{ fontSize: '0.55rem', color: '#374151', margin: 0 }}>WoW</p>
                  </div>
                </div>
                <svg width="100%" viewBox={`0 0 ${VT_W} ${VT_H + 10}`} style={{ overflow: 'visible' }}>
                  {[0, vt_max / 2, vt_max].map((tick, i) => (
                    <g key={i}>
                      <line x1={VT_PADL} y1={vt_Y(tick)} x2={VT_W} y2={vt_Y(tick)} stroke="#1a2030" strokeWidth="1" strokeDasharray="3,3" />
                      <text x={VT_PADL - 4} y={vt_Y(tick) + 3} textAnchor="end" fontSize="8" fill="#374151">{tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick.toFixed(0)}</text>
                    </g>
                  ))}
                  <line x1={VT_PADL} y1={vt_Y(avgGalPerWeek)} x2={VT_W} y2={vt_Y(avgGalPerWeek)} stroke="#9ca3af" strokeWidth="1" strokeDasharray="4,3" opacity="0.4" />
                  <text x={VT_W - 2} y={vt_Y(avgGalPerWeek) - 3} fontSize="7" fill="#6b7280" textAnchor="end">avg {avgGalPerWeek >= 1000 ? `${(avgGalPerWeek / 1000).toFixed(1)}k` : avgGalPerWeek.toFixed(0)}</text>
                  {weekTrend.map((w, i) => {
                    const x = vt_X(i) - barW / 2;
                    const y = vt_Y(w.gallons);
                    const h = (VT_PADT + vt_inH) - y;
                    return <rect key={i} x={x} y={y} width={barW} height={h} fill="#60a5fa" opacity="0.8" rx="1" />;
                  })}
                  {weekTrend.map((w, i) => {
                    if (i % 2 !== 0 && i !== weekTrend.length - 1) return null;
                    return <text key={i} x={vt_X(i)} y={VT_H + 4} textAnchor="middle" fontSize="7.5" fill="#374151">{w.week.slice(5)}</text>;
                  })}
                </svg>
              </div>
            );
          })()}

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <p style={labelStyle}>Transactions (2 days)</p>
              </div>
              {recentTx.length > 0 && (
                <button onClick={() => setShowTxTable(!showTxTable)} style={{ background: '#111827', border: '1px solid #1f2937', color: '#9ca3af', padding: '0.25rem 0.6rem', borderRadius: '0.35rem', fontSize: '0.65rem', cursor: 'pointer' }}>
                  {showTxTable ? '− Hide' : '+ Show'} ({recentTx.length})
                </button>
              )}
            </div>

            {recentTx.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: '#374151', textAlign: 'center', padding: '1rem 0', margin: 0 }}>
                No transactions in last 2 days.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <div>
                  <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>% Discounted</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f9fafb', margin: '0.1rem 0 0' }}>{pctDiscounted.toFixed(1)}%</p>
                  <p style={{ fontSize: '0.55rem', color: '#374151', margin: 0 }}>{discountedTx.length} of {recentTx.length}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Avg Discount</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f9fafb', margin: '0.1rem 0 0' }}>{avgDiscountPct.toFixed(2)}%</p>
                  <p style={{ fontSize: '0.55rem', color: '#374151', margin: 0 }}>on discounted</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Listed Price</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#60a5fa', margin: '0.1rem 0 0' }}>${listedAvg?.toFixed(3)}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.55rem', color: '#4b5563', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Effective Price</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399', margin: '0.1rem 0 0' }}>${effectiveAvg?.toFixed(3)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Tx Table */}
        {showTxTable && recentTx.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: '0.85rem' }}>
            <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#0d1117' }}>
                  <tr style={{ borderBottom: '1px solid #1f2937' }}>
                    {['Time', 'Gallons', 'Listed $/gal', 'Discount', 'Discount %', 'Effective $/gal', 'Total'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Time' ? 'left' : 'right', padding: '0.4rem', fontSize: '0.55rem', color: '#4b5563', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTx.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #111827' }}>
                      <td style={{ padding: '0.35rem', color: '#9ca3af' }}>{t.time}</td>
                      <td style={{ padding: '0.35rem', textAlign: 'right', color: '#e5e7eb' }}>{t.quantity.toFixed(2)}</td>
                      <td style={{ padding: '0.35rem', textAlign: 'right', color: '#e5e7eb' }}>${t.listedPerGal.toFixed(3)}</td>
                      <td style={{ padding: '0.35rem', textAlign: 'right', color: t.discount > 0 ? '#f59e0b' : '#374151' }}>${t.discount.toFixed(2)}</td>
                      <td style={{ padding: '0.35rem', textAlign: 'right', color: t.discount > 0 ? '#f59e0b' : '#374151' }}>{t.discountPct.toFixed(1)}%</td>
                      <td style={{ padding: '0.35rem', textAlign: 'right', color: t.discount > 0 ? '#34d399' : '#e5e7eb' }}>${t.effectivePerGal.toFixed(3)}</td>
                      <td style={{ padding: '0.35rem', textAlign: 'right', color: '#e5e7eb', fontWeight: 600 }}>${t.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #111827', paddingTop: '0.55rem', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.55rem', color: '#1f2937', letterSpacing: '0.04em' }}>BOWLINE CAPITAL LLC · CONFIDENTIAL</span>
          <span style={{ fontSize: '0.55rem', color: '#1f2937' }}>USD/gallon</span>
        </div>

        {showInvoiceModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowInvoiceModal(false)}>
            <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f9fafb', margin: 0, letterSpacing: '-0.02em' }}>Log Fuel Invoice</h2>
                <button onClick={() => setShowInvoiceModal(false)} style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0 0 0.25rem', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Invoice Date</label>
                <input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} style={{ width: '100%', background: '#060809', color: '#f9fafb', border: '1px solid #1f2937', borderRadius: '0.4rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0 0 0.25rem', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Vendor</label>
                {editingVendor ? (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input type="text" value={tempVendor} onChange={(e) => setTempVendor(e.target.value)} placeholder="Vendor name" style={{ flex: 1, background: '#060809', color: '#f9fafb', border: '1px solid #1f2937', borderRadius: '0.4rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                    <button onClick={() => { setMarinaVendor(tempVendor); setEditingVendor(false); }} style={{ background: '#1e3a5f', border: '1px solid #2c5282', color: '#bfdbfe', padding: '0.3rem 0.7rem', borderRadius: '0.4rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#060809', border: '1px solid #1f2937', borderRadius: '0.4rem', padding: '0.5rem 0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#f9fafb' }}>{marinaVendor}</span>
                    <button onClick={() => { setTempVendor(marinaVendor); setEditingVendor(true); }} style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}>Change</button>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0 0 0.25rem', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Fuel Type</label>
                <select value={invFuelType} onChange={(e) => setInvFuelType(e.target.value)} style={{ width: '100%', background: '#060809', color: '#f9fafb', border: '1px solid #1f2937', borderRadius: '0.4rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
                  <option>87 Octane</option>
                  <option>89 Octane</option>
                  <option>90 Octane</option>
                  <option>91 Octane</option>
                  <option>93 Octane</option>
                  <option>Diesel</option>
                </select>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0 0 0.25rem', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Gallons Delivered</label>
                <input type="number" step="0.01" placeholder="0" value={invGallons} onChange={(e) => setInvGallons(e.target.value)} onWheel={(e) => e.target.blur()} style={{ width: '100%', background: '#060809', color: '#f9fafb', border: '1px solid #1f2937', borderRadius: '0.4rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0 0 0.25rem', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Total Cost After Tax ($)</label>
                <input type="number" step="0.01" placeholder="0.00" value={invTotalCost} onChange={(e) => setInvTotalCost(e.target.value)} onWheel={(e) => e.target.blur()} style={{ width: '100%', background: '#060809', color: '#f9fafb', border: '1px solid #1f2937', borderRadius: '0.4rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0 0 0.25rem', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Invoice PDF (optional)</label>
                {invPdfFileName ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#060809', border: '1px solid #1f2937', borderRadius: '0.4rem', padding: '0.5rem 0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#34d399' }}>📄 {invPdfFileName}</span>
                    <button onClick={() => { setInvPdfDataUrl(null); setInvPdfFileName(''); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer' }}>Remove</button>
                  </div>
                ) : (
                  <label style={{ display: 'block', background: '#060809', border: '1px dashed #1f2937', borderRadius: '0.4rem', padding: '0.7rem 0.75rem', fontSize: '0.75rem', color: '#6b7280', cursor: 'pointer', textAlign: 'center' }}>
                    📎 Click to attach invoice PDF
                    <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </div>

              {invGallons && invTotalCost && parseFloat(invGallons) > 0 && (
                <div style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)', borderRadius: '0.4rem', padding: '0.6rem 0.85rem', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cost per Gallon (after tax)</p>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fbbf24', margin: '0.1rem 0 0', letterSpacing: '-0.03em' }}>${(parseFloat(invTotalCost) / parseFloat(invGallons)).toFixed(4)}<span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 400 }}>/gal</span></p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowInvoiceModal(false)} style={{ background: '#111827', border: '1px solid #1f2937', color: '#9ca3af', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontSize: '0.75rem', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveInvoice} style={{ background: '#1e3a5f', border: '1px solid #2c5282', color: '#bfdbfe', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Save Invoice</button>
              </div>

              {invoices.length > 0 && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #1a2030', paddingTop: '1rem' }}>
                  <p style={{ fontSize: '0.6rem', color: '#9ca3af', margin: '0 0 0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Invoice History ({invoices.length})</p>
                  <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {[...invoices].sort((a, b) => new Date(b.date) - new Date(a.date)).map(inv => (
                      <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #111827', fontSize: '0.7rem' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, color: '#e5e7eb' }}>{inv.date} · {inv.fuelType}</p>
                          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.6rem' }}>{inv.gallons.toLocaleString()} gal · ${inv.totalCost.toFixed(2)} · ${inv.pricePerGallon.toFixed(3)}/gal</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {inv.pdfDataUrl && (
                            <button onClick={() => viewPdf(inv.pdfDataUrl)} style={{ background: 'transparent', border: '1px solid #1f2937', color: '#60a5fa', fontSize: '0.6rem', cursor: 'pointer', padding: '0.2rem 0.5rem', borderRadius: '0.3rem' }}>📄 View PDF</button>
                          )}
                          <button onClick={() => handleDeleteInvoice(inv.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.65rem', cursor: 'pointer' }}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}