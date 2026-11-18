import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Shield, TrendingDown, TrendingUp } from 'lucide-react';
import type {
  CandleInterval,
  HeikinAshiCandle,
  HeikinAshiResponse,
  SessionFilter,
} from '../types/market';
import {
  formatPct,
  formatPrice,
  formatUsdCompact,
  formatVolume,
} from '../utils/formatters';

interface SentimentAndHeikinAshiCardProps {
  data: HeikinAshiResponse | null;
  loading: boolean;
  error: string | null;
  interval: CandleInterval;
  minWhaleThreshold: number;
  sessionFilter: SessionFilter;
  onIntervalChange: (interval: CandleInterval) => void;
  onMinWhaleThresholdChange: (val: number) => void;
  onSessionFilterChange: (val: SessionFilter) => void;
  onRefresh: () => void;
}

const INTERVAL_OPTIONS: Array<{ value: CandleInterval; label: string }> = [
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
];

const WHALE_THRESHOLD_OPTIONS = [
  { value: 50_000, label: '$50K+' },
  { value: 100_000, label: '$100K+' },
  { value: 250_000, label: '$250K+' },
  { value: 500_000, label: '$500K+' },
  { value: 1_000_000, label: '$1M+' },
  { value: 5_000_000, label: '$5M+' },
];

const SESSION_OPTIONS: Array<{ value: SessionFilter; label: string }> = [
  { value: 'all', label: 'All Sessions' },
  { value: 'london_ny', label: 'London–NY (3AM–4PM)' },
  { value: 'ny_regular', label: 'NY Regular (9:30AM–4PM)' },
  { value: 'asia', label: 'Asia (7PM–3AM)' },
];

function matchesSession(hourEst: number, session: SessionFilter): boolean {
  if (session === 'all') return true;
  if (session === 'london_ny') return hourEst >= 3 && hourEst <= 16;
  if (session === 'ny_regular') return hourEst >= 9 && hourEst <= 16;
  return hourEst >= 19 || hourEst < 3;
}

