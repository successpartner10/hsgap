# SignalGap — Complete Architecture, Design System & Clone Specification

This document is the **exhaustive, single-source-of-truth blueprint** required to recreate **SignalGap** (Cross-Asset Sentiment, Institutional Whale Flow & 2-Week Heikin-Ashi Terminal) identically — covering every package, config, CSS rule, pixel dimension, SVG coordinate, quantitative formula, Firebase security rule, Cloudflare Pages edge adapter, and component behavior.

---

## 1. Tech Stack, Dependencies & Build Config

### A. Runtime & Deployment Targets
- **Local / Node.js Runtime**: Node.js `v22+` (`tsx server.ts` in development; `node server.ts` in production using native TypeScript type-stripping — **never** use non-erasable TypeScript syntax such as `enum` or constructor parameter properties inside `server.ts` or `src/shared/marketEngine.ts`).
- **Cloudflare Pages Edge Runtime**: `/functions/api/market/[[route]].ts` invokes `src/shared/marketEngine.ts` (zero `node:*` imports, Web-Standard `fetch`, `Response.json`, `AbortSignal.timeout`).
- **Database & Auth**: Firebase Authentication (Google Sign-In `signInWithPopup` only) + Cloud Firestore using a **named Firestore database ID** (`firebase-applet-config.json`).

### B. `package.json` Dependencies & Scripts
- **Scripts**:
  - `"dev": "tsx server.ts"`
  - `"build": "vite build"`
  - `"start": "node server.ts"`
  - `"preview": "vite preview"`
  - `"lint": "tsc --noEmit"`
- **Core Runtime Dependencies**: `express` (`^4.21.2`), `firebase` (`^13.4.0`), `lucide-react` (`^0.546.0`), `react` (`^19.0.1`), `react-dom` (`^19.0.1`), `dotenv` (`^17.2.3`), `vite` (`^8.3.0`), `@vitejs/plugin-react` (`^6.1.1`), `@tailwindcss/vite` (`^4.3.3`).
- **Dev Dependencies**: `tsx` (`^4.21.0`), `typescript` (`^7.0.2`), `tailwindcss` (`^4.3.3`), `autoprefixer` (`^10.4.21`), `eslint` (`^10.15.0`), `@firebase/eslint-plugin-security-rules` (`^0.0.2`), `@types/express`, `@types/node`, `@types/react`, `@types/react-dom`.

### C. File Tree
```text
/
├── index.html                                  # Google Font Raleway (400..800), #F8FAFC canvas
├── package.json                                # Dev/Start/Build/Lint scripts & dependencies
├── tsconfig.json                               # ES2022, DOM, react-jsx, bundler resolution, allowImportingTsExtensions
├── vite.config.ts                              # react() + tailwindcss() + HMR disabled support + dist/src/assets copy
├── firebase-applet-config.json                 # Firebase SDK config & named firestoreDatabaseId
├── firebase-blueprint.json                     # Entity & path schema (AllowedEmail, UserWatchlist)
├── firestore.rules                             # Hardened email allowlist & shared_admin / uid watchlist rules
├── server.ts                                   # Express server on port 3000 delegating to src/shared/marketEngine.ts
├── functions/
│   └── api/
│       └── market/
│           └── [[route]].ts                    # Cloudflare Pages catch-all API function with s-maxage caching
├── ARCHITECTURE_AND_CLONE_SPEC.md              # This complete clone specification
└── src/
    ├── index.css                               # Tailwind v4, Raleway global family, lining-nums, tabular numerals, scrollbars
    ├── main.tsx                                # React 19 root wrapped in <ErrorBoundary>
    ├── firebase.ts                             # Firebase App, GoogleAuthProvider, named Firestore DB, testConnection(), handleFirestoreError()
    ├── App.tsx                                 # Root layout, AuthGate, Firestore sync, header, desktop nav & fixed mobile bottom nav
    ├── shared/
    │   └── marketEngine.ts                     # Pure Web-Standard Yahoo Finance + 2W HA + Sentiment + Whale math engine
    ├── hooks/
    │   └── useSignalGapAuth.ts                 # Google Sign-In verification, bootstrapped admin seeding & real-time onSnapshot listeners
    ├── types/
    │   └── market.ts                           # All TypeScript domain interfaces
    ├── utils/
    │   └── formatters.ts                       # Price, percentage, signed abs, volume, and compact USD formatters
    └── components/
        ├── AuthGate.tsx                        # Sign-In & Access-Not-Enabled gate card
        ├── ErrorBoundary.tsx                   # React error boundary decoding structured FirestoreErrorInfo JSON
        ├── ManageAccessModal.tsx               # Admin-only modal to allow/role-switch/remove emails
        ├── TickerButtonsMatrix.tsx             # Pastel tabs, always-global search, category save bar, 4px 2-line cards + star/remove
        ├── SentimentAndHeikinAshiCard.tsx      # Hero card, 4H Sentiment SVG, 2W Heikin-Ashi SVG, Whale Sentiment Bar, 01..04 grid
        ├── CommentaryAndTape.tsx               # Observed Online Commentary + Large Volume Executions table + CSV export
        └── CrossAssetWhaleRadar.tsx            # Cross-Asset Whale Radar KPIs + 9-column Whale & Social Sentiment Matrix
```

