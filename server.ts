import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getHeikinAshiSeries,
  getMarketCommentary,
  getWatchlistQuotes,
} from './src/shared/marketEngine.ts';
import type { AssetDefinition, CandleInterval } from './src/types/market.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/market/watchlist', async (req, res) => {
    try {
      const rawInterval = String(req.query.interval || '4h');
      const interval: CandleInterval = rawInterval === '1h' ? '1h' : '4h';
      let customAssets: AssetDefinition[] = [];
      let removedSymbols: string[] = [];
      if (typeof req.query.custom === 'string' && req.query.custom.trim()) {
        try {
          const parsed = JSON.parse(req.query.custom);
          if (Array.isArray(parsed)) customAssets = parsed;
        } catch {
          customAssets = [];
        }
      }
      if (typeof req.query.removed === 'string' && req.query.removed.trim()) {
        removedSymbols = req.query.removed
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      const quotes = await getWatchlistQuotes(interval, {
        customAssets,
        removedSymbols,
      });
      res.json({ quotes, windowDays: 14, interval });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load watchlist';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/market/watchlist', async (req, res) => {
    try {
      const body = (req.body || {}) as {
        interval?: string;
        customAssets?: AssetDefinition[];
        removedSymbols?: string[];
      };
      const interval: CandleInterval = body.interval === '1h' ? '1h' : '4h';
      const customAssets = Array.isArray(body.customAssets) ? body.customAssets : [];
      const removedSymbols = Array.isArray(body.removedSymbols)
        ? body.removedSymbols
        : [];

      const quotes = await getWatchlistQuotes(interval, {
        customAssets,
        removedSymbols,
      });
      res.json({ quotes, windowDays: 14, interval });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load custom watchlist';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/market/heikin-ashi', async (req, res) => {
    try {
      const symbol = String(req.query.symbol || 'USDCHF=X').trim();
      const rawInterval = String(req.query.interval || '4h');
      const interval: CandleInterval = rawInterval === '1h' ? '1h' : '4h';

      if (!symbol || symbol.length > 24) {
        res.status(400).json({ error: 'Invalid ticker symbol.' });
        return;
      }

      const data = await getHeikinAshiSeries(symbol, interval);
      res.json(data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to fetch Heikin-Ashi series';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/market/news', async (req, res) => {
    try {
      const symbol = String(req.query.symbol || 'USDCHF=X').trim();
      const items = await getMarketCommentary(symbol);
      res.json({ symbol, items });
    } catch {
      res.json({ symbol: req.query.symbol || 'USDCHF=X', items: [] });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
