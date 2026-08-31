import type { StatusBand } from "@coinbit/shared";

const MENTION = process.env.TELEGRAM_ALERT_MENTION ?? "@oswaldavid";

export function formatAssetStatusAlert(coinId: string, band: StatusBand, consumedPct: string): string {
  return [
    "🚨 *ASSET STATUS ALERT*",
    "",
    `🪙 *Coin:* ${coinId}`,
    `⚠️ *Status:* ${band}`,
    `📊 *Consumed:* ${consumedPct}%`,
    "",
    "━━━━━━━━━━━━━━━━━━",
    "",
    `👤 Please be aware: ${MENTION}`,
  ].join("\n");
}
