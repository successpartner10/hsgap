import type { AssetType } from '../types/market';

export function formatPrice(value: number, symbol: string, type?: AssetType): string {
  if (!Number.isFinite(value)) return '—';

  const upper = symbol.toUpperCase();
  const isGold = upper === 'XAUUSD' || upper === 'XAU/USD' || upper === 'GC=F';
  const isFx = !isGold && (type === 'FX' || upper.endsWith('=X'));
  if (isFx) {
    return value.toFixed(5);
  }

  if (Math.abs(value) < 2) {
    return value.toFixed(4);
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '0.00%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatSignedAbs(value: number, symbol: string, type?: AssetType): string {
  if (!Number.isFinite(value)) return '0.00';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatPrice(Math.abs(value), symbol, type)}`;
}

export function formatVolume(vol: number): string {
  if (!Number.isFinite(vol) || vol <= 0) return '—';
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return String(Math.round(vol));
}

export function formatUsdCompact(amount: number, signed = false): string {
  if (!Number.isFinite(amount)) return '$0';
  const abs = Math.abs(amount);
  const sign = signed ? (amount > 0 ? '+' : amount < 0 ? '-' : '') : amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
