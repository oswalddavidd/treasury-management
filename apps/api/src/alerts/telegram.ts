const TELEGRAM_API = "https://api.telegram.org";

/**
 * Missing credentials or a delivery failure log and return false rather
 * than throwing — alerts are best-effort, they must never take down the
 * buffer computation that triggers them. The return value matters: the
 * caller (monitor.ts) must only record a band as "alerted" when this
 * actually succeeded, or a failed send becomes a silent permanent block on
 * every future real alert for that coin until a worse band or new period
 * comes along.
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("[alerts] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — skipping:", text);
    return false;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[alerts] Telegram sendMessage failed: ${res.status} ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[alerts] Telegram sendMessage threw:", err);
    return false;
  }
}
