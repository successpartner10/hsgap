import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Star } from 'lucide-react';
import type { AssetType, WatchlistQuote } from '../types/market';
import { formatPct, formatPrice, formatUsdCompact } from '../utils/formatters';

interface CrossAssetWhaleRadarProps {
  quotes: WatchlistQuote[];
  selectedSymbol: string;
  minWhaleThreshold: number;
  favorites: string[];
  onToggleFavorite: (symbol: string) => void;
  onMinWhaleThresholdChange: (val: number) => void;
  onSelectSymbol: (symbol: string) => void;
}

const RADAR_TABS: Array<{
  key: AssetType;
  label: string;
  idle: string;
  active: string;
}> = [
  {
    key: 'FX',
    label: 'FX',
    idle: 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8] hover:bg-[#DBEAFE]',
    active: 'bg-[#DBEAFE] border-[#3B82F6] text-[#1E3A8A] ring-1 ring-[#3B82F6]',
  },
  {
    key: 'Equities',
    label: 'Stocks',
    idle: 'bg-[#F5F3FF] border-[#DDD6FE] text-[#6D28D9] hover:bg-[#EDE9FE]',
    active: 'bg-[#EDE9FE] border-[#8B5CF6] text-[#4C1D95] ring-1 ring-[#8B5CF6]',
  },
  {
    key: 'Crypto',
    label: 'Crypto',
    idle: 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309] hover:bg-[#FEF3C7]',
    active: 'bg-[#FEF3C7] border-[#F59E0B] text-[#78350F] ring-1 ring-[#F59E0B]',
  },
  {
    key: 'Commodities',
    label: 'Commodities',
    idle: 'bg-[#ECFEFF] border-[#A5F3FC] text-[#0E7490] hover:bg-[#CFFAFE]',
    active: 'bg-[#CFFAFE] border-[#06B6D4] text-[#164E63] ring-1 ring-[#06B6D4]',
  },
];

const BLOCK_FILTERS = [
  { value: 50_000, label: '$50K+' },
  { value: 100_000, label: '$100K+' },
  { value: 250_000, label: '$250K+' },
  { value: 500_000, label: '$500K+' },
  { value: 1_000_000, label: '$1M+' },
  { value: 5_000_000, label: '$5M+' },
];