---

## 2. Exact HTML, CSS, Typography & Color Specification

### A. `index.html` Head & Body
- Loads Google Font: `https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700;800&display=swap`
- `<body>` class: `bg-[#F8FAFC] text-[#0F172A] antialiased selection:bg-emerald-500/15 selection:text-emerald-900`

### B. Complete `src/index.css`
```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@layer base {
  :root {
    --font-sans: 'Raleway', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  html,
  body,
  button,
  input,
  select,
  textarea {
    font-family: var(--font-sans);
    font-variant-numeric: lining-nums;
  }

  body {
    background-color: #F8FAFC;
    color: #0F172A;
  }

  .font-mono-tabular {
    font-family: var(--font-sans);
    font-variant-numeric: tabular-nums lining-nums;
  }
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #F1F5F9; }
::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
```

### C. Color Tokens
| Role | Hex / Value | Usage |
| :--- | :--- | :--- |
| **App Canvas** | `#F8FAFC` | Root page background |
| **Card / Bar Surface** | `#FFFFFF` | Cards, sticky header, mobile fixed bottom bar, footer, modals |
| **Track / Table Hover** | `#F1F5F9` / `#F8FAFC` | Segmented toggle tracks, chart horizontal gridlines (`#F1F5F9`), table hover (`hover:bg-slate-50`) |
| **Borders / Dividers** | `#E2E8F0` / `#F1F5F9` | Card borders (`border-slate-200`), internal row dividers (`divide-slate-100`) |
| **Primary Ink** | `#0F172A` | Titles, prices, active interval pill, Social Momentum curve (`#0F172A`), CTA buttons |
| **Secondary Ink** | `#475569` / `#64748B` | Subtitles, Market Consensus curve (`#475569`), SVG tick labels (`#64748B`) |
| **Bullish / Positive** | `#ECFDF5` bg · `#A7F3D0` / `#059669` border · `#059669` text | Bullish ticker buttons (`#D1FAE5` when selected), HA bull candles, Whale Buys, `BUY BIAS`, `>= 0%` 2W returns |
| **Bearish / Negative** | `#FEF2F2` bg · `#FECACA` / `#DC2626` border · `#DC2626` text | Bearish ticker buttons (`#FEE2E2` when selected), HA bear candles, Whale Sells, `SELL BIAS`, `< 0%` 2W returns (`#E11D48` on right side of Whale Sentiment split bar) |
| **Neutral / Balanced** | `#FFFBEB` bg · `#FDE68A` border · `#B45309` / `#D97706` text | Balanced flow & neutral commentary |
| **EMA-20 Overlay** | `#2563EB` | `1.75px` solid SVG line; active pill `bg-[#EFF6FF] border-[#93C5FD] text-[#2563EB]` |
| **VWAP Overlay** | `#D97706` | `1.6px` dashed (`4 3`) SVG line; active pill `bg-[#FFFBEB] border-[#FCD34D] text-[#D97706]` |

