// Изоморфный модуль: подписи и хелперы раздела «Акции» (без серверных импортов).
import { clockToMin, minToClock } from "@/lib/dates";
import type { PromotionTarget } from "@/lib/schema/enums";

export const PROMOTION_TARGETS = [
  "table_rental",
  "menu_category",
  "takeaway",
  "other",
] as const satisfies readonly PromotionTarget[];

export const PROMOTION_TARGET_LABELS: Record<PromotionTarget, string> = {
  table_rental: "Аренда стола",
  menu_category: "Категория меню",
  takeaway: "Заказ на вынос",
  other: "Другое",
};

/** 0 = Вс … 6 = Сб (как `Date.getDay()`); показываем с понедельника */
export const WEEK_DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const WEEK_DAY_SHORT: Record<number, string> = {
  0: "Вс",
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
};
export const DAYS_IN_WEEK = 7;

/** Минуты операционных суток: 1440 — «до 09:00 следующего дня» */
export const OP_DAY_END_MIN = 1440;
/** Окно, заканчивающееся позже 00:00 (900 мин от 09:00), — ночные часы */
export const MIDNIGHT_MIN = 900;
export const OP_DAY_START_CLOCK = "09:00";

/** Пустой массив и «все 7 дней» означают «каждый день» и хранятся как null */
export function normalizeDays(days: number[] | null | undefined): number[] | null {
  if (!days || days.length === 0) return null;
  const unique = [...new Set(days)];
  if (unique.length >= DAYS_IN_WEEK) return null;
  return WEEK_DAYS_ORDER.filter((day) => unique.includes(day));
}

/** Часы «С»/«До» → минуты от 09:00; «до 09:00» — конец операционных суток (1440) */
export function toWindow(
  startClock: string,
  endClock: string
): { startMin: number; endMin: number } {
  const startMin = clockToMin(startClock);
  let endMin = clockToMin(endClock);
  if (endClock === OP_DAY_START_CLOCK) endMin = OP_DAY_END_MIN;
  return { startMin, endMin };
}

export function formatWindow(startMin: number, endMin: number): string {
  // minToClock(1440) тоже даёт «09:00» — следующее утро
  return `${minToClock(startMin)}–${minToClock(endMin)}`;
}

/** Строка условий для списка: «Пн · −50%», «Ежедневно 09:00–12:00» */
export function describeConditions(p: {
  daysOfWeek: number[] | null;
  startMin: number | null;
  endMin: number | null;
  discountPercent: number | null;
}): string {
  const days = normalizeDays(p.daysOfWeek);
  let when = days ? days.map((day) => WEEK_DAY_SHORT[day]).join(", ") : "Ежедневно";
  if (p.startMin !== null && p.endMin !== null) when += ` ${formatWindow(p.startMin, p.endMin)}`;
  const parts = [when];
  if (p.discountPercent !== null) parts.push(`−${p.discountPercent}%`);
  return parts.join(" · ");
}