export const SentimentAndHeikinAshiCard: React.FC<SentimentAndHeikinAshiCardProps> = ({
  data,
  loading,
  error,
  interval,
  minWhaleThreshold,
  sessionFilter,
  onIntervalChange,
  onMinWhaleThresholdChange,
  onSessionFilterChange,
  onRefresh,
}) => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(920);
  const [hoveredSentimentIdx, setHoveredSentimentIdx] = useState<number | null>(null);
  const [hoveredCandleIdx, setHoveredCandleIdx] = useState<number | null>(null);

  const [showEma20, setShowEma20] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showWhales, setShowWhales] = useState(true);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(Math.max(320, Math.floor(entry.contentRect.width)));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setHoveredCandleIdx(null);
    setHoveredSentimentIdx(null);
  }, [data?.symbol, data?.interval]);

  const candles = data?.candles ?? [];

  // Filtered Whale Executions matching min threshold & session
  const filteredWhales = useMemo(() => {
    if (!data) return [];
    return data.whaleExecutions.filter(
      (w) =>
        w.notionalUsd >= minWhaleThreshold &&
        matchesSession(w.hourEst, sessionFilter)
    );
  }, [data, minWhaleThreshold, sessionFilter]);

  const whaleByTimestamp = useMemo(() => {
    const map = new Map<number, 'buy' | 'sell'>();
    for (const w of filteredWhales) {
      map.set(w.timestamp, w.side);
    }
    return map;
  }, [filteredWhales]);

  const whaleTotals = useMemo(() => {
    let buyUsd = 0;
    let sellUsd = 0;
    let buyCount = 0;
    let sellCount = 0;
    let largestPrint: { notionalUsd: number; side: 'buy' | 'sell' } | null = null;

    for (const w of filteredWhales) {
      if (w.side === 'buy') {
        buyUsd += w.notionalUsd;
        buyCount += 1;
      } else {
        sellUsd += w.notionalUsd;
        sellCount += 1;
      }
      if (!largestPrint || w.notionalUsd > largestPrint.notionalUsd) {
        largestPrint = { notionalUsd: w.notionalUsd, side: w.side };
      }
    }

    const totalUsd = buyUsd + sellUsd;
    const buyPct = totalUsd > 0 ? (buyUsd / totalUsd) * 100 : 50;
    const sellPct = 100 - buyPct;
    const netFlow = buyUsd - sellUsd;
    const label =
      buyPct >= 58
        ? 'Bullish Accumulation'
        : buyPct <= 42
        ? 'Bearish Distribution'
        : 'Balanced Flow';

    return {
      buyUsd,
      sellUsd,
      buyCount,
      sellCount,
      buyPct,
      sellPct,
      netFlow,
      largestPrint,
      label,
    };
  }, [filteredWhales]);

  // --- Sentiment vs Market Consensus Chart Geometry ---
  const sentHeight = 195;
  const sentPadLeft = 40;
  const sentPadRight = 24;
  const sentPadTop = 14;
  const sentPadBottom = 26;
  const sentPlotW = Math.max(200, width - sentPadLeft - sentPadRight);
  const sentPlotH = sentHeight - sentPadTop - sentPadBottom;

  const xSent = (idx: number) => {
    if (candles.length <= 1) return sentPadLeft;
    return sentPadLeft + (idx / (candles.length - 1)) * sentPlotW;
  };
  const ySent = (score: number) => {
    return sentPadTop + ((100 - score) / 100) * sentPlotH;
  };

  const { socialPath, consensusPath, spreadAreaPath } = useMemo(() => {
    if (candles.length === 0) {
      return { socialPath: '', consensusPath: '', spreadAreaPath: '' };
    }
    const sPts = candles.map((c, i) => ({ x: xSent(i), y: ySent(c.socialMomentum) }));
    const cPts = candles.map((c, i) => ({ x: xSent(i), y: ySent(c.marketConsensus) }));

    const sPath = sPts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const cPath = cPts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    const forward = sPts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const backward = [...cPts]
      .reverse()
      .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    return {
      socialPath: sPath,
      consensusPath: cPath,
      spreadAreaPath: `${forward} ${backward} Z`,
    };
  }, [candles, width]);

  const activeSentCandle =
    candles.length > 0
      ? candles[
          hoveredSentimentIdx !== null && hoveredSentimentIdx < candles.length
            ? hoveredSentimentIdx
            : candles.length - 1
        ]
      : null;

  const sentSocialVal = activeSentCandle?.socialMomentum ?? data?.socialNow ?? 50;
  const sentConsensusVal = activeSentCandle?.marketConsensus ?? data?.consensusNow ?? 50;
  const sentGapVal = sentSocialVal - sentConsensusVal;

  // --- Heikin-Ashi Chart Geometry ---
  const haHeight = width < 640 ? 270 : 320;
  const padLeft = 14;
  const padRight = 76;
  const padTop = 14;
  const padBottom = 26;
  const volHeight = 42;
  const chartW = Math.max(200, width - padLeft - padRight);
  const pricePlotH = Math.max(130, haHeight - padTop - padBottom - volHeight - 8);
  const volTop = padTop + pricePlotH + 8;

  const { minPrice, maxPrice, maxVol } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 0, maxPrice: 100, maxVol: 1 };
    let minP = Infinity;
    let maxP = -Infinity;
    let mVol = 0;

    for (const c of candles) {
      minP = Math.min(minP, c.haLow);
      maxP = Math.max(maxP, c.haHigh);
      if (showEma20) {
        minP = Math.min(minP, c.ema20);
        maxP = Math.max(maxP, c.ema20);
      }
      if (showVwap) {
        minP = Math.min(minP, c.vwap);
        maxP = Math.max(maxP, c.vwap);
      }
      if (c.volume > mVol) mVol = c.volume;
    }

    const span = maxP - minP || maxP * 0.02 || 1;
    return {
      minPrice: minP - span * 0.08,
      maxPrice: maxP + span * 0.08,
      maxVol: mVol > 0 ? mVol : 1,
    };
  }, [candles, showEma20, showVwap]);

  const yForPrice = (price: number) => {
    const span = maxPrice - minPrice || 1;
    return padTop + ((maxPrice - price) / span) * pricePlotH;
  };

  const stepX = candles.length > 0 ? chartW / candles.length : chartW;
  const bodyW = Math.max(3, Math.min(16, stepX * 0.65));
  const xForIndex = (idx: number) => padLeft + idx * stepX + stepX / 2;

  const priceTicks = useMemo(() => {
    const ticks: number[] = [];
    const span = maxPrice - minPrice;
    for (let i = 0; i <= 4; i++) {
      ticks.push(minPrice + (span * i) / 4);
    }
    return ticks;
  }, [minPrice, maxPrice]);

  const xTickIndices = useMemo(() => {
    if (candles.length <= 1) return candles.length === 1 ? [0] : [];
    const mid = Math.floor((candles.length - 1) / 2);
    return candles.length >= 3 ? [0, mid, candles.length - 1] : [0, candles.length - 1];
  }, [candles.length]);

  const ema20Path = useMemo(() => {
    if (!showEma20 || candles.length === 0) return '';
    return candles
      .map(
        (c, idx) =>
          `${idx === 0 ? 'M' : 'L'} ${xForIndex(idx).toFixed(1)} ${yForPrice(
            c.ema20
          ).toFixed(1)}`
      )
      .join(' ');
  }, [showEma20, candles, width, minPrice, maxPrice]);

  const vwapPath = useMemo(() => {
    if (!showVwap || candles.length === 0) return '';
    return candles
      .map(
        (c, idx) =>
          `${idx === 0 ? 'M' : 'L'} ${xForIndex(idx).toFixed(1)} ${yForPrice(
            c.vwap
          ).toFixed(1)}`
      )
      .join(' ');
  }, [showVwap, candles, width, minPrice, maxPrice]);

  const activeCandle: HeikinAshiCandle | null =
    candles.length > 0
      ? candles[
          hoveredCandleIdx !== null && hoveredCandleIdx < candles.length
            ? hoveredCandleIdx
            : candles.length - 1
        ]
      : null;

  const isNetBearish = (data?.change2wPct ?? 0) < 0;
  const stanceClasses =
    data?.stance === 'BUY BIAS'
      ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]'
      : data?.stance === 'SELL BIAS'
      ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
      : 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]';

  const typeLabel =
    data?.type === 'FX'
      ? 'Forex'
      : data?.type === 'Equities'
      ? 'Stocks'
      : data?.type || 'Market';

  const bullBarPct =
    data && data.bullishBars + data.bearishBars > 0
      ? Math.round((data.bullishBars / (data.bullishBars + data.bearishBars)) * 100)
      : 50;

  return (
    <div id="heikin-ashi-chart" className="space-y-5">
      {/* Screenshot 1 Top Hero Instrument Card */}
      <section className="bg-white border border-slate-200 rounded-[4px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2 text-slate-500">
            <span className="font-bold text-slate-900">
              {data?.displaySymbol || 'USD/CHF'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{typeLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{interval.toUpperCase()} Pulse (2W)</span>
            <span aria-hidden="true">·</span>
            <span
              className={`font-medium ${
                data?.confidence === 'High'
                  ? 'text-[#059669]'
                  : data?.confidence === 'Medium'
                  ? 'text-[#D97706]'
                  : 'text-slate-600'
              }`}
            >
              Confidence: {data?.confidence || 'High'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-slate-500">
            <span className="font-mono-tabular">
              {data
                ? new Date(data.updatedAt).toLocaleTimeString('en-US', {
                    timeZone: 'America/New_York',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  }) + ' EST'
                : '—'}
            </span>
            <span className="px-2 py-0.5 text-[11px] font-semibold text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] rounded-[4px]">
              Live 1m
            </span>
          </div>
        </div>

        <div className="pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {data?.name || 'US Dollar / Swiss Franc'}
            </h1>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="font-mono-tabular text-2xl sm:text-[26px] font-bold text-slate-900">
                {data ? formatPrice(data.currentPrice, data.symbol, data.type) : '—'}
              </span>
              {data && (
                <span
                  className={`font-mono-tabular text-sm font-bold ${
                    isNetBearish ? 'text-[#DC2626]' : 'text-[#059669]'
                  }`}
                >
                  {formatPct(data.change2wPct)}
                </span>
              )}
            </div>
            {data && (
              <p className="text-sm text-slate-600 leading-relaxed">
                {data.name} exhibits{' '}
                {data.stance === 'BUY BIAS'
                  ? 'net bullish alignment'
                  : data.stance === 'SELL BIAS'
                  ? 'net bearish pressure'
                  : 'mixed two-way rotation'}{' '}
                across 2-week {interval.toUpperCase()} Heikin-Ashi structure and institutional whale flow, framing{' '}
                {data.stance === 'BUY BIAS'
                  ? `constructive edge for ${data.displaySymbol} upside.`
                  : data.stance === 'SELL BIAS'
                  ? `downside continuation risk for ${data.displaySymbol}.`
                  : `tactical range conditions for ${data.displaySymbol}.`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Rating
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-slate-900">
                {data?.ratingScore ?? '—'}
                <span className="text-sm font-normal text-slate-400"> / 100</span>
              </div>
            </div>

            <div className={`px-4 py-2.5 rounded-[4px] border ${stanceClasses}`}>
              <div className="text-[11px] font-medium opacity-80">Stance</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm font-bold whitespace-nowrap">
                {data?.stance === 'SELL BIAS' ? (
                  <TrendingDown className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{data?.stance || 'BUY BIAS'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshot 1 & 4 Unified Sentiment + 2-Week Heikin-Ashi + Whale Breakdown Card */}
      <section className="bg-white border border-slate-200 rounded-[4px] p-5 space-y-5">
        {/* Part A: 4H Sentiment vs. Market Consensus */}
        <div ref={chartContainerRef} className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                {interval.toUpperCase()} Sentiment vs. Market Consensus
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Social momentum ({sentSocialVal}){' '}
                {sentGapVal >= 0 ? 'leads' : 'lags'} market consensus ({sentConsensusVal}) by{' '}
                {sentGapVal >= 0 ? `+${sentGapVal}` : sentGapVal} pts over the 2-week {interval.toUpperCase()} curve.
              </p>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1.5 rounded-[4px] border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh Live</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-4 text-slate-700 font-medium">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#0F172A] inline-block" />
                <span>Social Momentum</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-slate-500 inline-block" />
                <span>Market Consensus</span>
              </span>
            </div>

            <div className="font-mono-tabular text-xs text-slate-600">
              <span>{activeSentCandle ? activeSentCandle.dateLabel : 'Now'}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span>
                Social <strong className="text-slate-900">{sentSocialVal}</strong> / Consensus{' '}
                <strong className="text-slate-900">{sentConsensusVal}</strong>
              </span>
              <span className="mx-1.5 text-slate-300">·</span>
              <strong
                className={
                  sentGapVal < 0 ? 'text-[#DC2626]' : 'text-[#059669]'
                }
              >
                Gap {sentGapVal >= 0 ? `+${sentGapVal}` : sentGapVal}
              </strong>
            </div>
          </div>

          {/* Sentiment SVG Plot */}
          <svg
            width={width}
            height={sentHeight}
            onMouseMove={(e) => {
              if (candles.length === 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = e.clientX - rect.left - sentPadLeft;
              if (relX < 0 || relX > sentPlotW) {
                setHoveredSentimentIdx(null);
                return;
              }
              const idx = Math.min(
                candles.length - 1,
                Math.max(0, Math.round((relX / sentPlotW) * (candles.length - 1)))
              );
              setHoveredSentimentIdx(idx);
            }}
            onMouseLeave={() => setHoveredSentimentIdx(null)}
            className="block select-none"
            role="img"
            aria-label="Sentiment vs Market Consensus curve"
          >
            {[0, 50, 100].map((val) => {
              const y = ySent(val);
              return (
                <g key={val}>
                  <line
                    x1={sentPadLeft}
                    x2={sentPadLeft + sentPlotW}
                    y1={y}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeWidth={1}
                  />
                  <text
                    x={sentPadLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="#64748B"
                    fontSize={11}
                    fontFamily="Raleway, sans-serif"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {spreadAreaPath && (
              <path d={spreadAreaPath} fill="rgba(15, 23, 42, 0.08)" />
            )}

            {consensusPath && (
              <path
                d={consensusPath}
                fill="none"
                stroke="#475569"
                strokeWidth={1.6}
                strokeDasharray="4 4"
              />
            )}

            {socialPath && (
              <path
                d={socialPath}
                fill="none"
                stroke="#0F172A"
                strokeWidth={2}
              />
            )}

            {candles.length > 0 && (
              <>
                <circle
                  cx={xSent(candles.length - 1)}
                  cy={ySent(candles[candles.length - 1].marketConsensus)}
                  r={3.5}
                  fill="#FFFFFF"
                  stroke="#0F172A"
                  strokeWidth={1.6}
                />
                <circle
                  cx={xSent(candles.length - 1)}
                  cy={ySent(candles[candles.length - 1].socialMomentum)}
                  r={3.5}
                  fill="#0F172A"
                />
              </>
            )}

            {hoveredSentimentIdx !== null && candles[hoveredSentimentIdx] && (
              <line
                x1={xSent(hoveredSentimentIdx)}
                x2={xSent(hoveredSentimentIdx)}
                y1={sentPadTop}
                y2={sentPadTop + sentPlotH}
                stroke="#94A3B8"
                strokeDasharray="3 3"
              />
            )}

            {xTickIndices.map((idx, i) => {
              const c = candles[idx];
              if (!c) return null;
              const label =
                i === xTickIndices.length - 1
                  ? 'Now'
                  : c.dateLabel.replace(' EST', '');
              const anchor =
                i === 0 ? 'start' : i === xTickIndices.length - 1 ? 'end' : 'middle';
              return (
                <text
                  key={`sent-x-${c.timestamp}`}
                  x={xSent(idx)}
                  y={sentHeight - 6}
                  textAnchor={anchor}
                  fill="#64748B"
                  fontSize={11}
                  fontFamily="Raleway, sans-serif"
                >
                  {label}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Part B: 2-Week Heikin-Ashi Chart */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-800">
              {activeCandle ? `${activeCandle.fullDate} · Heikin-Ashi (2-Week Data)` : 'Heikin-Ashi (2-Week Data)'}
            </span>

            {activeCandle && data && (
              <div className="flex flex-wrap items-center gap-3 font-mono-tabular text-slate-500">
                <span>
                  O <strong className="text-slate-900">{formatPrice(activeCandle.haOpen, data.symbol, data.type)}</strong>
                </span>
                <span>
                  H <strong className="text-slate-900">{formatPrice(activeCandle.haHigh, data.symbol, data.type)}</strong>
                </span>
                <span>
                  L <strong className="text-slate-900">{formatPrice(activeCandle.haLow, data.symbol, data.type)}</strong>
                </span>
                <span>
                  C{' '}
                  <strong className={activeCandle.isBullish ? 'text-[#059669]' : 'text-[#DC2626]'}>
                    {formatPrice(activeCandle.haClose, data.symbol, data.type)}
                  </strong>
                </span>
                <span>
                  Vol <strong className="text-slate-700">{formatVolume(activeCandle.volume)}</strong>
                </span>
              </div>
            )}
          </div>

          {error ? (
            <div className="h-[280px] flex flex-col items-center justify-center p-6 text-center">
              <p className="text-sm font-medium text-[#DC2626]">{error}</p>
              <button
                type="button"
                onClick={onRefresh}
                className="mt-3 px-4 py-2 text-xs font-medium bg-[#0F172A] hover:bg-slate-800 text-white rounded-[4px] cursor-pointer"
              >
                Retry Feed
              </button>
            </div>
          ) : loading && candles.length === 0 ? (
            <div className="h-[310px] flex items-center justify-center text-xs font-mono-tabular text-slate-400">
              Loading 2-week Heikin-Ashi candles...
            </div>
          ) : (
            <svg
              width={width}
              height={haHeight}
              onMouseMove={(e) => {
                if (candles.length === 0) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = e.clientX - rect.left - padLeft;
                if (relX < 0 || relX > chartW) {
                  setHoveredCandleIdx(null);
                  return;
                }
                const idx = Math.min(
                  candles.length - 1,
                  Math.max(0, Math.floor(relX / stepX))
                );
                setHoveredCandleIdx(idx);
              }}
              onMouseLeave={() => setHoveredCandleIdx(null)}
              className="block select-none"
              role="img"
              aria-label={`2-Week Heikin-Ashi chart for ${data?.displaySymbol || 'asset'}`}
            >
              {priceTicks.map((tick, idx) => {
                const y = yForPrice(tick);
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      x2={padLeft + chartW}
                      y1={y}
                      y2={y}
                      stroke="#F1F5F9"
                      strokeWidth={1}
                    />
                    <text
                      x={padLeft + chartW + 8}
                      y={y + 4}
                      fill="#64748B"
                      fontSize={10.5}
                      fontFamily="Raleway, sans-serif"
                    >
                      {data ? formatPrice(tick, data.symbol, data.type) : tick.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* Volume Bars */}
              {candles.map((c, idx) => {
                const cx = xForIndex(idx);
                const barH = Math.max(1, (c.volume / maxVol) * (volHeight - 4));
                const fill = c.isBullish
                  ? 'rgba(16, 185, 129, 0.22)'
                  : 'rgba(239, 68, 68, 0.22)';
                return (
                  <rect
                    key={`vol-${c.timestamp}`}
                    x={cx - bodyW / 2}
                    y={volTop + volHeight - barH - 2}
                    width={bodyW}
                    height={barH}
                    fill={fill}
                    rx={1}
                  />
                );
              })}

              {/* Heikin-Ashi Candles + Whale Triangle Markers */}
              {candles.map((c, idx) => {
                const cx = xForIndex(idx);
                const wickTop = yForPrice(c.haHigh);
                const wickBottom = yForPrice(c.haLow);
                const openY = yForPrice(c.haOpen);
                const closeY = yForPrice(c.haClose);
                const bodyTop = Math.min(openY, closeY);
                const bodyHeight = Math.max(2, Math.abs(closeY - openY));
                const candleColor = c.isBullish ? '#059669' : '#DC2626';
                const isHovered = hoveredCandleIdx === idx;
                const whaleSide = showWhales ? whaleByTimestamp.get(c.timestamp) : undefined;

                return (
                  <g key={c.timestamp}>
                    {isHovered && (
                      <rect
                        x={cx - stepX / 2}
                        y={padTop}
                        width={stepX}
                        height={pricePlotH + volHeight + 6}
                        fill="rgba(15, 23, 42, 0.04)"
                      />
                    )}
                    <line
                      x1={cx}
                      x2={cx}
                      y1={wickTop}
                      y2={wickBottom}
                      stroke={candleColor}
                      strokeWidth={isHovered ? 2 : 1.25}
                    />
                    <rect
                      x={cx - bodyW / 2}
                      y={bodyTop}
                      width={bodyW}
                      height={bodyHeight}
                      fill={candleColor}
                      rx={1}
                    />
                    {whaleSide === 'buy' && (
                      <polygon
                        points={`${cx},${Math.min(padTop + pricePlotH - 2, wickBottom + 6)} ${cx - 4},${Math.min(padTop + pricePlotH + 4, wickBottom + 13)} ${cx + 4},${Math.min(padTop + pricePlotH + 4, wickBottom + 13)}`}
                        fill="#059669"
                      />
                    )}
                    {whaleSide === 'sell' && (
                      <polygon
                        points={`${cx},${Math.max(padTop + 2, wickTop - 6)} ${cx - 4},${Math.max(padTop - 4, wickTop - 13)} ${cx + 4},${Math.max(padTop - 4, wickTop - 13)}`}
                        fill="#DC2626"
                      />
                    )}
                  </g>
                );
              })}

              {showEma20 && ema20Path && (
                <path d={ema20Path} fill="none" stroke="#2563EB" strokeWidth={1.75} />
              )}

              {showVwap && vwapPath && (
                <path
                  d={vwapPath}
                  fill="none"
                  stroke="#D97706"
                  strokeWidth={1.6}
                  strokeDasharray="4 3"
                />
              )}

              {data && candles.length > 0 && (
                <g>
                  <line
                    x1={padLeft}
                    x2={padLeft + chartW}
                    y1={yForPrice(data.currentPrice)}
                    y2={yForPrice(data.currentPrice)}
                    stroke={data.latestHaBullish ? '#059669' : '#DC2626'}
                    strokeDasharray="2 3"
                    strokeWidth={1}
                  />
                  <rect
                    x={padLeft + chartW + 2}
                    y={yForPrice(data.currentPrice) - 10}
                    width={padRight - 4}
                    height={20}
                    rx={4}
                    fill={data.latestHaBullish ? '#059669' : '#DC2626'}
                  />
                  <text
                    x={padLeft + chartW + 7}
                    y={yForPrice(data.currentPrice) + 4}
                    fill="#FFFFFF"
                    fontSize={10.5}
                    fontWeight={600}
                    fontFamily="Raleway, sans-serif"
                  >
                    {formatPrice(data.currentPrice, data.symbol, data.type)}
                  </text>
                </g>
              )}

              {xTickIndices.map((idx, i) => {
                const c = candles[idx];
                if (!c) return null;
                const anchor =
                  i === 0 ? 'start' : i === xTickIndices.length - 1 ? 'end' : 'middle';
                return (
                  <text
                    key={`ha-x-${c.timestamp}`}
                    x={xForIndex(idx)}
                    y={haHeight - 6}
                    textAnchor={anchor}
                    fill="#64748B"
                    fontSize={10.5}
                    fontFamily="Raleway, sans-serif"
                  >
                    {c.dateLabel}
                  </text>
                );
              })}
            </svg>
          )}

          {/* Screenshot 1 & 4 Bottom Controls Row (4px corners) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-[4px]">
              {INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onIntervalChange(opt.value)}
                  className={`px-3 py-1 text-xs font-semibold rounded-[4px] transition-colors cursor-pointer ${
                    interval === opt.value
                      ? 'bg-[#0F172A] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowEma20((p) => !p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[4px] border transition-colors cursor-pointer ${
                showEma20
                  ? 'bg-[#EFF6FF] border-[#93C5FD] text-[#2563EB]'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              — EMA-20
            </button>

            <button
              type="button"
              onClick={() => setShowVwap((p) => !p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[4px] border transition-colors cursor-pointer ${
                showVwap
                  ? 'bg-[#FFFBEB] border-[#FCD34D] text-[#D97706]'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              — VWAP
            </button>

            <button
              type="button"
              onClick={() => setShowWhales((p) => !p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[4px] border transition-colors cursor-pointer ${
                showWhales
                  ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              ▲ Whales
            </button>

            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-[4px] text-slate-600">
              <span>Min</span>
              <select
                value={minWhaleThreshold}
                onChange={(e) => onMinWhaleThresholdChange(Number(e.target.value))}
                className="font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {WHALE_THRESHOLD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-[4px] text-slate-600">
              <span>Session</span>
              <select
                value={sessionFilter}
                onChange={(e) => onSessionFilterChange(e.target.value as SessionFilter)}
                className="font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {SESSION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="text-[11px] text-slate-500">
            Times in EST · Heikin-Ashi {interval.toUpperCase()} · 2-Week Window (14 Days)
          </div>
        </div>

        {/* Part C: Screenshot 4 WHALE SENTIMENT Split Bar + 01..04 Cards */}
        {data && (
          <div className="pt-3 space-y-4">
            <div className="border border-slate-200 rounded-[4px] p-4 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                  <span className="font-bold tracking-wide text-slate-900 uppercase">
                    Whale Sentiment
                  </span>
                  <span aria-hidden="true" className="text-slate-300">—</span>
                  <span
                    className={`font-semibold ${
                      whaleTotals.label === 'Bullish Accumulation'
                        ? 'text-[#059669]'
                        : whaleTotals.label === 'Bearish Distribution'
                        ? 'text-[#DC2626]'
                        : 'text-[#D97706]'
                    }`}
                  >
                    {whaleTotals.label}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-slate-500">
                    Prints ≥ {formatUsdCompact(minWhaleThreshold)}
                  </span>
                </div>

                <div className="font-mono-tabular font-semibold text-slate-700">
                  Net Flow{' '}
                  <span
                    className={
                      whaleTotals.netFlow >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                    }
                  >
                    {formatUsdCompact(whaleTotals.netFlow, true)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                <span className="text-[#059669]">
                  Whale Buys {formatUsdCompact(whaleTotals.buyUsd)} (
                  {whaleTotals.buyPct.toFixed(1)}% · {whaleTotals.buyCount})
                </span>
                <span className="text-[#DC2626]">
                  Whale Sells {formatUsdCompact(whaleTotals.sellUsd)} (
                  {whaleTotals.sellPct.toFixed(1)}% · {whaleTotals.sellCount})
                </span>
              </div>

              <div className="mt-1.5 h-2 w-full rounded-[4px] bg-slate-100 overflow-hidden flex">
                <div
                  className="h-full bg-[#059669] transition-all duration-300"
                  style={{ width: `${whaleTotals.buyPct}%` }}
                />
                <div
                  className="h-full bg-[#E11D48] transition-all duration-300"
                  style={{ width: `${whaleTotals.sellPct}%` }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-slate-600">
                <span>
                  {typeLabel} block flow ≥ {formatUsdCompact(minWhaleThreshold)} · 2W High{' '}
                  <strong className="font-mono-tabular text-slate-900">
                    {formatPrice(data.high2w, data.symbol, data.type)}
                  </strong>{' '}
                  / Low{' '}
                  <strong className="font-mono-tabular text-slate-900">
                    {formatPrice(data.low2w, data.symbol, data.type)}
                  </strong>
                </span>
                <span>
                  Largest Print:{' '}
                  <strong className="font-mono-tabular text-slate-900">
                    {whaleTotals.largestPrint
                      ? `${formatUsdCompact(whaleTotals.largestPrint.notionalUsd)} (${
                          whaleTotals.largestPrint.side === 'buy' ? 'Buy' : 'Sell'
                        })`
                      : 'None'}
                  </strong>
                </span>
              </div>
            </div>

            {/* 2x2 Sub-Cards Grid with slightly larger typography */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-slate-200 rounded-[4px] px-4 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    01. Social Buzz
                  </div>
                  <div className="text-[13px] text-slate-500 mt-0.5">
                    Bullish Share (2W HA Bars)
                  </div>
                </div>
                <div
                  className={`font-mono-tabular text-sm font-bold ${
                    bullBarPct >= 50 ? 'text-[#059669]' : 'text-[#D97706]'
                  }`}
                >
                  {bullBarPct}% Bullish ({data.bullishBars}/{data.bullishBars + data.bearishBars})
                </div>
              </div>

              <div className="border border-slate-200 rounded-[4px] px-4 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    02. Trend
                  </div>
                  <div className="text-[13px] text-slate-500 mt-0.5">
                    EMA-20 Spread
                  </div>
                </div>
                <div
                  className={`font-mono-tabular text-sm font-bold ${
                    data.ema20SpreadPct >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                  }`}
                >
                  {data.ema20SpreadPct >= 0 ? '+' : ''}
                  {data.ema20SpreadPct.toFixed(2)}% vs EMA-20
                </div>
              </div>

              <div className="border border-slate-200 rounded-[4px] px-4 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    03. Momentum
                  </div>
                  <div className="text-[13px] text-slate-500 mt-0.5">RSI (14)</div>
                </div>
                <div
                  className={`font-mono-tabular text-sm font-bold ${
                    data.rsi14 >= 50 ? 'text-[#059669]' : 'text-[#DC2626]'
                  }`}
                >
                  {data.rsi14.toFixed(1)}
                </div>
              </div>

              <div className="border border-slate-200 rounded-[4px] px-4 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    04. Volume
                  </div>
                  <div className="text-[13px] text-slate-500 mt-0.5">
                    Relative Vol
                  </div>
                </div>
                <div className="font-mono-tabular text-sm font-bold text-[#059669]">
                  {data.relativeVolume.toFixed(2)}× avg
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
