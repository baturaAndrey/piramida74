import { TZ } from "@/lib/dates";

/**
 * Момент времени → значение `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`)
 * по часовому поясу клуба (Asia/Yekaterinburg). Обратное преобразование —
 * `parseLocalDateTime` из `src/lib/dates.ts`. Изоморфный модуль.
 */

// sv-SE даёт «2026-12-05 19:00» — ISO-подобный порядок полей
const localFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function toLocalInputValue(date: Date): string {
  const parts: Record<string, string> = {};
  for (const p of localFmt.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  // Некоторые сборки ICU выводят полночь как «24» даже с h23
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}