### D. Pastel Category Tabs (`FX`, `Stocks`, `Crypto`, `Commodities`)
No `All Markets (N)`, no 5th `Favorites` tab, and no `All / Bearish / Bullish` / `Red if:` summary bars. Clicking an active pastel tab toggles back to showing all 4 groups:
- **FX**: Idle `bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8] hover:bg-[#DBEAFE]` · Active `bg-[#DBEAFE] border-[#3B82F6] text-[#1E3A8A] ring-1 ring-[#3B82F6]`
- **Stocks (`Equities`)**: Idle `bg-[#F5F3FF] border-[#DDD6FE] text-[#6D28D9] hover:bg-[#EDE9FE]` · Active `bg-[#EDE9FE] border-[#8B5CF6] text-[#4C1D95] ring-1 ring-[#8B5CF6]`
- **Crypto**: Idle `bg-[#FFFBEB] border-[#FDE68A] text-[#B45309] hover:bg-[#FEF3C7]` · Active `bg-[#FEF3C7] border-[#F59E0B] text-[#78350F] ring-1 ring-[#F59E0B]`
- **Commodities**: Idle `bg-[#ECFEFF] border-[#A5F3FC] text-[#0E7490] hover:bg-[#CFFAFE]` · Active `bg-[#CFFAFE] border-[#06B6D4] text-[#164E63] ring-1 ring-[#06B6D4]`

### E. Strict Geometry & Border Radius Contract
- **Every component uses `rounded-[4px]`** (cards, buttons, tabs, inputs, selects, modals, stance badges, progress bar, CSV/refresh/sign-out buttons).
- **Layout width**: `max-w-[1280px] mx-auto px-4 sm:px-6`, vertical gap `space-y-5` (`20px`).

---

## 3. Baseline Asset Universe, Exclusions & Number Formatters

### A. Defaults & Exclusions
- **Default Symbol**: `USDCHF=X` (`USD/CHF`)
- **Supported Intervals**: `1h` (`1H`) and `4h` (`4H`, default). **`1D` is removed.**
- **Default Session Filter**: `london_ny` (`London–NY (3AM–4PM)`)
- **Default Min Whale Threshold**: `100_000` (`$100K+`)
- **Default Starred Favorites** (initial document seed): `['USDCHF=X', 'NVDA', 'T.TO', 'XAUUSD']`
- **Explicit Exclusions**: All ETFs (`SPY`, `QQQ`, etc.), `USDJPY=X`, `RY.TO`, `SHOP.TO`, `AMD`, `TD.TO`.

### B. Configured Baseline Instruments (23 Total)
1. **FX** (`6`): `USDCHF=X` (`USD/CHF` — Default), `XAUUSD` (`XAU/USD` → Yahoo `GC=F`), `USDCAD=X` (`USD/CAD`), `EURUSD=X` (`EUR/USD`), `GBPUSD=X` (`GBP/USD`), `AUDUSD=X` (`AUD/USD`)
2. **Stocks / `Equities`** (`10`, indices first): `^IXIC` (`NASDAQ`), `^GSPC` (`S&P 500`), `NVDA`, `AAPL`, `MSFT`, `TSLA`, `AMZN`, `META`, `GOOGL`, `T.TO` (`TELUS Corp. (Toronto)`)
3. **Crypto** (`4`): `BTC-USD`, `ETH-USD`, `SOL-USD`, `XRP-USD`
4. **Commodities** (`3`): `SI=F` (`SILVER`), `CL=F` (`WTI`), `NG=F` (`NATGAS`)

### C. Formatting Rules (`src/utils/formatters.ts`)
- **`formatPrice(value, symbol, type)`**:
  - `XAUUSD` / `XAU/USD` / `GC=F` → `en-US` with **2 decimals** (even though `type === 'FX'`).
  - Any other `FX` (`type === 'FX'` or symbol ends with `=X`) → **`value.toFixed(5)`**.
  - Any price with `|value| < 2` → **`value.toFixed(4)`**.
  - All others → `en-US` with **2 decimals**.
- **`formatPct(value)`**: `${value > 0 ? '+' : ''}${value.toFixed(2)}%`.
- **`formatVolume(vol)`**: `<= 0` → `'—'`; `>= 1e9` → `B` (2 dec); `>= 1e6` → `M` (2 dec); `>= 1e3` → `K` (1 dec); else rounded integer.
- **`formatUsdCompact(amount, signed)`**: `>= 1e9` → `$X.XXB`; `>= 1e6` → `$X.XXM`; `>= 1e3` → `$X.XK`; else `$X` (prefixed with `+`/`-` when `signed=true`).

