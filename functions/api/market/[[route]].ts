import {
  getHeikinAshiSeries,
  getMarketCommentary,
  getWatchlistQuotes,
} from '../../../src/shared/marketEngine';
import type { AssetDefinition, CandleInterval } from '../../../src/types/market';

interface PagesContext {
  request: Request;
  params?: {
    route?: string | string[];
  };
}

function jsonResponse(
  payload: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const method = context.request.method.toUpperCase();
  const url = new URL(context.request.url);
  const path = url.pathname;

  try {
    if (path.endsWith('/watchlist')) {
      if (method === 'GET') {
        const rawInterval = url.searchParams.get('interval') || '4h';
        const interval: CandleInterval = rawInterval === '1h' ? '1h' : '4h';
        let customAssets: AssetDefinition[] = [];
        let removedSymbols: string[] = [];

        const customParam = url.searchParams.get('custom');
        const removedParam = url.searchParams.get('removed');
        if (customParam) {
          try {
            const parsed = JSON.parse(customParam);
            if (Array.isArray(parsed)) customAssets = parsed;
          } catch {
            customAssets = [];
          }
        }
        if (removedParam) {
          removedSymbols = removedParam
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }

        const quotes = await getWatchlistQuotes(interval, {
          customAssets,
          removedSymbols,
        });
        return jsonResponse(
          { quotes, windowDays: 14, interval },
          200,
          customAssets.length === 0 && removedSymbols.length === 0
            ? { 'Cache-Control': 'public, s-maxage=60' }
            : undefined
        );
      }

      if (method === 'POST') {
        const rawBody = await context.request.text();
        const body = (rawBody ? JSON.parse(rawBody) : {}) as {
          interval?: string;
          customAssets?: AssetDefinition[];
          removedSymbols?: string[];
        };
        const interval: CandleInterval = body.interval === '1h' ? '1h' : '4h';
        const customAssets = Array.isArray(body.customAssets)
          ? body.customAssets
          : [];
        const removedSymbols = Array.isArray(body.removedSymbols)
          ? body.removedSymbols
          : [];

        const quotes = await getWatchlistQuotes(interval, {
          customAssets,
          removedSymbols,
        });
        return jsonResponse({ quotes, windowDays: 14, interval }, 200);
      }

      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    if (path.endsWith('/heikin-ashi') && method === 'GET') {
      const symbol = (url.searchParams.get('symbol') || 'USDCHF=X').trim();
      const rawInterval = url.searchParams.get('interval') || '4h';
      const interval: CandleInterval = rawInterval === '1h' ? '1h' : '4h';

      if (!symbol || symbol.length > 24) {
        return jsonResponse({ error: 'Invalid ticker symbol.' }, 400);
      }

      const data = await getHeikinAshiSeries(symbol, interval);
      return jsonResponse(data, 200, {
        'Cache-Control': 'public, s-maxage=60',
      });
    }

    if (path.endsWith('/news') && method === 'GET') {
      const symbol = (url.searchParams.get('symbol') || 'USDCHF=X').trim();
      try {
        const items = await getMarketCommentary(symbol);
        return jsonResponse(
          { symbol, items },
          200,
          { 'Cache-Control': 'public, s-maxage=120' }
        );
      } catch {
        return jsonResponse({ symbol, items: [] }, 200);
      }
    }

    return jsonResponse({ error: 'Market route not found' }, 404);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Market backend error';
    return jsonResponse({ error: message }, 502);
  }
}
