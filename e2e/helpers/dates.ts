/** Даты для e2e в зоне клуба (Asia/Yekaterinburg), чтобы тесты не «протухали». */
export const TZ = "Asia/Yekaterinburg";
const DAY_MS = 86_400_000;
const fmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Календарная дата в зоне клуба, формат YYYY-MM-DD. */
export function ymd(date: Date): string {
  return fmt.format(date);
}

/** Сегодня (календарная дата в зоне клуба), сдвинутое на `offsetDays`. */
export function todayPlus(offsetDays = 0, from = new Date()): string {
  return ymd(new Date(from.getTime() + offsetDays * DAY_MS));
}

/** Ближайший (строго после сегодня) день недели dow (0=вс … 6=сб) в зоне клуба, формат YYYY-MM-DD. */
export function nextWeekday(dow: number, from = new Date()): string {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(from.getTime() + i * DAY_MS);
    const wd = new Date(`${ymd(d)}T12:00:00Z`).getUTCDay();
    if (wd === dow) return ymd(d);
  }
  throw new Error("unreachable");
}

/** Час начала операционных суток клуба (как OP_DAY_START_HOUR в src/lib/dates.ts). */
const OP_DAY_START_HOUR = 9;
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" });

/**
 * Операционная дата клуба (до 09:00 — ещё предыдущий день), сдвинутая на `offsetDays`.
 * Сайт отбирает «ближайшие турниры» по ней (`getOpDate`), поэтому тесты, сравнивающие
 * с «сегодня», должны использовать её, иначе падают между 00:00 и 09:00.
 */
export function opDatePlus(offsetDays = 0, from = new Date()): string {
  const beforeOpStart = Number(hourFmt.format(from)) < OP_DAY_START_HOUR;
  return todayPlus(offsetDays - (beforeOpStart ? 1 : 0), from);
}
