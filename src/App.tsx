import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  LogOut,
  MessageSquareText,
  Radar,
  Search,
  Users,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { CommentaryAndTape } from './components/CommentaryAndTape';
import { CrossAssetWhaleRadar } from './components/CrossAssetWhaleRadar';
import { ManageAccessModal } from './components/ManageAccessModal';
import { SentimentAndHeikinAshiCard } from './components/SentimentAndHeikinAshiCard';
import { TickerButtonsMatrix } from './components/TickerButtonsMatrix';
import { useSignalGapAuth } from './hooks/useSignalGapAuth';
import type {
  AssetDefinition,
  CandleInterval,
  HeikinAshiResponse,
  NewsCommentaryItem,
  SessionFilter,
  WatchlistQuote,
} from './types/market';

type MobileNavTab = 'search' | 'commentary' | 'tape' | 'radar';

async function parseApiJson<T>(res: Response, endpoint: string): Promise<T> {
  const raw = await res.text();
  if (!raw || !raw.trim()) {
    throw new Error(
      `Market API (${endpoint}) returned an empty response (HTTP ${res.status}). On Cloudflare Pages, ensure /functions is deployed via Git or "npx wrangler pages deploy dist" (not static-only Direct Upload).`
    );
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith('<')) {
    throw new Error(
      `Market API (${endpoint}) returned HTML instead of JSON (HTTP ${res.status}). On Cloudflare Pages, ensure /functions is deployed via Git or "npx wrangler pages deploy dist".`
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`Invalid JSON from ${endpoint} (HTTP ${res.status}).`);
  }
}