export const CrossAssetWhaleRadar: React.FC<CrossAssetWhaleRadarProps> = ({
  quotes,
  selectedSymbol,
  minWhaleThreshold,
  favorites,
  onToggleFavorite,
  onMinWhaleThresholdChange,
  onSelectSymbol,
}) => {
  const [radarType, setRadarType] = useState<'All' | AssetType>('All');

  const handleToggleFavorite = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    onToggleFavorite(symbol);
  };

  const filteredQuotes = useMemo(() => {
    const base =
      radarType === 'All' ? quotes : quotes.filter((q) => q.type === radarType);
    const favUpper = new Set(favorites.map((s) => s.toUpperCase()));
    return [...base].sort((a, b) => {
      const aFav = favUpper.has(a.symbol.toUpperCase()) ? 0 : 1;
      const bFav = favUpper.has(b.symbol.toUpperCase()) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return Math.abs(b.whaleNetFlowUsd) - Math.abs(a.whaleNetFlowUsd);
    });
  }, [quotes, radarType, favorites]);

  const aggregates = useMemo(() => {
    let buys = 0;
    let sells = 0;
    for (const q of filteredQuotes) {
      buys += q.whaleBuyVolumeUsd;
      sells += q.whaleSellVolumeUsd;
    }
    return {
      total: buys + sells,
      buys,
      sells,
      net: buys - sells,
    };
  }, [filteredQuotes]);

  return (
    <div id="whale-radar" className="space-y-5">
      {/* Top Radar KPI Card */}
      <section className="bg-white border border-slate-200 rounded-[4px] p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Cross-Asset Whale Radar
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              2-week institutional whale volume (≥ {formatUsdCompact(minWhaleThreshold)}) and social sentiment across FX, stocks, crypto, and commodities.
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {RADAR_TABS.map((t) => {
                const active = radarType === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() =>
                      setRadarType((prev) => (prev === t.key ? 'All' : t.key))
                    }
                    aria-pressed={active}
                    className={`px-3 py-1 text-xs font-semibold rounded-[4px] border transition-colors cursor-pointer ${
                      active ? t.active : t.idle
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-[4px]">
              {BLOCK_FILTERS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => onMinWhaleThresholdChange(b.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-[4px] transition-colors cursor-pointer ${
                    minWhaleThreshold === b.value
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-500">Monitored Whale Volume</div>
            <div className="mt-1 font-mono-tabular text-xl font-bold text-slate-900">
              {formatUsdCompact(aggregates.total)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Aggregate Whale Buys</div>
            <div className="mt-1 font-mono-tabular text-xl font-bold text-[#059669]">
              {formatUsdCompact(aggregates.buys)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Aggregate Whale Sells</div>
            <div className="mt-1 font-mono-tabular text-xl font-bold text-[#DC2626]">
              {formatUsdCompact(aggregates.sells)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Cross-Asset Net Flow</div>
            <div
              className={`mt-1 font-mono-tabular text-xl font-bold ${
                aggregates.net >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'
              }`}
            >
              {formatUsdCompact(aggregates.net, true)}
            </div>
          </div>
        </div>
      </section>

      {/* Whale & Social Sentiment Matrix (4H) Table */}
      <section className="bg-white border border-slate-200 rounded-[4px] p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Whale &amp; Social Sentiment Matrix (2W · 4H)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tap any instrument to open its Sentiment Gap, 2-Week Heikin-Ashi &amp; Whale Markers, and flow drivers
          </p>
        </div>

        <div className="overflow-x-auto border-t border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead className="border-b border-slate-200 text-xs font-medium text-slate-500">
              <tr>
                <th className="py-3 pr-2 w-8">1-Clk</th>
                <th className="py-3 px-2 whitespace-nowrap">Instrument</th>
                <th className="py-3 px-2 whitespace-nowrap">Class</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Price</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">2W Change</th>
                <th className="py-3 px-3 whitespace-nowrap">Whale Sentiment</th>
                <th className="py-3 px-3 whitespace-nowrap">Social Buzz</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Whale Buy %</th>
                <th className="py-3 pl-3 text-right whitespace-nowrap">Net Whale Flow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredQuotes.map((q) => {
                const isSelected = q.symbol === selectedSymbol;
                const isFav = favorites.some(
                  (f) => f.toUpperCase() === q.symbol.toUpperCase()
                );
                const isNeg = q.change2wPct < 0;
                const classTag =
                  q.type === 'Equities'
                    ? 'STOCK'
                    : q.type === 'Commodities'
                    ? 'CMDTY'
                    : q.type.toUpperCase();

                return (
                  <tr
                    key={q.symbol}
                    onClick={() => onSelectSymbol(q.symbol)}
                    className={`h-11 cursor-pointer transition-colors ${
                      isSelected ? 'bg-slate-100/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(e, q.symbol)}
                        aria-label={`Star ${q.displaySymbol}`}
                        className="p-1 text-slate-400 hover:text-amber-500 cursor-pointer"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            isFav ? 'fill-amber-400 text-amber-500' : ''
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <span className="font-bold text-slate-900">
                        {q.displaySymbol}
                      </span>{' '}
                      <span className="text-slate-500">{q.name}</span>
                    </td>
                    <td className="py-2 px-2 font-mono-tabular text-[11px] font-medium text-slate-500">
                      {classTag}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular font-semibold text-slate-900">
                      {formatPrice(q.price, q.symbol, q.type)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono-tabular font-semibold ${
                        isNeg ? 'text-[#DC2626]' : 'text-[#059669]'
                      }`}
                    >
                      {formatPct(q.change2wPct)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-[4px] border ${
                          q.whaleSentimentLabel === 'Bullish Accumulation'
                            ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]'
                            : q.whaleSentimentLabel === 'Bearish Distribution'
                            ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
                            : 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
                        }`}
                      >
                        {q.whaleSentimentLabel === 'Bullish Accumulation' ? (
                          <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                        ) : q.whaleSentimentLabel === 'Bearish Distribution' ? (
                          <ArrowDownRight className="w-3 h-3" aria-hidden="true" />
                        ) : (
                          <span aria-hidden="true">—</span>
                        )}
                        <span>{q.whaleSentimentLabel}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-[4px] border ${
                          q.haBullishPct >= 58
                            ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]'
                            : q.haBullishPct <= 42
                            ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
                            : 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
                        }`}
                      >
                        {q.haBullishPct <= 42
                          ? `↘ ${100 - q.haBullishPct}% Bearish`
                          : `— ${q.haBullishPct}% Bullish`}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-slate-700">
                      {q.whaleBuyPct.toFixed(1)}%
                    </td>
                    <td
                      className={`py-2 pl-3 text-right font-mono-tabular font-semibold ${
                        q.whaleNetFlowUsd >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                      }`}
                    >
                      {formatUsdCompact(q.whaleNetFlowUsd, true)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
