export const EXPLORER_URL = import.meta.env.VITE_EXPLORER_URL || "https://explorer.legacycoinseed.space/search?q=";

export function formatHashrate(hashrate: number): string {
  if (hashrate === 0) return '0 H/s';
  const k = 1000;
  const sizes = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s'];
  const i = Math.floor(Math.log(hashrate) / Math.log(k));
  return parseFloat((hashrate / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function truncateAddress(address: string): string {
  if (!address || address.length < 15) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString();
}
