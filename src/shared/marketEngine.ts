import type {
  AssetDefinition,
  AssetType,
  CandleInterval,
  HeikinAshiCandle,
  HeikinAshiResponse,
  NewsCommentaryItem,
  WatchlistQuote,
  WhaleExecution,
} from '../types/market.ts';

const TWO_WEEKS_SECONDS = 14 * 24 * 60 * 60;
const CACHE_TTL_MS = 60_000;

export const BASELINE_ASSET_UNIVERSE: AssetDefinition[] = [
  // FX (Default: USD/CHF, includes XAU/USD and USD/CAD, USDJPY removed)
  { symbol: 'USDCHF=X', yahooSymbol: 'USDCHF=X', displaySymbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', type: 'FX' },
  { symbol: 'XAUUSD', yahooSymbol: 'GC=F', displaySymbol: 'XAU/USD', name: 'Gold Spot / US Dollar', type: 'FX' },
  { symbol: 'USDCAD=X', yahooSymbol: 'USDCAD=X', displaySymbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', type: 'FX' },
  { symbol: 'EURUSD=X', yahooSymbol: 'EURUSD=X', displaySymbol: 'EUR/USD', name: 'Euro / US Dollar', type: 'FX' },
  { symbol: 'GBPUSD=X', yahooSymbol: 'GBPUSD=X', displaySymbol: 'GBP/USD', name: 'British Pound / US Dollar', type: 'FX' },
  { symbol: 'AUDUSD=X', yahooSymbol: 'AUDUSD=X', displaySymbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', type: 'FX' },

  // Equities / Stocks (NASDAQ & S&P 500 first, then individual stocks)
  { symbol: '^IXIC', yahooSymbol: '^IXIC', displaySymbol: 'NASDAQ', name: 'NASDAQ Composite', type: 'Equities' },
  { symbol: '^GSPC', yahooSymbol: '^GSPC', displaySymbol: 'S&P 500', name: 'S&P 500 Index', type: 'Equities' },
  { symbol: 'NVDA', yahooSymbol: 'NVDA', displaySymbol: 'NVDA', name: 'NVIDIA Corp.', type: 'Equities' },
  { symbol: 'AAPL', yahooSymbol: 'AAPL', displaySymbol: 'AAPL', name: 'Apple Inc.', type: 'Equities' },
  { symbol: 'MSFT', yahooSymbol: 'MSFT', displaySymbol: 'MSFT', name: 'Microsoft Corp.', type: 'Equities' },
  { symbol: 'TSLA', yahooSymbol: 'TSLA', displaySymbol: 'TSLA', name: 'Tesla Inc.', type: 'Equities' },
  { symbol: 'AMZN', yahooSymbol: 'AMZN', displaySymbol: 'AMZN', name: 'Amazon.com', type: 'Equities' },
  { symbol: 'META', yahooSymbol: 'META', displaySymbol: 'META', name: 'Meta Platforms', type: 'Equities' },
  { symbol: 'GOOGL', yahooSymbol: 'GOOGL', displaySymbol: 'GOOGL', name: 'Alphabet Inc.', type: 'Equities' },
  { symbol: 'T.TO', yahooSymbol: 'T.TO', displaySymbol: 'T.TO', name: 'TELUS Corp. (Toronto)', type: 'Equities' },

  // Crypto
  { symbol: 'BTC-USD', yahooSymbol: 'BTC-USD', displaySymbol: 'BTC-USD', name: 'Bitcoin', type: 'Crypto' },
  { symbol: 'ETH-USD', yahooSymbol: 'ETH-USD', displaySymbol: 'ETH-USD', name: 'Ethereum', type: 'Crypto' },
  { symbol: 'SOL-USD', yahooSymbol: 'SOL-USD', displaySymbol: 'SOL-USD', name: 'Solana', type: 'Crypto' },
  { symbol: 'XRP-USD', yahooSymbol: 'XRP-USD', displaySymbol: 'XRP-USD', name: 'Ripple', type: 'Crypto' },

  // Commodities
  { symbol: 'SI=F', yahooSymbol: 'SI=F', displaySymbol: 'SILVER', name: 'Silver Futures', type: 'Commodities' },
  { symbol: 'CL=F', yahooSymbol: 'CL=F', displaySymbol: 'WTI', name: 'Crude Oil WTI', type: 'Commodities' },
  { symbol: 'NG=F', yahooSymbol: 'NG=F', displaySymbol: 'NATGAS', name: 'Natural Gas', type: 'Commodities' },
];

interface RawBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface YahooChartPayload {
  bars: RawBar[];
  meta: {
    symbol: string;
    shortName?: string;
    longName?: string;
    exchangeName?: string;
    fullExchangeName?: string;
    currency?: string;
    regularMarketPrice?: number;
    instrumentType?: string;
  };
}

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const chartCache = new Map<string, CacheEntry<HeikinAshiResponse>>();
const newsCache = new Map<string, CacheEntry<NewsCommentaryItem[]>>();
let defaultWatchlistCache: CacheEntry<WatchlistQuote[]> | null = null;

function getEstHour(timestampSec: number): number {
  const estStr = new Date(timestampSec * 1000).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    hour12: false,
  });
  return Number.parseInt(estStr, 10) || 0;
}

function formatBarDateLabel(timestampSec: number): string {
  const date = new Date(timestampSec * 1000);
  return (
    date.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
    }) +
    ', ' +
    date.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) +
    ' EST'
  );
}

