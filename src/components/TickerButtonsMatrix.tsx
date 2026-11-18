import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Star, TrendingDown, TrendingUp, X } from 'lucide-react';
import type {
  AssetDefinition,
  AssetType,
  HeikinAshiResponse,
  WatchlistQuote,
} from '../types/market';
import { formatPct, formatPrice } from '../utils/formatters';

interface TickerButtonsMatrixProps {
  quotes: WatchlistQuote[];
  selectedSymbol: string;
  loading: boolean;
  favorites: string[];
  activeChartData: HeikinAshiResponse | null;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onSelectSymbol: (symbol: string) => void;
  onLookupSymbol: (symbol: string) => void;
  onToggleFavorite: (symbol: string) => void;
  onAddTickerToCategory: (asset: AssetDefinition) => Promise<void>;
  onRemoveTicker: (symbol: string) => Promise<void>;
}

const ASSET_TYPE_ORDER: AssetType[] = ['FX', 'Equities', 'Crypto', 'Commodities'];

const PASTEL_TAB_STYLES: Record<
  AssetType,
  { label: string; idle: string; active: string }
> = {
  FX: {
    label: 'FX',
    idle: 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8] hover:bg-[#DBEAFE]',
    active: 'bg-[#DBEAFE] border-[#3B82F6] text-[#1E3A8A] ring-1 ring-[#3B82F6]',
  },
  Equities: {
    label: 'Stocks',
    idle: 'bg-[#F5F3FF] border-[#DDD6FE] text-[#6D28D9] hover:bg-[#EDE9FE]',
    active: 'bg-[#EDE9FE] border-[#8B5CF6] text-[#4C1D95] ring-1 ring-[#8B5CF6]',
  },
  Crypto: {
    label: 'Crypto',
    idle: 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309] hover:bg-[#FEF3C7]',
    active: 'bg-[#FEF3C7] border-[#F59E0B] text-[#78350F] ring-1 ring-[#F59E0B]',
  },
  Commodities: {
    label: 'Commodities',
    idle: 'bg-[#ECFEFF] border-[#A5F3FC] text-[#0E7490] hover:bg-[#CFFAFE]',
    active: 'bg-[#CFFAFE] border-[#06B6D4] text-[#164E63] ring-1 ring-[#06B6D4]',
  },
};

function getCategoryLabel(type: AssetType): string {
  return type === 'Equities' ? 'Stocks' : type;
}

