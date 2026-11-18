export type AssetType = 'FX' | 'Equities' | 'Crypto' | 'Commodities';

export type CandleInterval = '1h' | '4h';

export type BearishBasis = 'return2w' | 'haCandle';

export type SessionFilter = 'all' | 'london_ny' | 'ny_regular' | 'asia';

export type UserRole = 'admin' | 'member';

export interface AssetDefinition {
  symbol: string;
  yahooSymbol: string;
  displaySymbol: string;
  name: string;
  type: AssetType;
}

export interface AllowedEmailRecord {
  email: string;
  role: UserRole;
  addedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserWatchlistDoc {
  ownerId: string;
  scope: 'shared_admin' | 'personal';
  customAssets: AssetDefinition[];
  removedSymbols: string[];
  favorites: string[];
  updatedBy: string;
  updatedAt?: unknown;
}

export interface HeikinAshiCandle {
  timestamp: number;
  dateLabel: string;
  fullDate: string;
  hourEst: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  haOpen: number;
  haHigh: number;
  haLow: number;
  haClose: number;
  ema20: number;
  vwap: number;
  socialMomentum: number;
  marketConsensus: number;
  isBullish: boolean;
  isStrongTrend: boolean;
}

export interface WhaleExecution {
  id: string;
  timestamp: number;
  timeEst: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  notionalUsd: number;
  volumeMultiple: number;
  venue: string;
  context: string;
  hourEst: number;
}

export interface NewsCommentaryItem {
  id: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: number;
  timeAgo: string;
  timeEst: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  sourceType: 'Market News' | 'Analyst Wire';
}

export interface WatchlistQuote {
  symbol: string;
  displaySymbol: string;
  name: string;
  type: AssetType;
  currency: string;
  price: number;
  previousPrice: number;
  change2wPct: number;
  change2wAbs: number;
  latestHaBullish: boolean;
  haStreak: number;
  haBullishPct: number;
  high2w: number;
  low2w: number;
  socialScore: number;
  consensusScore: number;
  whaleBuyVolumeUsd: number;
  whaleSellVolumeUsd: number;
  whaleNetFlowUsd: number;
  whaleBuyPct: number;
  whaleSentimentLabel: 'Bullish Accumulation' | 'Bearish Distribution' | 'Balanced Flow';
  ratingScore: number;
  updatedAt: number;
  isCustom?: boolean;
}

export interface HeikinAshiResponse {
  symbol: string;
  yahooSymbol: string;
  displaySymbol: string;
  name: string;
  type: AssetType;
  exchange: string;
  currency: string;
  interval: CandleInterval;
  windowDays: number;
  currentPrice: number;
  change2wAbs: number;
  change2wPct: number;
  high2w: number;
  low2w: number;
  bullishBars: number;
  bearishBars: number;
  latestHaBullish: boolean;
  haStreak: number;
  rsi14: number;
  ema20SpreadPct: number;
  relativeVolume: number;
  socialNow: number;
  consensusNow: number;
  sentimentGap: number;
  ratingScore: number;
  confidence: 'High' | 'Medium' | 'Low';
  stance: 'BUY BIAS' | 'SELL BIAS' | 'NEUTRAL';
  candles: HeikinAshiCandle[];
  whaleExecutions: WhaleExecution[];
  updatedAt: number;
}
