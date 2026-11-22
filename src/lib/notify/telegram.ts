import { getServerEnv } from "@/lib/env";

/** Лимит длины текста сообщения Telegram Bot API */
export const TELEGRAM_MAX_LENGTH = 4096;
const TELEGRAM_TIMEOUT_MS = 5000;

/** Экранирует пользовательские значения для HTML (Telegram parse_mode=HTML и письма). `&` — первым. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Отправляет HTML-сообщение в чат. Никогда не бросает; токен не попадает ни в логи, ни в результат. */
export async function sendTelegram(html: string): Promise<{ ok: boolean; error?: string }> {
  let token: string | undefined;
  let chatId: string | undefined;
  try {
    const env = getServerEnv();
    token = env.TELEGRAM_BOT_TOKEN;
    chatId = env.TELEGRAM_CHAT_ID;
  } catch {
    return { ok: false, error: "invalid_env" };
  }
  if (!token || !chatId) {
    console.warn("[notify/telegram] бот не настроен — сообщение пропущено");
    return { ok: false, error: "not_configured" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html.slice(0, TELEGRAM_MAX_LENGTH),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!res.ok || json.ok !== true) {
      const error = `telegram http ${res.status}: ${json.description ?? "unknown"}`;
      console.error("[notify/telegram]", error);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    // Текст исходной ошибки fetch не логируем: в нём может оказаться URL с токеном
    const timeout =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    const error = timeout ? "timeout" : "network_error";
    console.error("[notify/telegram] request failed:", error);
    return { ok: false, error };
  }
}