export const TickerButtonsMatrix: React.FC<TickerButtonsMatrixProps> = ({
  quotes,
  selectedSymbol,
  loading,
  favorites,
  activeChartData,
  searchInputRef,
  onSelectSymbol,
  onLookupSymbol,
  onToggleFavorite,
  onAddTickerToCategory,
  onRemoveTicker,
}) => {
  const [typeFilter, setTypeFilter] = useState<'All' | AssetType>('All');
  const [searchInput, setSearchInput] = useState('');
  const [saveCategory, setSaveCategory] = useState<AssetType>('Equities');
  const [savingAdd, setSavingAdd] = useState(false);

  const favoriteSet = useMemo(
    () => new Set(favorites.map((s) => s.toUpperCase())),
    [favorites]
  );

  const inWatchlist = useMemo(() => {
    if (!activeChartData) return true;
    const upper = activeChartData.symbol.toUpperCase();
    return quotes.some((q) => q.symbol.toUpperCase() === upper);
  }, [quotes, activeChartData]);

  // Keep local type in sync when user searches a dynamic symbol
  useEffect(() => {
    if (activeChartData) {
      setSaveCategory(activeChartData.type);
    }
  }, [activeChartData]);

  const filteredQuotes = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    return quotes.filter((q) => {
      if (query) {
        return (
          q.symbol.toLowerCase().includes(query) ||
          q.displaySymbol.toLowerCase().includes(query) ||
          q.name.toLowerCase().includes(query) ||
          q.type.toLowerCase().includes(query)
        );
      }
      if (typeFilter !== 'All' && q.type !== typeFilter) return false;
      return true;
    });
  }, [quotes, typeFilter, searchInput]);

  const groupedQuotes = useMemo(() => {
    const groups: Array<{ type: AssetType; items: WatchlistQuote[] }> = [];
    for (const assetType of ASSET_TYPE_ORDER) {
      const items = filteredQuotes
        .filter((q) => q.type === assetType)
        .sort((a, b) => {
          const aFav = favoriteSet.has(a.symbol.toUpperCase()) ? 0 : 1;
          const bFav = favoriteSet.has(b.symbol.toUpperCase()) ? 0 : 1;
          return aFav - bFav;
        });
      if (items.length > 0) {
        groups.push({ type: assetType, items });
      }
    }
    return groups;
  }, [filteredQuotes, favoriteSet]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = searchInput.trim().toUpperCase();
    if (!cleaned) return;
    onLookupSymbol(cleaned);
  };

  const handleTabClick = (tab: AssetType) => {
    setTypeFilter((prev) => (prev === tab ? 'All' : tab));
  };

  const handleSaveToCategory = async () => {
    if (!activeChartData) return;
    setSavingAdd(true);
    try {
      await onAddTickerToCategory({
        symbol: activeChartData.symbol,
        yahooSymbol: activeChartData.yahooSymbol || activeChartData.symbol,
        displaySymbol: activeChartData.displaySymbol,
        name: activeChartData.name,
        type: saveCategory,
      });
    } finally {
      setSavingAdd(false);
    }
  };

  const shouldShowSaveBar = Boolean(activeChartData && !inWatchlist && !loading);

  return (
    <section
      id="search-matrix"
      className="bg-white border border-slate-200 rounded-[4px] p-5"
    >
      {/* Header with Pastel Asset Type Tabs + Global Search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          {ASSET_TYPE_ORDER.map((tab) => {
            const active = typeFilter === tab;
            const style = PASTEL_TAB_STYLES[tab];
            return (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabClick(tab)}
                aria-pressed={active}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-[4px] border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  active ? style.active : style.idle
                }`}
              >
                {style.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Global search: USDCHF, XAUUSD, USDCAD, NASDAQ, T.TO..."
              aria-label="Search or load custom ticker"
              className="w-full sm:w-64 pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400"
            />
          </div>
          {searchInput.trim() && (
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium bg-[#0F172A] hover:bg-slate-800 text-white rounded-[4px] transition-colors whitespace-nowrap cursor-pointer"
            >
              Load
            </button>
          )}
        </form>
      </div>

      {/* Add searched symbol directly into its matching category */}
      {shouldShowSaveBar && activeChartData && (
        <div className="mt-3 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[4px] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-slate-700">
            <span className="font-bold text-slate-900">
              {activeChartData.displaySymbol}
            </span>{' '}
            ({activeChartData.name}) loaded. Save it to your synced list:
          </div>
          <div className="flex items-center gap-2">
            <select
              value={saveCategory}
              onChange={(e) => setSaveCategory(e.target.value as AssetType)}
              aria-label="Choose list category"
              className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-[4px] text-slate-800 cursor-pointer"
            >
              <option value="FX">FX</option>
              <option value="Equities">Stocks</option>
              <option value="Crypto">Crypto</option>
              <option value="Commodities">Commodities</option>
            </select>
            <button
              type="button"
              disabled={savingAdd}
              onClick={() => void handleSaveToCategory()}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white rounded-[4px] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {savingAdd ? 'Saving...' : `Add to ${getCategoryLabel(saveCategory)}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Clickable Ticker Buttons (4px corners, red if bearish / green if bullish, no HA line) */}
      {loading && quotes.length === 0 ? (
        <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {Array.from({ length: 16 }).map((_, idx) => (
            <div
              key={idx}
              className="h-[58px] rounded-[4px] border border-slate-200 bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      ) : groupedQuotes.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-slate-500">
            No instruments match the current search.
          </p>
          {searchInput.trim() && (
            <button
              type="button"
              onClick={() => onLookupSymbol(searchInput.trim().toUpperCase())}
              className="mt-2 px-4 py-2 text-xs font-medium bg-[#0F172A] hover:bg-slate-800 text-white rounded-[4px] cursor-pointer"
            >
              Fetch {searchInput.trim().toUpperCase()}
            </button>
          )}
        </div>
      ) : (
        <div className="pt-4 space-y-3.5">
          {groupedQuotes.map((group) => (
            <div key={group.type} className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700">
                {getCategoryLabel(group.type)}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {group.items.map((item) => {
                  const bearish = item.change2wPct < 0;
                  const isSelected =
                    selectedSymbol.toUpperCase() === item.symbol.toUpperCase();
                  const isFav = favoriteSet.has(item.symbol.toUpperCase());

                  const colorClasses = bearish
                    ? isSelected
                      ? 'bg-[#FEE2E2] border-[#DC2626] ring-1 ring-[#DC2626]'
                      : 'bg-[#FEF2F2] border-[#FECACA] hover:bg-[#FEE2E2]/80 hover:border-[#F87171]'
                    : isSelected
                    ? 'bg-[#D1FAE5] border-[#059669] ring-1 ring-[#059669]'
                    : 'bg-[#ECFDF5] border-[#A7F3D0] hover:bg-[#D1FAE5]/70 hover:border-[#34D399]';

                  const trendTextClass = bearish ? 'text-[#DC2626]' : 'text-[#059669]';

                  return (
                    <div
                      key={item.symbol}
                      className={`group relative rounded-[4px] border transition-colors duration-150 ${colorClasses}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectSymbol(item.symbol)}
                        aria-pressed={isSelected}
                        title={item.name}
                        className="w-full text-left px-3 py-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-[4px]"
                      >
                        <div className="flex items-center justify-between gap-1 pr-3">
                          <span className="text-xs font-bold tracking-tight text-slate-900 truncate">
                            {item.displaySymbol}
                          </span>
                          <span
                            className={`inline-flex items-center gap-0.5 text-[11px] font-semibold whitespace-nowrap shrink-0 ${trendTextClass}`}
                          >
                            {bearish ? (
                              <TrendingDown className="w-3 h-3" aria-hidden="true" />
                            ) : (
                              <TrendingUp className="w-3 h-3" aria-hidden="true" />
                            )}
                            <span>{bearish ? 'Bear' : 'Bull'}</span>
                          </span>
                        </div>

                        <div className="mt-1 flex items-baseline justify-between gap-1">
                          <span className="font-mono-tabular text-xs font-semibold text-slate-900">
                            {formatPrice(item.price, item.symbol, item.type)}
                          </span>
                          <span
                            className={`font-mono-tabular text-[11px] font-semibold ${trendTextClass}`}
                          >
                            {formatPct(item.change2wPct)}
                          </span>
                        </div>
                      </button>

                      {/* Star Favorite & Remove actions */}
                      <div className="absolute top-1 right-1 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(item.symbol);
                          }}
                          aria-label={
                            isFav
                              ? `Unstar ${item.displaySymbol}`
                              : `Star ${item.displaySymbol}`
                          }
                          className={`p-0.5 rounded-[4px] cursor-pointer transition-opacity ${
                            isFav
                              ? 'opacity-100 text-amber-500'
                              : 'opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-amber-500'
                          }`}
                        >
                          <Star
                            className={`w-3 h-3 ${isFav ? 'fill-amber-400' : ''}`}
                          />
                        </button>
                        {quotes.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onRemoveTicker(item.symbol);
                            }}
                            aria-label={`Remove ${item.displaySymbol} from list`}
                            className="p-0.5 rounded-[4px] opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-[#DC2626] cursor-pointer transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
