import { formatCoinAmount, formatUsdt } from "../../lib/format.js";
import type { BufferStateDTO } from "../../api/buffersTypes.js";

/**
 * Own threshold choice, since the spec names the banner's behavior
 * ("names the remedy and the amount") but not the exact trigger: a line
 * appears for every coin whose headroom has gone negative (prefund the
 * shortfall) and every LP with zero or negative headroom (top up). No line,
 * no banner — absence is the signal, never a green "all clear".
 */
export function ActionBanner({ state }: { state: BufferStateDTO }) {
  const lines: string[] = [];

  for (const coin of state.coinStates) {
    const headroom = Number(coin.headroom);
    if (headroom < 0) {
      lines.push(`Prefund ${formatCoinAmount(Math.abs(headroom), coin.coinId)}`);
    }
  }

  for (const lp of state.lpStates) {
    const headroom = Number(lp.headroom);
    if (headroom <= 0) {
      // lp.name is user-supplied and may already read as "LP-Whatever" —
      // don't assume it lacks a prefix and double one up.
      lines.push(`Top up ${lp.name} by ${formatUsdt(Math.abs(headroom))} USDT`);
    }
  }

  if (lines.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-3">
      <ul className="flex flex-col gap-1 text-sm text-red-200">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
