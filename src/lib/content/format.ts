import { TZ } from "@/lib/dates";

/** «20 ноября 2026 г.» → «20 ноября 2026» (часть ICU-сборок добавляет « г.») */
const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: TZ });

/** Дата публикации статьи по Екатеринбургу: «20 ноября 2026». */
export function formatArticleDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return dateFormat.format(date).replace(/\s*г\.$/, "");
}

/** «5 мин чтения»; минимум 1 минута. */
export function readingTimeLabel(minutes: number): string {
  const value = Number.isFinite(minutes) ? Math.max(1, Math.round(minutes)) : 1;
  return `${value} мин чтения`;
}