---

## 4. Exact Quantitative & Market Engine Specification (`src/shared/marketEngine.ts`)

### A. Upstream Yahoo Finance Queries & Dynamic Normalization
1. **OHLCV Feed**: `GET https://query1.finance.yahoo.com/v8/finance/chart/{yahooSymbol}?range=1mo&interval=1h&includePrePost=false` (`8000ms` timeout, User-Agent `Mozilla/5.0 (compatible; SignalGapTerminal/1.0)`). Strips any bar with null/non-finite `O/H/L/C`. In-memory cache TTL: **`60_000ms`**.
2. **4H Aggregation**: Groups `1h` bars into UTC 4-hour buckets (`Math.floor(ts / 14400) * 14400`), preserving first open, max high, min low, last close, and summed volume.
3. **Dynamic Ticker Inference (`inferAssetMeta`)**:
   - Honors explicit user `overrideMeta` if saved in Firestore.
   - Maps `XAUUSD` / `XAU/USD` → `{ symbol: 'XAUUSD', yahooSymbol: 'GC=F', displaySymbol: 'XAU/USD', type: 'FX' }`.
   - Maps 6-letter FX pairs (`EURJPY`, `EUR/CAD`) to `XXXYYY=X` with `displaySymbol: 'XXX/YYY'` and `type: 'FX'`.
   - Infers `Crypto` (`CRYPTOCURRENCY` or `-USD`), `FX` (`CURRENCY`, `=X`, `XAU`), `Commodities` (`FUTURE`, `=F`, `XAG`), else `Equities`.

### B. 2-Week Heikin-Ashi & Technical Formulas
Let `twoWeekCutoff = latestBar.timestamp - 14 * 86400`. All indicators warm up over the full 1-month series, then slice output candles strictly to `timestamp >= twoWeekCutoff` (fallback `slice(-14)` if < 2 bars):
1. **Heikin-Ashi**:
   - `haClose = (O + H + L + C) / 4`
   - `haOpen[0] = (O[0] + C[0]) / 2`; `haOpen[i] = (haOpen[i-1] + haClose[i-1]) / 2`
   - `haHigh = max(H, haOpen, haClose)`; `haLow = min(L, haOpen, haClose)`
   - `isBullish = haClose >= haOpen`
   - `eps = max(|haClose| * 0.0004, 1e-6)`; `isStrongTrend` is true if bullish with `|haLow - haOpen| <= eps`, or bearish with `|haHigh - haOpen| <= eps`.
2. **EMA-20 & Spread**:
   - `k = 2 / 21`, initialized at `rawBars[0].close`.
   - `ema20SpreadPct = ((latest.close - latest.ema20) / latest.ema20) * 100`.
3. **VWAP / TWAP**:
   - Computed over `timestamp >= twoWeekCutoff`: `typicalPrice = (H + L + C) / 3`. If cumulative volume `> 0`, `cum(typicalPrice * volume) / cum(volume)`, else equal-weighted TWAP `cum(typicalPrice) / count`.
4. **RSI(14)**: Simple gain/loss average over trailing `min(14, rawBars.length - 1)` periods (`100 - 100 / (1 + avgGain/avgLoss)`).
5. **Relative Volume**: `latestBar.volume / mean(last 20 non-zero candle volumes)` (`1` if unavailable).
6. **Market Consensus & Social Momentum (`0..100`)**:
   - Trailing 15-bar range position `rangePos = ((close - minLow_15) / (maxHigh_15 - minLow_15)) * 100`.
   - `emaDiffPct = ((close - ema20) / ema20) * 100`.
   - `marketConsensus = clamp(round(50 + (rangePos - 50) * 0.55 + emaDiffPct * 4.5), 8, 96)`.
   - `haBodyPct = ((haClose - haOpen) / haOpen) * 100`.
   - `targetSocial = clamp(50 + (isBullish ? 14 : -14) + haBodyPct * 18, 10, 94)`.
   - `socialMomentum = round(prevSocial * 0.65 + targetSocial * 0.35)` (initialized `prevSocial = 50`).
   - `sentimentGap = socialNow - consensusNow`.
