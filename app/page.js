'use client';

import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [gasPrice, setGasPrice] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fuelInventory, setFuelInventory] = useState(() => localStorage.getItem('fuelInventory') || '');
  const [maxCapacity, setMaxCapacity] = useState(() => localStorage.getItem('maxCapacity') || '');
  const [currentPrice, setCurrentPrice] = useState(() => localStorage.getItem('currentPrice') || '');
  const [targetMargin, setTargetMargin] = useState(30);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => { fetchGasPrice(); }, []);
  useEffect(() => { localStorage.setItem('fuelInventory', fuelInventory); }, [fuelInventory]);
  useEffect(() => { localStorage.setItem('maxCapacity', maxCapacity); }, [maxCapacity]);
  useEffect(() => { localStorage.setItem('currentPrice', currentPrice); }, [currentPrice]);

  async function fetchGasPrice() {
    setLoading(true);
    try {
      const apiKey = 'jkNaDyJwqeaLq5cscpajJhopgyu8rvR85mQmJKk3';
      const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${apiKey}&frequency=weekly&data[0]=value&facets[product][]=EPM0U&facets[duoarea][]=R1Z&sort[0][column]=period&sort[0][direction]=desc&length=12`;
      const res = await fetch(url);
      const data = await res.json();
      const entries = data?.response?.data || [];
      const sorted = [...entries].reverse();
      setPriceHistory(sorted);
      setGasPrice(parseFloat(entries[0]?.value));
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      console.error('Failed to fetch gas price:', err);
    } finally {
      setLoading(false);
    }
  }

  const suggestedPrice = gasPrice ? (gasPrice / (1 - targetMargin / 100)).toFixed(2) : null;
  const currentPriceNum = parseFloat(currentPrice);
  const suggestedPriceNum = parseFloat(suggestedPrice);
  const priceDelta = currentPrice && suggestedPrice ? (currentPriceNum - suggestedPriceNum).toFixed(2) : null;
  const inventoryPct = fuelInventory && maxCapacity
    ? Math.min((parseFloat(fuelInventory) / parseFloat(maxCapacity)) * 100, 100) : null;
  const actualMargin = currentPrice && gasPrice
    ? (((currentPriceNum - gasPrice) / currentPriceNum) * 100).toFixed(1) : null;
  const marginDeviation = actualMargin ? (parseFloat(actualMargin) - targetMargin).toFixed(1) : null;

  // Status banner logic
  const getStatus = () => {
    if (!currentPrice || !gasPrice) return null;
    const dev = parseFloat(marginDeviation);
    if (Math.abs(dev) < 2) return { label: 'Margin On Target', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)' };
    if (dev < -2) return { label: 'Price Adjustment Recommended', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' };
    if (Math.abs(dev) >= 5) return { label: 'Immediate Price Update Needed', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' };
if (dev > 2) return { label: 'Price Adjustment Recommended', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' };
    return { label: 'Monitor Closely', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' };
  };
  const status = getStatus();

  // Input border color
  const inputBorderColor = () => {
    if (!currentPrice || !suggestedPrice) return '#374151';
    const delta = Math.abs(parseFloat(priceDelta));
    if (delta < 0.10) return '#22c55e';
    if (delta < 0.30) return '#f59e0b';
    return '#ef4444';
  };

  // Ring gauge
  const RING_SIZE = 160;
  const STROKE = 12;
  const R = (RING_SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const ringProgress = inventoryPct ? (inventoryPct / 100) * CIRCUMFERENCE : 0;
  const ringColor = inventoryPct
    ? inventoryPct < 25 ? '#ef4444' : inventoryPct < 50 ? '#f59e0b' : '#22c55e' : '#1f2937';

  // Margin arc
  const ARC_SIZE = 160;
  const ARC_STROKE = 12;
  const ARC_R = (ARC_SIZE - ARC_STROKE) / 2;
  const ARC_CIRCUMFERENCE = Math.PI * ARC_R;
  const clampedDeviation = marginDeviation ? Math.max(-15, Math.min(15, parseFloat(marginDeviation))) : 0;
  const arcProgress = marginDeviation
    ? ((clampedDeviation + 15) / 30) * ARC_CIRCUMFERENCE : ARC_CIRCUMFERENCE / 2;
  const arcColor = marginDeviation
    ? Math.abs(parseFloat(marginDeviation)) < 2 ? '#22c55e'
      : Math.abs(parseFloat(marginDeviation)) < 5 ? '#f59e0b' : '#ef4444' : '#1f2937';

  // Sparkline — expanded with grid + labels
  const CHART_W = 340;
  const CHART_H = 100;
  const PAD_L = 38;
  const PAD_B = 24;
  const PAD_T = 10;
  const innerW = CHART_W - PAD_L;
  const innerH = CHART_H - PAD_B - PAD_T;
  const prices = priceHistory.map(d => parseFloat(d.value));
  const minP = prices.length ? Math.floor((Math.min(...prices) - 0.05) * 20) / 20 : 0;
  const maxP = prices.length ? Math.ceil((Math.max(...prices) + 0.05) * 20) / 20 : 5;
  const toX = (i) => PAD_L + (i / (prices.length - 1)) * innerW;
  const toY = (v) => PAD_T + innerH - ((v - minP) / (maxP - minP)) * innerH;
  const sparklinePath = prices.length > 1
    ? prices.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ') : '';
  const areaPath = prices.length > 1
    ? `${sparklinePath} L ${toX(prices.length - 1)} ${PAD_T + innerH} L ${PAD_L} ${PAD_T + innerH} Z` : '';
  const yTicks = [minP, (minP + maxP) / 2, maxP];
  const xLabels = priceHistory.filter((_, i) => i === 0 || i === Math.floor(priceHistory.length / 2) || i === priceHistory.length - 1);

  return (
    <main style={{ minHeight: '100vh', background: '#0a0c10', color: '#e5e7eb', padding: '2.5rem', fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1f2937', paddingBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: '#6b7280', textTransform: 'uppercase' }}>Bowline Capital</span>
              <span style={{ color: '#1f2937' }}>|</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 500, letterSpacing: '0.08em', color: '#4b5563', textTransform: 'uppercase' }}>Fuel Margins</span>
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#f9fafb', margin: 0 }}>Lake Oconee Marina</h1>
            <p style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.2rem', letterSpacing: '0.01em' }}>144 Collis Marina Rd NE · Eatonton, GA 31024</p>
            {lastUpdated && <p style={{ fontSize: '0.7rem', color: '#374151', marginTop: '0.15rem' }}>Updated {lastUpdated}</p>}
          </div>
          <button
            onClick={fetchGasPrice}
            style={{ background: '#111827', border: '1px solid #1f2937', color: '#9ca3af', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.02em', transition: 'all 0.2s' }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Status Banner */}
        {status && (
          <div style={{ background: status.bg, border: `1px solid ${status.border}`, borderRadius: '0.75rem', padding: '0.75rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: status.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: status.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{status.label}</span>
            {priceDelta && (
              <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                Current price is {Math.abs(priceDelta) < 0.01 ? 'aligned with' : `$${Math.abs(priceDelta)} ${parseFloat(priceDelta) < 0 ? 'below' : 'above'}`} suggested price
              </span>
            )}
          </div>
        )}

        {/* Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

          {/* Market Price + Chart */}
          <div style={{ background: '#0d1117', border: '1px solid #1a2030', borderRadius: '1rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b5563', margin: 0 }}>Market Gas Price</p>
              <span style={{ fontSize: '0.65rem', color: '#374151', background: '#111827', border: '1px solid #1f2937', borderRadius: '4px', padding: '2px 6px' }}>EIA · SE Lower Atlantic</span>
            </div>
            {loading ? (
              <p style={{ color: '#374151', fontSize: '0.9rem', margin: '1rem 0' }}>Fetching...</p>
            ) : gasPrice ? (
              <>
                <p style={{ fontSize: '2.8rem', fontWeight: 700, color: '#34d399', letterSpacing: '-0.04em', margin: '0.5rem 0 1.25rem' }}>${gasPrice.toFixed(3)}<span style={{ fontSize: '1rem', color: '#4b5563', fontWeight: 400 }}>/gal</span></p>
                {prices.length > 1 && (
                  <>
                    <p style={{ fontSize: '0.65rem', color: '#374151', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>12-Week Price Trend</p>
                    <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H + 10}`} style={{ overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Grid lines */}
                      {yTicks.map((tick, i) => (
                        <g key={i}>
                          <line x1={PAD_L} y1={toY(tick)} x2={CHART_W} y2={toY(tick)} stroke="#1a2030" strokeWidth="1" strokeDasharray="3,3" />
                          <text x={PAD_L - 4} y={toY(tick) + 4} textAnchor="end" fontSize="9" fill="#374151">${tick.toFixed(2)}</text>
                        </g>
                      ))}
                      <path d={areaPath} fill="url(#areaGrad)" />
                      <path d={sparklinePath} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      {prices.map((v, i) => (
                        <circle key={i} cx={toX(i)} cy={toY(v)} r="2.5" fill="#34d399" />
                      ))}
                      {/* X axis labels */}
                      {xLabels.map((entry, i) => {
                        const idx = priceHistory.indexOf(entry);
                        return (
                          <text key={i} x={toX(idx)} y={CHART_H + 8} textAnchor="middle" fontSize="8.5" fill="#374151">{entry.period?.slice(5)}</text>
                        );
                      })}
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.65rem', color: '#374151' }}>
                        {prices.length > 1 ? `${prices[prices.length - 1] > prices[0] ? '▲' : '▼'} $${Math.abs(prices[prices.length - 1] - prices[0]).toFixed(3)} over 12 weeks` : ''}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#374151' }}>Weekly · $/gal</span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p style={{ color: '#ef4444' }}>Unavailable</p>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Suggested Price */}
            <div style={{ background: '#0d1117', border: '1px solid #1a2030', borderRadius: '1rem', padding: '1.5rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b5563', margin: '0 0 0.25rem' }}>Suggested Price</p>
              <p style={{ fontSize: '0.65rem', color: '#374151', margin: '0 0 0.75rem' }}>Market ÷ {(1 - targetMargin / 100).toFixed(2)} — maintains {targetMargin}% margin</p>
              {suggestedPrice ? (
                <p style={{ fontSize: '2.4rem', fontWeight: 700, color: '#60a5fa', letterSpacing: '-0.04em', margin: 0 }}>${suggestedPrice}<span style={{ fontSize: '1rem', color: '#4b5563', fontWeight: 400 }}>/gal</span></p>
              ) : (
                <p style={{ color: '#374151', fontSize: '1.5rem' }}>—</p>
              )}
            </div>

            {/* Current Price Input */}
            <div style={{ background: '#0d1117', border: '1px solid #1a2030', borderRadius: '1rem', padding: '1.5rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b5563', margin: '0 0 0.75rem' }}>Current Price Charged</p>
              <input
                type="number"
                step="0.01"
                placeholder="0.000"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                onWheel={(e) => e.target.blur()}
                style={{
                  width: '100%', background: '#060809', color: '#f9fafb',
                  border: `1.5px solid ${inputBorderColor()}`,
                  borderRadius: '0.5rem', padding: '0.6rem 0.75rem',
                  fontSize: '1.4rem', fontWeight: 600, outline: 'none',
                  letterSpacing: '-0.02em', boxSizing: 'border-box',
                  transition: 'border-color 0.3s ease'
                }}
              />
              <p style={{ fontSize: '0.65rem', color: '#374151', marginTop: '0.5rem' }}>Source: Sharper POS → Products → Fuel</p>
              <div style={{ marginTop: '1rem', borderTop: '1px solid #1a2030', paddingTop: '0.75rem' }}>
  <p style={{ fontSize: '0.65rem', color: '#4b5563', margin: '0 0 0.3rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Target Margin (%)</p>
  <input
    type="number"
    step="1"
    min="1"
    max="99"
    value={targetMargin}
    onChange={(e) => setTargetMargin(e.target.value === '' ? '' : parseFloat(e.target.value))}
    onWheel={(e) => e.target.blur()}
    onBlur={(e) => { if (e.target.value === '' || isNaN(e.target.value)) setTargetMargin(30); }}
    style={{ width: '100%', background: '#060809', color: '#f9fafb', border: '1px solid #1a2030', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
  />
</div>
            </div>
          </div>
        </div>

        {/* Row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

          {/* Fuel Ring */}
          <div style={{ background: '#0d1117', border: '1px solid #1a2030', borderRadius: '1rem', padding: '1.5rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b5563', margin: '0 0 1.25rem' }}>Fuel Inventory</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: RING_SIZE, height: RING_SIZE }}>
                <svg width={RING_SIZE} height={RING_SIZE} style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R} fill="none" stroke="#0f1923" strokeWidth={STROKE} />
                  <circle
                    cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R} fill="none"
                    stroke={ringColor} strokeWidth={STROKE}
                    strokeDasharray={`${ringProgress} ${CIRCUMFERENCE}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
                  />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  {inventoryPct !== null ? (
                    <>
                      <p style={{ fontSize: '1.6rem', fontWeight: 700, color: ringColor, margin: 0, letterSpacing: '-0.03em' }}>{inventoryPct.toFixed(0)}%</p>
                      <p style={{ fontSize: '0.65rem', color: '#4b5563', margin: 0 }}>capacity</p>
                    </>
                  ) : (
                    <p style={{ fontSize: '0.65rem', color: '#374151', margin: 0 }}>Enter<br />values</p>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                <div>
                  <p style={{ fontSize: '0.65rem', color: '#4b5563', margin: '0 0 0.3rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Current (gal)</p>
                  <input
                    type="number"
                    placeholder="0"
                    value={fuelInventory}
                    onChange={(e) => setFuelInventory(e.target.value)}
                    onWheel={(e) => e.target.blur()}
                    style={{ width: '100%', background: '#060809', color: '#f9fafb', border: '1px solid #1a2030', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <p style={{ fontSize: '0.65rem', color: '#4b5563', margin: '0 0 0.3rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Max Capacity (gal)</p>
                  <input
                    type="number"
                    placeholder="0"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(e.target.value)}
                    onWheel={(e) => e.target.blur()}
                    style={{ width: '100%', background: '#060809', color: '#f9fafb', border: '1px solid #1a2030', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                {fuelInventory && maxCapacity && (
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                    {parseInt(fuelInventory).toLocaleString()} / {parseInt(maxCapacity).toLocaleString()} gal
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Margin Gauge */}
<div style={{ background: '#0d1117', border: '1px solid #1a2030', borderRadius: '1rem', padding: '1.5rem' }}>
  <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4b5563', margin: '0 0 1rem' }}>Margin vs. Target</p>
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>

    {/* Thermometer */}
    {(() => {
  const BULLET_W = 220;
  const BULLET_H = 32;
  const minM = 0;
  const maxM = 50;
  const actualPct = actualMargin !== null ? Math.min(Math.max((parseFloat(actualMargin) - minM) / (maxM - minM), 0), 1) : 0;
  const targetPct = Math.min(Math.max((Number(targetMargin) - minM) / (maxM - minM), 0), 1);
  const targetX = targetPct * BULLET_W;
  const actualX = actualPct * BULLET_W;
  const barColor = actualMargin === null ? '#1f2937' : Math.abs(parseFloat(marginDeviation)) < 2 ? '#22c55e' : Math.abs(parseFloat(marginDeviation)) < 5 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ width: '100%' }}>
      {/* Numbers row */}
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.25rem' }}>
        <div>
          <p style={{ fontSize: '0.65rem', color: '#4b5563', margin: '0 0 0.2rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Actual</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0, letterSpacing: '-0.03em', color: actualMargin !== null ? barColor : '#374151' }}>
            {actualMargin !== null ? `${actualMargin}%` : '—'}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '0.65rem', color: '#4b5563', margin: '0 0 0.2rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Target</p>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0, letterSpacing: '-0.03em', color: '#60a5fa' }}>{targetMargin}%</p>
        </div>
        {marginDeviation !== null && (
          <div>
            <p style={{ fontSize: '0.65rem', color: '#4b5563', margin: '0 0 0.2rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Gap</p>
            <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0, letterSpacing: '-0.03em', color: barColor }}>
              {parseFloat(marginDeviation) >= 0 ? '+' : ''}{marginDeviation}%
            </p>
          </div>
        )}
      </div>

      {/* Bullet chart */}
      <svg width="100%" viewBox={`0 0 ${BULLET_W} ${BULLET_H + 20}`} style={{ overflow: 'visible' }}>

        {/* Actual bar */}
        <rect
          x={0} y={BULLET_H * 0.25} width={actualX} height={BULLET_H * 0.5}
          rx="2" fill={barColor}
          style={{ transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />

        {/* Target tick */}
        <rect x={targetX - 1.5} y={-2} width={3} height={BULLET_H + 4} rx="1.5" fill="#ffffff" opacity="0.7" />

        {/* X axis labels */}
        {[0, 10, 20, 30, 40, 50].map(tick => {
          const tx = ((tick - minM) / (maxM - minM)) * BULLET_W;
          return (
            <text key={tick} x={tx} y={BULLET_H + 14} fontSize="8.5" fill="#374151" textAnchor="middle">{tick}%</text>
          );
        })}
      </svg>
    </div>
  );
})()}

    
  </div>
</div>
      </div>
        {/* Footer */}
        <div style={{ marginTop: '2rem', borderTop: '1px solid #111827', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.65rem', color: '#1f2937', letterSpacing: '0.04em' }}>BOWLINE CAPITAL LLC · CONFIDENTIAL</span>
          <span style={{ fontSize: '0.65rem', color: '#1f2937' }}>EIA data updates weekly · Prices in USD/gallon</span>
        </div>

      </div>
    </main>
  );
}