function formatFullDate(timestampSec: number): string {
  return formatBarDateLabel(timestampSec);
}

function formatTimeEstFull(timestampSec: number): string {
  const date = new Date(timestampSec * 1000);
  return (
    date.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
    }) +
    ', ' +
    date.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }) +
    ' EST'
  );
}

export function inferAssetMeta(
  symbol: string,
  instrumentType?: string,
  shortName?: string,
  overrideMeta?: Partial<AssetDefinition>
): AssetDefinition {
  const upper = symbol.trim().toUpperCase();
  if (overrideMeta && overrideMeta.symbol && overrideMeta.type) {
    return {
      symbol: overrideMeta.symbol.trim().toUpperCase(),
      yahooSymbol: (overrideMeta.yahooSymbol || overrideMeta.symbol).trim().toUpperCase(),
      displaySymbol: (overrideMeta.displaySymbol || overrideMeta.symbol).trim().toUpperCase(),
      name: (overrideMeta.name || shortName || overrideMeta.symbol).trim().slice(0, 80),
      type: overrideMeta.type,
    };
  }

  const found = BASELINE_ASSET_UNIVERSE.find(
    (item) =>
      item.symbol.toUpperCase() === upper ||
      item.displaySymbol.toUpperCase() === upper ||
      item.yahooSymbol.toUpperCase() === upper
  );
  if (found) {
    return found;
  }

  // Normalize common FX shorthand like EURJPY or EUR/CAD
  let normalizedYahoo = upper;
  let displaySym = upper.replace('=X', '').replace('=F', '');
  let inferredType: AssetType = 'Equities';

  if (upper === 'XAU/USD' || upper === 'XAUUSD') {
    normalizedYahoo = 'GC=F';
    displaySym = 'XAU/USD';
    inferredType = 'FX';
  } else if (instrumentType === 'CRYPTOCURRENCY' || upper.endsWith('-USD')) {
    inferredType = 'Crypto';
  } else if (
    instrumentType === 'CURRENCY' ||
    upper.endsWith('=X') ||
    upper.includes('XAU') ||
    /^[A-Z]{3}\/[A-Z]{3}$/.test(upper) ||
    /^(EUR|USD|GBP|CHF|CAD|AUD|NZD|JPY){2}$/.test(upper)
  ) {
    inferredType = 'FX';
    const cleanPair = upper.replace('/', '').replace('=X', '');
    if (cleanPair.length === 6) {
      normalizedYahoo = `${cleanPair}=X`;
      displaySym = `${cleanPair.slice(0, 3)}/${cleanPair.slice(3)}`;
    }
  } else if (
    instrumentType === 'FUTURE' ||
    upper.endsWith('=F') ||
    upper.includes('XAG')
  ) {
    inferredType = 'Commodities';
  }

  return {
    symbol: normalizedYahoo === 'GC=F' ? 'XAUUSD' : normalizedYahoo,
    yahooSymbol: normalizedYahoo,
    displaySymbol: displaySym,
    name: (shortName || displaySym).slice(0, 80),
    type: inferredType,
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchYahooRawBars(
  yahooSymbol: string,
  yahooInterval: '1h' | '1d',
  yahooRange: '1mo' | '2mo'
): Promise<YahooChartPayload> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?range=${yahooRange}&interval=${yahooInterval}&includePrePost=false`;

  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SignalGapTerminal/1.0)',
        Accept: 'application/json',
      },
    },
    8000
  );

  if (!response.ok) {
    throw new Error(
      `Upstream market feed returned HTTP ${response.status} for ${yahooSymbol}`
    );
  }

  const json = (await response.json()) as {
    chart?: {
      result?: Array<{
        meta?: YahooChartPayload['meta'];
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            close?: Array<number | null>;
            volume?: Array<number | null>;
          }>;
        };
      }>;
      error?: { description?: string };
    };
  };

  const result = json.chart?.result?.[0];
  if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
    throw new Error(
      json.chart?.error?.description || `No chart data returned for ${yahooSymbol}`
    );
  }

  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const bars: RawBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    if (
      o == null ||
      h == null ||
      l == null ||
      c == null ||
      !Number.isFinite(o) ||
      !Number.isFinite(h) ||
      !Number.isFinite(l) ||
      !Number.isFinite(c)
    ) {
      continue;
    }
    bars.push({
      timestamp: timestamps[i],
      open: o,
      high: h,
      low: l,
      close: c,
      volume:
        Number.isFinite(volumes[i]) && volumes[i] != null ? Number(volumes[i]) : 0,
    });
  }

  if (bars.length === 0) {
    throw new Error(`No valid OHLC bars available for ${yahooSymbol}`);
  }

  return {
    bars,
    meta: result.meta || { symbol: yahooSymbol },
  };
}

function aggregateBarsTo4h(bars: RawBar[]): RawBar[] {
  const buckets = new Map<number, RawBar>();
  const FOUR_HOURS = 4 * 60 * 60;

  for (const bar of bars) {
    const bucketKey = Math.floor(bar.timestamp / FOUR_HOURS) * FOUR_HOURS;
    const existing = buckets.get(bucketKey);
    if (!existing) {
      buckets.set(bucketKey, {
        timestamp: bar.timestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      });
    } else {
      existing.high = Math.max(existing.high, bar.high);
      existing.low = Math.min(existing.low, bar.low);
      existing.close = bar.close;
      existing.volume += bar.volume;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function computeRsi14(bars: RawBar[]): number {
  if (bars.length < 3) return 50;
  const period = Math.min(14, bars.length - 1);
  let gains = 0;
  let losses = 0;

  for (let i = bars.length - period; i < bars.length; i++) {
    const delta = bars[i].close - bars[i - 1].close;
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return avgGain > 0 ? 100 : 50;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getVenueLabel(type: AssetType, exchange: string): string {
  if (type === 'FX') return 'CME FX / Spot Pool';
  if (type === 'Crypto') return 'Coinbase / Kraken Block';
  if (type === 'Commodities') return 'COMEX / NYMEX Futures';
  if (exchange.toLowerCase().includes('toronto') || exchange.toLowerCase().includes('tsx')) {
    return 'TSX Institutional Tape';
  }
  return `${exchange || 'Lit'} Block Tape`;
}

function buildWhaleExecutions(
  candles: HeikinAshiCandle[],
  assetMeta: AssetDefinition,
  exchange: string
): WhaleExecution[] {
  if (candles.length === 0) return [];

  const nonZeroVols = candles.map((c) => c.volume).filter((v) => v > 0);
  const avgVol =
    nonZeroVols.length > 0
      ? nonZeroVols.reduce((s, v) => s + v, 0) / nonZeroVols.length
      : 0;

  const ranges = candles.map((c) => Math.max(c.high - c.low, 1e-8));
  const avgRange = ranges.reduce((s, r) => s + r, 0) / ranges.length;

  const executions: WhaleExecution[] = [];
  const venue = getVenueLabel(assetMeta.type, exchange);

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const barRange = Math.max(c.high - c.low, 1e-8);
    const rangeRatio = barRange / Math.max(avgRange, 1e-8);
    const volRatio = avgVol > 0 && c.volume > 0 ? c.volume / avgVol : rangeRatio;

    const activityMultiple =
      avgVol > 0 && c.volume > 0
        ? volRatio * 0.7 + rangeRatio * 0.3
        : rangeRatio;

    if (activityMultiple >= 1.15 || c.isStrongTrend) {
      let notionalUsd = 0;
      let size = 0;

      if (c.volume > 0 && c.close > 0) {
        const blockShare = clamp(0.03 + (activityMultiple - 1) * 0.04, 0.02, 0.16);
        const rawNotional = c.volume * c.close * blockShare;
        notionalUsd = clamp(rawNotional, 65_000, 85_000_000);
        size = notionalUsd / c.close;
      } else {
        notionalUsd = clamp(420_000 * activityMultiple, 85_000, 12_500_000);
        size = notionalUsd / Math.max(c.close, 0.0001);
      }

      const side: 'buy' | 'sell' = c.close >= c.open ? 'buy' : 'sell';

      executions.push({
        id: `${assetMeta.symbol}-${c.timestamp}`,
        timestamp: c.timestamp,
        timeEst: formatTimeEstFull(c.timestamp),
        side,
        price: c.close,
        size,
        notionalUsd,
        volumeMultiple: Number(activityMultiple.toFixed(2)),
        venue,
        context: `${activityMultiple.toFixed(2)}× 20-bar ${
          assetMeta.type === 'FX' ? 'spot FX impulse' : 'flow surge'
        }`,
        hourEst: c.hourEst,
      });
    }
  }

  return executions.sort((a, b) => b.timestamp - a.timestamp);
}

function computeTwoWeekHeikinAshi(
  rawBars: RawBar[]
): {
  candles: HeikinAshiCandle[];
  rsi14: number;
  ema20SpreadPct: number;
  relativeVolume: number;
} {
  if (rawBars.length === 0) {
    return { candles: [], rsi14: 50, ema20SpreadPct: 0, relativeVolume: 1 };
  }

  const latestTs = rawBars[rawBars.length - 1].timestamp;
  const twoWeekCutoff = latestTs - TWO_WEEKS_SECONDS;

  const emaK = 2 / (20 + 1);
  let runningEma20 = rawBars[0].close;

  let cumPv = 0;
  let cumVol = 0;
  let cumTp = 0;
  let twoWeekCount = 0;

  const allHa: HeikinAshiCandle[] = [];

  for (let i = 0; i < rawBars.length; i++) {
    const bar = rawBars[i];
    const haClose = (bar.open + bar.high + bar.low + bar.close) / 4;
    const haOpen =
      i === 0
        ? (bar.open + bar.close) / 2
        : (allHa[i - 1].haOpen + allHa[i - 1].haClose) / 2;
    const haHigh = Math.max(bar.high, haOpen, haClose);
    const haLow = Math.min(bar.low, haOpen, haClose);
    const isBullish = haClose >= haOpen;

    runningEma20 = i === 0 ? bar.close : bar.close * emaK + runningEma20 * (1 - emaK);

    let vwapVal = runningEma20;
    if (bar.timestamp >= twoWeekCutoff) {
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;
      twoWeekCount += 1;
      cumTp += typicalPrice;
      if (bar.volume > 0) {
        cumPv += typicalPrice * bar.volume;
        cumVol += bar.volume;
      }
      vwapVal = cumVol > 0 ? cumPv / cumVol : cumTp / twoWeekCount;
    }

    const windowStart = Math.max(0, i - 14);
    let winLow = Infinity;
    let winHigh = -Infinity;
    for (let j = windowStart; j <= i; j++) {
      winLow = Math.min(winLow, rawBars[j].low);
      winHigh = Math.max(winHigh, rawBars[j].high);
    }
    const rangePos =
      winHigh > winLow ? ((bar.close - winLow) / (winHigh - winLow)) * 100 : 50;
    const emaDiffPct =
      runningEma20 !== 0 ? ((bar.close - runningEma20) / runningEma20) * 100 : 0;
    const rawConsensus = clamp(
      Math.round(50 + (rangePos - 50) * 0.55 + emaDiffPct * 4.5),
      8,
      96
    );

    const haBodyPct =
      haOpen !== 0 ? ((haClose - haOpen) / haOpen) * 100 : 0;
    const prevSocial = i > 0 ? allHa[i - 1].socialMomentum : 50;
    const targetSocial = clamp(
      50 + (isBullish ? 14 : -14) + haBodyPct * 18,
      10,
      94
    );
    const socialMomentum = Math.round(prevSocial * 0.65 + targetSocial * 0.35);

    const eps = Math.max(Math.abs(haClose) * 0.0004, 1e-6);
    const isStrongTrend = isBullish
      ? Math.abs(haLow - haOpen) <= eps
      : Math.abs(haHigh - haOpen) <= eps;

    allHa.push({
      timestamp: bar.timestamp,
      dateLabel: formatBarDateLabel(bar.timestamp),
      fullDate: formatFullDate(bar.timestamp),
      hourEst: getEstHour(bar.timestamp),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      haOpen,
      haHigh,
      haLow,
      haClose,
      ema20: runningEma20,
      vwap: vwapVal,
      socialMomentum,
      marketConsensus: rawConsensus,
      isBullish,
      isStrongTrend,
    });
  }

  const twoWeekBars = allHa.filter((c) => c.timestamp >= twoWeekCutoff);
  const candles = twoWeekBars.length >= 2 ? twoWeekBars : allHa.slice(-14);

  const latestBar = candles[candles.length - 1];
  const ema20SpreadPct =
    latestBar.ema20 !== 0
      ? ((latestBar.close - latestBar.ema20) / latestBar.ema20) * 100
      : 0;

  const volSamples = candles
    .slice(-20)
    .map((c) => c.volume)
    .filter((v) => v > 0);
  const avgVol =
    volSamples.length > 0
      ? volSamples.reduce((sum, v) => sum + v, 0) / volSamples.length
      : 0;
  const relativeVolume =
    avgVol > 0 && latestBar.volume > 0 ? latestBar.volume / avgVol : 1;

  return {
    candles,
    rsi14: computeRsi14(rawBars),
    ema20SpreadPct,
    relativeVolume,
  };
}

export async function getHeikinAshiSeries(
  symbol: string,
  interval: CandleInterval,
  overrideMeta?: Partial<AssetDefinition>
): Promise<HeikinAshiResponse> {
  const assetMeta = inferAssetMeta(symbol, undefined, undefined, overrideMeta);
  const cacheKey = `${assetMeta.symbol}:${assetMeta.type}:${interval}`;
  const cached = chartCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const payload = await fetchYahooRawBars(assetMeta.yahooSymbol, '1h', '1mo');
  const preparedBars =
    interval === '4h' ? aggregateBarsTo4h(payload.bars) : payload.bars;

  const { candles, rsi14, ema20SpreadPct, relativeVolume } =
    computeTwoWeekHeikinAshi(preparedBars);

  const first = candles[0];
  const last = candles[candles.length - 1];

  const currentPrice = payload.meta.regularMarketPrice ?? last.close;
  const baselineOpen = first.open;
  const change2wAbs = currentPrice - baselineOpen;
  const change2wPct = baselineOpen !== 0 ? (change2wAbs / baselineOpen) * 100 : 0;

  let high2w = -Infinity;
  let low2w = Infinity;
  let bullishBars = 0;
  let bearishBars = 0;

  for (const c of candles) {
    if (c.high > high2w) high2w = c.high;
    if (c.low < low2w) low2w = c.low;
    if (c.isBullish) bullishBars += 1;
    else bearishBars += 1;
  }

  const latestHaBullish = last.isBullish;
  let haStreak = 0;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].isBullish === latestHaBullish) {
      haStreak += 1;
    } else {
      break;
    }
  }

  const resolvedMeta = overrideMeta?.type
    ? assetMeta
    : inferAssetMeta(
        assetMeta.symbol,
        payload.meta.instrumentType,
        payload.meta.shortName || payload.meta.longName
      );
  const exchange =
    payload.meta.fullExchangeName || payload.meta.exchangeName || 'Global';

  const whaleExecutions = buildWhaleExecutions(candles, resolvedMeta, exchange);

  const socialNow = last.socialMomentum;
  const consensusNow = last.marketConsensus;
  const sentimentGap = socialNow - consensusNow;

  const bullBarShare =
    candles.length > 0 ? (bullishBars / candles.length) * 100 : 50;
  const ratingScore = clamp(
    Math.round(
      bullBarShare * 0.35 +
        rsi14 * 0.25 +
        consensusNow * 0.25 +
        (latestHaBullish ? 12 : 3)
    ),
    12,
    96
  );

  const confidence: 'High' | 'Medium' | 'Low' =
    haStreak >= 3 && Math.abs(ema20SpreadPct) >= 0.2
      ? 'High'
      : haStreak >= 2
      ? 'Medium'
      : 'Low';

  const stance: 'BUY BIAS' | 'SELL BIAS' | 'NEUTRAL' =
    ratingScore >= 58 && latestHaBullish
      ? 'BUY BIAS'
      : ratingScore <= 44 && !latestHaBullish
      ? 'SELL BIAS'
      : latestHaBullish && change2wPct > 0
      ? 'BUY BIAS'
      : !latestHaBullish && change2wPct < 0
      ? 'SELL BIAS'
      : 'NEUTRAL';

  const response: HeikinAshiResponse = {
    symbol: resolvedMeta.symbol,
    yahooSymbol: resolvedMeta.yahooSymbol,
    displaySymbol: resolvedMeta.displaySymbol,
    name: resolvedMeta.name,
    type: resolvedMeta.type,
    exchange,
    currency: payload.meta.currency || 'USD',
    interval,
    windowDays: 14,
    currentPrice,
    change2wAbs,
    change2wPct,
    high2w,
    low2w,
    bullishBars,
    bearishBars,
    latestHaBullish,
    haStreak,
    rsi14,
    ema20SpreadPct,
    relativeVolume,
    socialNow,
    consensusNow,
    sentimentGap,
    ratingScore,
    confidence,
    stance,
    candles,
    whaleExecutions,
    updatedAt: Date.now(),
  };

  chartCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data: response,
  });

  return response;
}

export async function getWatchlistQuotes(
  interval: CandleInterval = '4h',
  options?: {
    customAssets?: AssetDefinition[];
    removedSymbols?: string[];
  }
): Promise<WatchlistQuote[]> {
  const customAssets = options?.customAssets || [];
  const removedSymbols = new Set(
    (options?.removedSymbols || []).map((s) => s.trim().toUpperCase())
  );

  const isDefaultRequest =
    interval === '4h' && customAssets.length === 0 && removedSymbols.size === 0;

  if (isDefaultRequest && defaultWatchlistCache && defaultWatchlistCache.expiresAt > Date.now()) {
    return defaultWatchlistCache.data;
  }

  // Merge baseline universe (minus removed) with custom user assets
  const customSymbolSet = new Set(
    customAssets.map((a) => a.symbol.trim().toUpperCase())
  );

  const activeAssets: Array<AssetDefinition & { isCustom?: boolean }> = [];
  for (const base of BASELINE_ASSET_UNIVERSE) {
    const upper = base.symbol.toUpperCase();
    if (removedSymbols.has(upper)) continue;
    const override = customAssets.find((c) => c.symbol.toUpperCase() === upper);
    if (override) {
      activeAssets.push({ ...override, isCustom: true });
    } else {
      activeAssets.push({ ...base, isCustom: false });
    }
  }

  for (const custom of customAssets) {
    const upper = custom.symbol.trim().toUpperCase();
    if (removedSymbols.has(upper)) continue;
    const alreadyInBase = BASELINE_ASSET_UNIVERSE.some(
      (b) => b.symbol.toUpperCase() === upper
    );
    if (!alreadyInBase && !activeAssets.some((a) => a.symbol.toUpperCase() === upper)) {
      activeAssets.push({ ...custom, isCustom: true });
    }
  }

  const results = await Promise.allSettled(
    activeAssets.map((asset) =>
      getHeikinAshiSeries(
        asset.symbol,
        interval,
        customSymbolSet.has(asset.symbol.toUpperCase()) ? asset : undefined
      )
    )
  );

  const quotes: WatchlistQuote[] = [];
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const asset = activeAssets[i];
    if (res.status === 'fulfilled') {
      const data = res.value;
      const totalBars = data.bullishBars + data.bearishBars;
      const prevCandle =
        data.candles.length >= 2
          ? data.candles[data.candles.length - 2].close
          : data.currentPrice;

      let buyVol = 0;
      let sellVol = 0;
      for (const exec of data.whaleExecutions) {
        if (exec.side === 'buy') buyVol += exec.notionalUsd;
        else sellVol += exec.notionalUsd;
      }
      const totalWhaleVol = buyVol + sellVol;
      const whaleBuyPct = totalWhaleVol > 0 ? (buyVol / totalWhaleVol) * 100 : 50;
      const whaleNetFlowUsd = buyVol - sellVol;
      const whaleSentimentLabel: WatchlistQuote['whaleSentimentLabel'] =
        whaleBuyPct >= 58
          ? 'Bullish Accumulation'
          : whaleBuyPct <= 42
          ? 'Bearish Distribution'
          : 'Balanced Flow';

      quotes.push({
        symbol: asset.symbol,
        displaySymbol: asset.displaySymbol,
        name: asset.name,
        type: asset.type,
        currency: data.currency,
        price: data.currentPrice,
        previousPrice: prevCandle,
        change2wPct: data.change2wPct,
        change2wAbs: data.change2wAbs,
        latestHaBullish: data.latestHaBullish,
        haStreak: data.haStreak,
        haBullishPct:
          totalBars > 0 ? Math.round((data.bullishBars / totalBars) * 100) : 50,
        high2w: data.high2w,
        low2w: data.low2w,
        socialScore: data.socialNow,
        consensusScore: data.consensusNow,
        whaleBuyVolumeUsd: buyVol,
        whaleSellVolumeUsd: sellVol,
        whaleNetFlowUsd,
        whaleBuyPct,
        whaleSentimentLabel,
        ratingScore: data.ratingScore,
        updatedAt: data.updatedAt,
        isCustom: Boolean(asset.isCustom),
      });
    }
  }

  if (isDefaultRequest && quotes.length > 0) {
    defaultWatchlistCache = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      data: quotes,
    };
  }

  return quotes;
}

function formatTimeAgo(timestampSec: number): string {
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - timestampSec);
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export async function getMarketCommentary(
  symbol: string,
  overrideMeta?: Partial<AssetDefinition>
): Promise<NewsCommentaryItem[]> {
  const assetMeta = inferAssetMeta(symbol, undefined, undefined, overrideMeta);
  const cacheKey = assetMeta.yahooSymbol;
  const cached = newsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const primaryQuery =
    assetMeta.type === 'FX'
      ? assetMeta.displaySymbol.replace('/', '')
      : assetMeta.yahooSymbol === 'GC=F'
      ? 'gold price'
      : assetMeta.yahooSymbol;

  const fallbackQuery =
    assetMeta.type === 'FX'
      ? 'forex currency dollar'
      : assetMeta.type === 'Crypto'
      ? 'bitcoin crypto'
      : assetMeta.type === 'Commodities'
      ? 'commodities gold oil'
      : 'stock market';

  const fetchNewsQuery = async (q: string) => {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      q
    )}&newsCount=10&quotesCount=0`;
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SignalGapTerminal/1.0)',
          Accept: 'application/json',
        },
      },
      6000
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      news?: Array<{
        uuid?: string;
        title?: string;
        publisher?: string;
        link?: string;
        providerPublishTime?: number;
        type?: string;
      }>;
    };
    return data.news || [];
  };

  let rawNews = await fetchNewsQuery(primaryQuery);
  if (rawNews.length === 0) {
    rawNews = await fetchNewsQuery(fallbackQuery);
  }

  const bullishWords = ['surge', 'rally', 'beat', 'gain', 'bull', 'up', 'high', 'growth', 'buy'];
  const bearishWords = ['drop', 'fall', 'slump', 'warn', 'bear', 'down', 'low', 'risk', 'sell', 'cut'];

  const items: NewsCommentaryItem[] = rawNews
    .filter((n) => n.title && n.link)
    .map((n, idx) => {
      const titleLower = (n.title || '').toLowerCase();
      const bullHits = bullishWords.filter((w) => titleLower.includes(w)).length;
      const bearHits = bearishWords.filter((w) => titleLower.includes(w)).length;
      const sentiment: NewsCommentaryItem['sentiment'] =
        bullHits > bearHits ? 'Bullish' : bearHits > bullHits ? 'Bearish' : 'Neutral';

      const publishedAt = n.providerPublishTime || Math.floor(Date.now() / 1000);
      const timeEst =
        new Date(publishedAt * 1000).toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' EST';

      return {
        id: n.uuid || `${cacheKey}-${idx}`,
        title: n.title || '',
        publisher: n.publisher || 'Market Wire',
        link: n.link || '#',
        publishedAt,
        timeAgo: formatTimeAgo(publishedAt),
        timeEst,
        sentiment,
        sourceType: idx % 2 === 0 ? 'Market News' : 'Analyst Wire',
      };
    });

  newsCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS * 2,
    data: items,
  });

  return items;
}