7. **2W Change, Rating, Confidence & Stance**:
   - `currentPrice = meta.regularMarketPrice ?? lastCandle.close`; `change2wAbs = currentPrice - firstCandle.open`; `change2wPct = (change2wAbs / firstCandle.open) * 100`.
   - `ratingScore = clamp(round(bullBarShare * 0.35 + rsi14 * 0.25 + consensusNow * 0.25 + (latestHaBullish ? 12 : 3)), 12, 96)`.
   - `confidence`: `'High'` if `haStreak >= 3 && |ema20SpreadPct| >= 0.2`, `'Medium'` if `haStreak >= 2`, else `'Low'`.
   - `stance`: `'BUY BIAS'` if `(ratingScore >= 58 && latestHaBullish)` or `(latestHaBullish && change2wPct > 0)`; `'SELL BIAS'` if `(ratingScore <= 44 && !latestHaBullish)` or `(!latestHaBullish && change2wPct < 0)`; else `'NEUTRAL'`.

### C. Whale Detection & Commentary Wire
- **Whale Execution Trigger**: `activityMultiple >= 1.15 || c.isStrongTrend`, where `rangeRatio = (H - L) / avgRange` and `activityMultiple = (avgVol > 0 && c.volume > 0) ? volRatio * 0.7 + rangeRatio * 0.3 : rangeRatio`.
- **Notional USD**:
  - When `volume > 0`: `blockShare = clamp(0.03 + (activityMultiple - 1) * 0.04, 0.02, 0.16)`, `notionalUsd = clamp(c.volume * c.close * blockShare, 65_000, 85_000_000)`.
  - Spot FX (zero upstream volume): `notionalUsd = clamp(420_000 * activityMultiple, 85_000, 12_500_000)`.
- **Side**: `'buy'` if `c.close >= c.open`, `'sell'` otherwise.
- **Venue Labels**: `FX` → `'CME FX / Spot Pool'`; `Crypto` → `'Coinbase / Kraken Block'`; `Commodities` → `'COMEX / NYMEX Futures'`; TSX (`toronto`/`tsx`) → `'TSX Institutional Tape'`; else `'{exchange} Block Tape'`.
- **News Wire**: Queries `v1/finance/search?q={primary}&newsCount=10&quotesCount=0` with asset-class fallback (`'forex currency dollar'`, `'bitcoin crypto'`, `'commodities gold oil'`, `'stock market'`). Cached `120_000ms`. Bullish keywords: `['surge', 'rally', 'beat', 'gain', 'bull', 'up', 'high', 'growth', 'buy']`; Bearish keywords: `['drop', 'fall', 'slump', 'warn', 'bear', 'down', 'low', 'risk', 'sell', 'cut']`.

---

## 5. UI Layout, Component Architecture & Exact SVG Geometry

### A. Navigation (`App.tsx`)
- **Desktop Header (`sticky top-0 z-30 bg-white border-b border-slate-200 h-14`)**:
  - Left: `SignalGap` brand (`text-lg font-bold`) + 4 nav items (`Search`, `Commentary`, `Whale Tape`, divider `h-4 w-px bg-slate-200`, `Radar` icon + `Whale Radar`).
  - Right: `user.email` (`hidden sm:inline`), admin-only **`Manage Access`** button (`bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]`), **`Sign Out`** button.
- **Mobile Fixed Bottom Nav (`md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-white border-t border-slate-200 grid grid-cols-4`)**:
  - 4 buttons (`min-h-[44px]`): **Search** (`Search` icon, focuses search input), **Commentary** (`MessageSquareText` icon), **Whale Tape** (`Activity` icon), **Whale Radar** (`Radar` icon).
  - Outer app container has `pb-16 md:pb-0` so the fixed bottom bar never overlaps footer/content.

