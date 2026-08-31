// The only place rounding happens — everything upstream stays full-precision string decimals.

export function formatIdr(value: string | number): string {
  const n = Number(value);
  return `Rp${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatCoinAmount(value: string | number, coinId?: string): string {
  const n = Number(value);
  const formatted = n.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return coinId ? `${formatted} ${coinId}` : formatted;
}

export function formatPct(value: string | number | null): string {
  if (value === null) return "—";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function formatUsdt(value: string | number): string {
  const n = Number(value);
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatDurationShort(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatJakartaTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" });
}