export default function App() {
  const {
    status,
    user,
    role,
    authError,
    watchlistReady,
    customAssets,
    removedSymbols,
    favorites,
    allowedEmails,
    signInWithGoogle,
    signOutUser,
    addTickerToList,
    removeTickerFromList,
    toggleFavorite,
    addAllowedEmail,
    updateAllowedEmailRole,
    removeAllowedEmail,
  } = useSignalGapAuth();

  const [quotes, setQuotes] = useState<WatchlistQuote[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState('USDCHF=X');
  const [interval, setInterval] = useState<CandleInterval>('4h');
  const [minWhaleThreshold, setMinWhaleThreshold] = useState(100_000);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('london_ny');

  const [chartData, setChartData] = useState<HeikinAshiResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  const [newsItems, setNewsItems] = useState<NewsCommentaryItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  const [manageAccessOpen, setManageAccessOpen] = useState(false);
  const [mobileNavTab, setMobileNavTab] = useState<MobileNavTab>('search');

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const fetchWatchlist = useCallback(
    async (assets: AssetDefinition[], removed: string[]) => {
      setWatchlistLoading(true);
      setWatchlistError(null);
      try {
        const useGetBaseline = assets.length === 0 && removed.length === 0;
        let res = useGetBaseline
          ? await fetch('/api/market/watchlist?interval=4h')
          : await fetch('/api/market/watchlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                interval: '4h',
                customAssets: assets,
                removedSymbols: removed,
              }),
            });

        if (!useGetBaseline && res.status === 405) {
          const qs = new URLSearchParams({ interval: '4h' });
          if (assets.length > 0) qs.set('custom', JSON.stringify(assets));
          if (removed.length > 0) qs.set('removed', removed.join(','));
          res = await fetch(`/api/market/watchlist?${qs.toString()}`);
        }

        const json = await parseApiJson<{
          quotes?: WatchlistQuote[];
          error?: string;
        }>(res, '/api/market/watchlist');

        if (!res.ok || !json.quotes) {
          throw new Error(json.error || 'Failed to load cross-asset watchlist');
        }
        setQuotes(json.quotes);
      } catch (err) {
        setWatchlistError(
          err instanceof Error ? err.message : 'Watchlist unavailable'
        );
      } finally {
        setWatchlistLoading(false);
      }
    },
    []
  );

  const fetchChartAndNews = useCallback(
    async (symbol: string, targetInterval: CandleInterval) => {
      setChartLoading(true);
      setChartError(null);
      setNewsLoading(true);

      const chartPromise = fetch(
        `/api/market/heikin-ashi?symbol=${encodeURIComponent(
          symbol
        )}&interval=${encodeURIComponent(targetInterval)}`
      ).then(async (res) => {
        const json = await parseApiJson<HeikinAshiResponse & { error?: string }>(
          res,
          '/api/market/heikin-ashi'
        );
        if (!res.ok || json.error) {
          throw new Error(json.error || `Unable to load ${symbol}`);
        }
        return json;
      });

      const newsPromise = fetch(
        `/api/market/news?symbol=${encodeURIComponent(symbol)}`
      )
        .then(async (res) => {
          const json = await parseApiJson<{ items?: NewsCommentaryItem[] }>(
            res,
            '/api/market/news'
          );
          return json.items || [];
        })
        .catch(() => [] as NewsCommentaryItem[]);

      try {
        const [chartJson, newsList] = await Promise.all([chartPromise, newsPromise]);
        setChartData(chartJson);
        setNewsItems(newsList);
      } catch (err) {
        setChartError(
          err instanceof Error
            ? err.message
            : 'Unable to load 2-week Heikin-Ashi data'
        );
      } finally {
        setChartLoading(false);
        setNewsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (status !== 'authorized' || !watchlistReady) return;
    void fetchWatchlist(customAssets, removedSymbols);
  }, [status, watchlistReady, customAssets, removedSymbols, fetchWatchlist]);

  useEffect(() => {
    if (status !== 'authorized') return;
    void fetchChartAndNews(selectedSymbol, interval);
  }, [status, selectedSymbol, interval, fetchChartAndNews]);

  if (status !== 'authorized') {
    return (
      <AuthGate
        status={status}
        userEmail={user?.email}
        authError={authError}
        onSignIn={() => void signInWithGoogle()}
        onSignOut={() => void signOutUser()}
      />
    );
  }

  const handleRefreshLive = () => {
    void fetchWatchlist(customAssets, removedSymbols);
    void fetchChartAndNews(selectedSymbol, interval);
  };

  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  const handleSearchNavClick = () => {
    setMobileNavTab('search');
    const el = document.getElementById('search-matrix');
    el?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => searchInputRef.current?.focus(), 200);
  };

  const handleMobileSectionJump = (tab: MobileNavTab, elementId: string) => {
    setMobileNavTab(tab);
    document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRemoveTicker = async (symbol: string) => {
    await removeTickerFromList(symbol);
    if (selectedSymbol.toUpperCase() === symbol.toUpperCase()) {
      const fallback = quotes.find(
        (q) => q.symbol.toUpperCase() !== symbol.toUpperCase()
      );
      if (fallback) {
        setSelectedSymbol(fallback.symbol);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col pb-16 md:pb-0">
      {/* Top Bar matching SignalGap Screenshot */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <a
              href="#heikin-ashi-chart"
              className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            >
              SignalGap
            </a>

            {/* Desktop Primary Navigation */}
            <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600">
              <button
                type="button"
                onClick={handleSearchNavClick}
                className="hover:text-slate-900 underline underline-offset-4 decoration-slate-900 text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Search
              </button>
              <a
                href="#commentary"
                className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Commentary
              </a>
              <a
                href="#whale-tape"
                className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Whale Tape
              </a>
              <span className="h-4 w-px bg-slate-200 shrink-0" aria-hidden="true" />
              <a
                href="#whale-radar"
                className="inline-flex items-center gap-1.5 hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                <Radar className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>Whale Radar</span>
              </a>
            </nav>
          </div>

          {/* Account Controls + Admin Manage Access */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-xs font-medium text-slate-500 truncate max-w-[170px]">
              {user?.email}
            </span>
            {role === 'admin' && (
              <button
                type="button"
                onClick={() => setManageAccessOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE] rounded-[4px] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Manage Access</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void signOutUser()}
              aria-label="Sign Out"
              title="Sign Out"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded-[4px] transition-colors whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {watchlistError && (
          <div className="px-4 py-3 text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-[4px] flex items-center justify-between gap-3">
            <span>{watchlistError}</span>
            <button
              type="button"
              onClick={() => void fetchWatchlist(customAssets, removedSymbols)}
              className="px-3 py-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-[4px] cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        <TickerButtonsMatrix
          quotes={quotes}
          selectedSymbol={selectedSymbol}
          loading={watchlistLoading || !watchlistReady}
          favorites={favorites}
          activeChartData={chartData}
          searchInputRef={searchInputRef}
          onSelectSymbol={handleSelectSymbol}
          onLookupSymbol={handleSelectSymbol}
          onToggleFavorite={(sym) => void toggleFavorite(sym)}
          onAddTickerToCategory={addTickerToList}
          onRemoveTicker={handleRemoveTicker}
        />

        <SentimentAndHeikinAshiCard
          data={chartData}
          loading={chartLoading}
          error={chartError}
          interval={interval}
          minWhaleThreshold={minWhaleThreshold}
          sessionFilter={sessionFilter}
          onIntervalChange={setInterval}
          onMinWhaleThresholdChange={setMinWhaleThreshold}
          onSessionFilterChange={setSessionFilter}
          onRefresh={handleRefreshLive}
        />

        <CommentaryAndTape
          data={chartData}
          newsItems={newsItems}
          newsLoading={newsLoading}
          minWhaleThreshold={minWhaleThreshold}
          sessionFilter={sessionFilter}
        />

        <CrossAssetWhaleRadar
          quotes={quotes}
          selectedSymbol={selectedSymbol}
          minWhaleThreshold={minWhaleThreshold}
          favorites={favorites}
          onToggleFavorite={(sym) => void toggleFavorite(sym)}
          onMinWhaleThresholdChange={setMinWhaleThreshold}
          onSelectSymbol={(sym) => {
            setSelectedSymbol(sym);
            document
              .getElementById('heikin-ashi-chart')
              ?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white mt-6">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-800">
            SignalGap · Cross-Asset Whale &amp; Sentiment Intelligence
          </span>
          <span>
            Live feeds via Yahoo Finance, CME FX Futures, Coinbase, Kraken &amp; TSX
          </span>
        </div>
      </footer>

      {/* Mobile Fixed 4-Button Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-white border-t border-slate-200 grid grid-cols-4"
      >
        <button
          type="button"
          onClick={handleSearchNavClick}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[11px] font-semibold transition-colors cursor-pointer ${
            mobileNavTab === 'search'
              ? 'text-[#0F172A] bg-slate-100/80'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Search className="w-4 h-4" aria-hidden="true" />
          <span>Search</span>
        </button>

        <button
          type="button"
          onClick={() => handleMobileSectionJump('commentary', 'commentary')}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[11px] font-semibold transition-colors cursor-pointer ${
            mobileNavTab === 'commentary'
              ? 'text-[#0F172A] bg-slate-100/80'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <MessageSquareText className="w-4 h-4" aria-hidden="true" />
          <span>Commentary</span>
        </button>

        <button
          type="button"
          onClick={() => handleMobileSectionJump('tape', 'whale-tape')}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[11px] font-semibold transition-colors cursor-pointer ${
            mobileNavTab === 'tape'
              ? 'text-[#0F172A] bg-slate-100/80'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" aria-hidden="true" />
          <span>Whale Tape</span>
        </button>

        <button
          type="button"
          onClick={() => handleMobileSectionJump('radar', 'whale-radar')}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[11px] font-semibold transition-colors cursor-pointer ${
            mobileNavTab === 'radar'
              ? 'text-[#0F172A] bg-slate-100/80'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Radar className="w-4 h-4" aria-hidden="true" />
          <span>Whale Radar</span>
        </button>
      </nav>

      {role === 'admin' && (
        <ManageAccessModal
          open={manageAccessOpen}
          allowedEmails={allowedEmails}
          onClose={() => setManageAccessOpen(false)}
          onAddEmail={addAllowedEmail}
          onUpdateRole={updateAllowedEmailRole}
          onRemoveEmail={removeAllowedEmail}
        />
      )}
    </div>
  );
}
