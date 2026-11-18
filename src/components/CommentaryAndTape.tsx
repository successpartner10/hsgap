import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Search,
} from 'lucide-react';
import type {
  HeikinAshiResponse,
  NewsCommentaryItem,
  SessionFilter,
} from '../types/market';
import { formatPrice, formatUsdCompact } from '../utils/formatters';

interface CommentaryAndTapeProps {
  data: HeikinAshiResponse | null;
  newsItems: NewsCommentaryItem[];
  newsLoading: boolean;
  minWhaleThreshold: number;
  sessionFilter: SessionFilter;
}

function matchesSession(hourEst: number, session: SessionFilter): boolean {
  if (session === 'all') return true;
  if (session === 'london_ny') return hourEst >= 3 && hourEst <= 16;
  if (session === 'ny_regular') return hourEst >= 9 && hourEst <= 16;
  return hourEst >= 19 || hourEst < 3;
}

export const CommentaryAndTape: React.FC<CommentaryAndTapeProps> = ({
  data,
  newsItems,
  newsLoading,
  minWhaleThreshold,
  sessionFilter,
}) => {
  const [newsTab, setNewsTab] = useState<'All' | 'Market News' | 'Analyst Wire'>('All');
  const [tapeFilter, setTapeFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [tapeSearch, setTapeSearch] = useState('');
  const [showAllPrints, setShowAllPrints] = useState(false);

  const filteredNews = useMemo(() => {
    if (newsTab === 'All') return newsItems;
    return newsItems.filter((n) => n.sourceType === newsTab);
  }, [newsItems, newsTab]);

  const filteredExecutions = useMemo(() => {
    if (!data) return [];
    const q = tapeSearch.trim().toLowerCase();
    return data.whaleExecutions.filter((w) => {
      if (w.notionalUsd < minWhaleThreshold) return false;
      if (!matchesSession(w.hourEst, sessionFilter)) return false;
      if (tapeFilter !== 'all' && w.side !== tapeFilter) return false;
      if (q) {
        return (
          w.venue.toLowerCase().includes(q) ||
          w.context.toLowerCase().includes(q) ||
          w.timeEst.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, minWhaleThreshold, sessionFilter, tapeFilter, tapeSearch]);

  const visibleExecutions = showAllPrints
    ? filteredExecutions
    : filteredExecutions.slice(0, 5);

  const handleDownloadCsv = () => {
    if (!data) return;
    const headers = [
      'Time_EST',
      'Side',
      'Price',
      'Size',
      'Notional_USD',
      'Venue',
      'Context',
    ];
    const rows = [
      headers.join(','),
      ...filteredExecutions.map((w) =>
        [
          `"${w.timeEst}"`,
          w.side === 'buy' ? 'Whale Buy' : 'Whale Sell',
          w.price,
          w.size.toFixed(2),
          w.notionalUsd.toFixed(2),
          `"${w.venue}"`,
          `"${w.context}"`,
        ].join(',')
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.symbol}_whale_executions_2w.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Screenshot 3 & 4: Observed Online Commentary */}
      <section
        id="commentary"
        className="bg-white border border-slate-200 rounded-[4px] p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Observed Online Commentary
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live Market Wire &amp; Analyst Feed for {data?.displaySymbol || 'USD/CHF'}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-[4px]">
            {(['All', 'Market News', 'Analyst Wire'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setNewsTab(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-[4px] transition-colors cursor-pointer ${
                  newsTab === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 divide-y divide-slate-100">
          <div className="py-2.5 grid grid-cols-1 md:grid-cols-12 gap-4 text-xs font-medium text-slate-500">
            <div className="md:col-span-3">Time &amp; Source</div>
            <div className="md:col-span-9">Observed Comment / Headline</div>
          </div>

          {newsLoading && filteredNews.length === 0 ? (
            <div className="py-6 text-xs text-slate-400">
              Loading market commentary...
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="py-6 text-xs text-slate-500">
              No recent wire commentary returned for {data?.displaySymbol || 'this symbol'}.
            </div>
          ) : (
            filteredNews.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="py-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs"
              >
                <div className="md:col-span-3 space-y-0.5">
                  <div className="font-semibold text-slate-900">{item.timeAgo}</div>
                  <div className="font-mono-tabular text-[11px] text-slate-400">
                    {item.timeEst}
                  </div>
                  <div className="font-medium text-slate-700 pt-0.5">
                    {item.publisher}
                  </div>
                  <div
                    className={`font-medium ${
                      item.sentiment === 'Bullish'
                        ? 'text-[#059669]'
                        : item.sentiment === 'Bearish'
                        ? 'text-[#DC2626]'
                        : 'text-[#D97706]'
                    }`}
                  >
                    {item.sentiment} · {item.sourceType}
                  </div>
                </div>

                <div className="md:col-span-9 space-y-1.5">
                  <p className="text-sm text-slate-800 leading-relaxed">{item.title}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900 hover:underline"
                    >
                      <span>Read source</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Screenshot 3: Large Volume Executions */}
      {data && (
        <section
          id="whale-tape"
          className="bg-white border border-slate-200 rounded-[4px] p-5 space-y-4"
        >
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              {data.displaySymbol} Large Volume Executions
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              2-Week {data.interval.toUpperCase()} OHLC institutional volume spikes &amp; block flow ≥ {formatUsdCompact(minWhaleThreshold)} · Sorted latest first in EST
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-[4px]">
                {(
                  [
                    { key: 'all', label: 'All Prints' },
                    { key: 'buy', label: 'Whale Buys' },
                    { key: 'sell', label: 'Whale Sells' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTapeFilter(t.key)}
                    className={`px-3 py-1 text-xs font-medium rounded-[4px] transition-colors cursor-pointer ${
                      tapeFilter === t.key
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={tapeSearch}
                  onChange={(e) => setTapeSearch(e.target.value)}
                  placeholder="Search venue or note..."
                  className="w-48 pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-[4px] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>Download CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <tr>
                  <th className="py-3 pr-4 whitespace-nowrap">Time (EST)</th>
                  <th className="py-3 px-3 whitespace-nowrap">Side</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Price</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Size</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Notional USD</th>
                  <th className="py-3 pl-3 whitespace-nowrap">Venue &amp; Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-mono-tabular">
                {visibleExecutions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-slate-500 font-sans"
                    >
                      No prints match the current threshold or session filter.
                    </td>
                  </tr>
                ) : (
                  visibleExecutions.map((row) => (
                    <tr
                      key={row.id}
                      className="h-10 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2.5 pr-4 text-slate-700 whitespace-nowrap font-sans">
                        {row.timeEst}
                      </td>
                      <td className="py-2.5 px-3 font-sans whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            row.side === 'buy' ? 'text-[#059669]' : 'text-[#DC2626]'
                          }`}
                        >
                          {row.side === 'buy' ? (
                            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>
                            {row.side === 'buy' ? 'Whale Buy' : 'Whale Sell'}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-800">
                        {formatPrice(row.price, data.symbol, data.type)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {row.size >= 1_000_000
                          ? `${(row.size / 1_000_000).toFixed(2)}M`
                          : row.size >= 1_000
                          ? Math.round(row.size).toLocaleString('en-US')
                          : row.size.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-semibold ${
                          row.side === 'buy' ? 'text-[#059669]' : 'text-[#DC2626]'
                        }`}
                      >
                        {formatUsdCompact(row.notionalUsd)}
                      </td>
                      <td className="py-2.5 pl-3 text-slate-700 font-sans whitespace-nowrap">
                        <strong className="font-semibold text-slate-900">
                          {row.venue}
                        </strong>{' '}
                        <span className="text-slate-400">· {row.context}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredExecutions.length > 5 && (
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllPrints((p) => !p)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-[4px] transition-colors cursor-pointer"
              >
                {showAllPrints ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Show fewer prints</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Show all {filteredExecutions.length} prints</span>
                  </>
                )}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