### B. Clickable Ticker Matrix (`TickerButtonsMatrix.tsx`)
- Top bar: 4 pastel category tabs (`FX`, `Stocks`, `Crypto`, `Commodities`) + global search input (`placeholder="Global search: USDCHF, XAUUSD, USDCAD, NASDAQ, T.TO..."`) + `Load` button when non-empty.
- When `activeChartData` is loaded and not present in `quotes`, renders a save strip: `"{displaySymbol} ({name}) loaded. Save it to your synced list:"` + category `<select>` + `"+ Add to {Category}"` button.
- Category sections render in order `['FX', 'Equities', 'Crypto', 'Commodities']`, sorted with starred favorites first inside each category (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2`).
- **2-line button content** (no HA line):
  - Line 1: bold `displaySymbol` + `TrendingDown`/`TrendingUp` + `Bear` (if `change2wPct < 0`) / `Bull` (if `>= 0`).
  - Line 2: tabular `formatPrice(...)` + `formatPct(change2wPct)`.
  - Top-right corner: `Star` toggle + `X` remove button (when `quotes.length > 1`).

### C. Sentiment & 2-Week Heikin-Ashi Card (`SentimentAndHeikinAshiCard.tsx`)
1. **Top Hero Card**:
   - Metadata row: `{displaySymbol} · {typeLabel} · {interval} Pulse (2W) · Confidence: {High|Medium|Low}` on left; `{EST timestamp}` + `Live 1m` badge on right.
   - Title: `h1` (`text-2xl font-bold`), `currentPrice` (`text-2xl sm:text-[26px] font-mono-tabular font-bold`), 2W `%` change, alignment summary sentence, `Rating {ratingScore} / 100`, and `Stance` (`BUY BIAS` / `SELL BIAS` / `NEUTRAL`) box.
2. **4H Sentiment vs. Market Consensus SVG**:
   - `sentHeight = 195`, `sentPadLeft = 40`, `sentPadRight = 24`, `sentPadTop = 14`, `sentPadBottom = 26`.
   - Gridlines & Y labels at `0, 50, 100` (`Raleway`, `11px`, `#64748B`).
   - Spread polygon `rgba(15, 23, 42, 0.08)`, dashed Consensus `#475569` (`strokeWidth=1.6`, `4 4`), solid Social `#0F172A` (`strokeWidth=2`), `3.5px` endpoint dots, hover crosshair, X labels (`start`, `middle`, `'Now'`).
3. **2-Week Heikin-Ashi SVG**:
   - `haHeight = width < 640 ? 270 : 320`, `padLeft = 14`, `padRight = 76`, `padTop = 14`, `padBottom = 26`, `volHeight = 42`, `volTop = padTop + pricePlotH + 8`.
   - Price bounds padded `±8%` (`span * 0.08`) including active `EMA-20` and `VWAP` overlays; 5 horizontal gridlines + right-axis labels (`10.5px` Raleway).
   - Candle geometry: `stepX = chartW / candles.length`, `bodyW = clamp(stepX * 0.65, 3, 16)`, `rx=1`, bull `#059669`, bear `#DC2626`, volume bars `rgba(16,185,129,0.22)` / `rgba(239,68,68,0.22)`.
   - Whale triangle polygons (`▲` `#059669` below `wickBottom`, `▼` `#DC2626` above `wickTop`), dashed current price line + right-axis price pill (`width=padRight-4, height=20, rx=4`).
   - Bottom control strip: `1H / 4H` segmented toggle, `— EMA-20`, `— VWAP`, `▲ Whales`, `Min` threshold select (`$50K+`, `$100K+`, `$250K+`, `$500K+`, `$1M+`, `$5M+`), `Session` select (`all`, `london_ny`, `ny_regular`, `asia`). Session hour ranges in EST: `london_ny` (`3..16`), `ny_regular` (`9..16`), `asia` (`>= 19 || < 3`).
4. **Whale Sentiment Sub-Section & `01..04` Grid**:
   - Split progress bar (`h-2`, `#059669` vs `#E11D48`), `text-[13px]` 2W High/Low & Largest Print row.
   - `grid-cols-1 md:grid-cols-2 gap-3` cards (`text-sm` titles/values, `text-[13px]` subtitles): `01. Social Buzz` (bullish bar %), `02. Trend` (EMA-20 spread %), `03. Momentum` (`RSI (14)`), `04. Volume` (`Relative Vol`).

### D. Observed Online Commentary & Large Volume Executions (`CommentaryAndTape.tsx`)
- **Commentary Card (`#commentary`)**: Filter pills (`All`, `Market News`, `Analyst Wire`), `md:grid-cols-12` (`col-span-3` time/publisher/sentiment + `col-span-9` headline & `Read source` external link), displays up to 6 items.
- **Whale Tape Card (`#whale-tape`)**: Filter pills (`All Prints`, `Whale Buys`, `Whale Sells`), venue/note search input, **`Download CSV`** button exporting `Time_EST,Side,Price,Size,Notional_USD,Venue,Context` as `{symbol}_whale_executions_2w.csv`. Shows 5 rows by default with `Show all N prints` toggle.

### E. Cross-Asset Whale Radar (`CrossAssetWhaleRadar.tsx`)
- Top KPI card (`#whale-radar`): 4 pastel category tabs + `$50K+..$5M+` block filter buttons + 4 KPIs (`Monitored Whale Volume`, `Aggregate Whale Buys`, `Aggregate Whale Sells`, `Cross-Asset Net Flow`).
- Matrix table (`Whale & Social Sentiment Matrix (2W · 4H)`): 9 columns (`1-Clk` Star, `Instrument`, `Class`, `Price`, `2W Change`, `Whale Sentiment`, `Social Buzz`, `Whale Buy %`, `Net Whale Flow`), sorted by starred favorites first then `|whaleNetFlowUsd|` descending.

---

## 6. Firebase Auth, Firestore Rules & Multi-Device Sync

### A. Initialized Firebase Client (`src/firebase.ts`)
- Connects using `firebase-applet-config.json` (`projectId: "hsgap-live"`), using `getFirestore(app)` for `(default)` or `getFirestore(app, firestoreDatabaseId)` when a named database is configured.
- Runs startup `getDocFromServer(doc(db, 'test', 'connection'))` (`testConnection()`).
- Structured `handleFirestoreError(error, operationType, path)` logs & throws JSON `FirestoreErrorInfo`, caught cleanly by `<ErrorBoundary />`.

### B. Collections (`firebase-blueprint.json` & `firestore.rules`)
1. **`/allowed_emails/{lowercaseEmail}`**:
   - Exact keys: `email`, `role` (`'admin' | 'member'`), `addedBy`, `createdAt`, `updatedAt`.
   - Bootstrapped primary admins (immutable against demotion/deletion): `sunnyguy664@gmail.com` and `sandipyashpal@gmail.com`.
   - Signed-in verified users (`request.auth.token.email_verified == true`) can `get` their own doc; only admins can `list`, `create`, `update`, `delete`.
2. **`/watchlists/{watchlistId}`**:
   - Exact keys: `ownerId` (`'shared_admin'` or `uid`), `scope` (`'shared_admin' | 'personal'`), `customAssets` (`<= 60` items with exact keys `symbol`, `yahooSymbol`, `displaySymbol`, `name` `<= 80`, `type`), `removedSymbols` (`<= 50`), `favorites` (`<= 80`), `updatedBy` (`userEmail()`), `updatedAt` (`request.time`).
   - Admins read/write `watchlists/shared_admin` in real time across Android and Linux desktop; non-admin members read/write only `watchlists/{request.auth.uid}` (starting with empty `customAssets`/`removedSymbols` and `DEFAULT_FAVORITES`).

---

## 7. Backend API & Cloudflare Pages Deployment

### A. Endpoints (`server.ts` & `/functions/api/market/[[route]].ts`)
1. `GET /api/market/watchlist?interval=4h` and `POST /api/market/watchlist` (`{ interval, customAssets, removedSymbols }`) → `{ quotes, windowDays: 14, interval }` (`s-maxage=60`).
2. `GET /api/market/heikin-ashi?symbol=USDCHF=X&interval=4h` → `HeikinAshiResponse` (`s-maxage=60`).
3. `GET /api/market/news?symbol=USDCHF=X` → `{ symbol, items }` (`s-maxage=120`).

### B. Cloudflare Pages Deployment Checklist
1. Root `wrangler.toml` configures `pages_build_output_dir = "dist"` and `compatibility_date = "2024-11-01"`.
2. Deploy via **Git integration** (`Build command: npm run build`, `Build output directory: dist`) OR via CLI from the project root (`npm run build && npx wrangler pages deploy dist`). Do **not** use dashboard static-only Direct Upload of `dist/` alone, as dashboard Direct Upload skips `/functions/api/market/[[route]].ts`.
3. Add your Cloudflare Pages domain (`*.pages.dev` and any custom domain) to **Firebase Console → Authentication → Settings → Authorized domains** and enable the **Google** sign-in provider.
