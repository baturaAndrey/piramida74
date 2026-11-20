/**
 * Подписи и форматтеры раздела «Цены». Без серверных импортов — используются и в клиентских компонентах.
 */
import { minToClock } from "@/lib/dates";
import type { HallKind, PenaltyKind, PriceUnit, TariffAudience } from "@/lib/schema/enums";
import { OP_DAY_MINUTES, type Hole, type Overlap, type TariffLike } from "./tariff-analysis";

/** Вкладки раздела (`?tab=`) */
export const PRICING_TABS = ["halls", "tariffs", "extras", "penalties"] as const;
export type PricingTab = (typeof PRICING_TABS)[number];
export const DEFAULT_PRICING_TAB: PricingTab = "tariffs";

export const isPricingTab = (v: unknown): v is PricingTab =>
  typeof v === "string" && (PRICING_TABS as readonly string[]).includes(v);

/** Полночь в минутах операционных суток (09:00 + 900 мин = 00:00) */
export const MIDNIGHT_MIN = 900;

/** 0 = воскресенье … 6 = суббота */
export const DAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;

/** Порядок отображения дней: с понедельника */
export const DAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const SUN_THU = [0, 1, 2, 3, 4];
export const FRI_SAT = [5, 6];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Минимальная длина подряд идущих дней, которая сворачивается в диапазон «Пн–Чт» */
const MIN_DAY_RUN = 3;

export const HALL_KIND_LABELS: Record<HallKind, string> = { common: "Общий", vip: "VIP" };

export const AUDIENCE_LABELS: Record<TariffAudience, string> = {
  all: "Все",
  pensioner: "Пенсионный",
};

export const TARIFF_UNIT_LABELS: Record<"per_hour" | "fixed", string> = {
  per_hour: "за час",
  fixed: "за ночь/сеанс, фиксированно",
};

export const EXTRA_UNIT_LABELS: Record<PriceUnit, string> = {
  per_hour: "руб/час",
  per_session: "руб за раз",
  fixed: "руб",
};

export const PENALTY_KIND_LABELS: Record<PenaltyKind, string> = {
  dishware: "Бой посуды",
  property: "Порча имущества",
};

/** Русское склонение: pluralRu(5, ["стол", "стола", "столов"]) → «столов» */
export function pluralRu(n: number, forms: [one: string, few: string, many: string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

const sameSet = (a: number[], b: number[]) =>
  a.length === b.length && a.every((d) => b.includes(d));

/** Дни недели в порядке отображения (Пн … Вс), без повторов */
export function sortDays(days: number[]): number[] {
  return DAY_DISPLAY_ORDER.filter((d) => days.includes(d));
}

/** `[0..4]` → «Вс–Чт», `[5,6]` → «Пт–Сб», все семь → «Ежедневно», иначе «Пн, Ср, Пт» (подряд ≥ 3 → «Пн–Чт») */
export function formatDays(days: number[]): string {
  const unique = [...new Set(days)];
  if (unique.length === 0) return "—";
  if (unique.length === 7) return "Ежедневно";
  if (sameSet(unique, SUN_THU)) return "Вс–Чт";
  if (sameSet(unique, FRI_SAT)) return "Пт–Сб";

  // Позиция в порядке отображения: Пн = 0 … Вс = 6
  const positions = sortDays(unique).map((d) => (d + 6) % 7);
  const dayAt = (pos: number): string => DAY_SHORT[(pos + 1) % 7] ?? "";
  const parts: string[] = [];
  let i = 0;
  while (i < positions.length) {
    // Ищем серию подряд идущих дней
    let j = i;
    while (j + 1 < positions.length && positions[j + 1] === (positions[j] ?? 0) + 1) j++;
    const from = positions[i] ?? 0;
    const to = positions[j] ?? 0;
    if (j - i + 1 >= MIN_DAY_RUN) {
      parts.push(`${dayAt(from)}–${dayAt(to)}`);
    } else {
      for (let k = i; k <= j; k++) parts.push(dayAt(positions[k] ?? 0));
    }
    i = j + 1;
  }
  return parts.join(", ");
}

/** Сдвиг дней на +1 (ночь пятницы → «ночь на Сб») */
export function shiftDays(days: number[]): number[] {
  return days.map((d) => (d + 1) % 7);
}

/** «16:00–02:00» (для `endMin = 1440` → «…–09:00») */
export function formatTimeRange(startMin: number, endMin: number): string {
  return `${minToClock(startMin)}–${minToClock(endMin)}`;
}

/**
 * Серая подпись к времени тарифа:
 * интервал целиком после полуночи → «ночь на Сб»; через полночь → «через полночь (до 02:00 на Сб)».
 */
export function describeRange(startMin: number, endMin: number, days: number[]): string {
  // «ночь на Ежедневно» читается плохо — для всех дней подпись без перечисления
  const everyDay = new Set(days).size === ALL_DAYS.length;
  if (startMin >= MIDNIGHT_MIN) {
    return everyDay ? "ночь, ежедневно" : `ночь на ${formatDays(shiftDays(days))}`;
  }
  if (startMin < MIDNIGHT_MIN && MIDNIGHT_MIN < endMin) {
    const until = everyDay ? "следующего дня" : `на ${formatDays(shiftDays(days))}`;
    return `через полночь (до ${minToClock(endMin)} ${until})`;
  }
  return "";
}

/** Подпись опции времени в Select: «01:00 — ночь», «09:00 (утро следующего дня)» */
export function timeOptionLabel(min: number): string {
  if (min === OP_DAY_MINUTES) return "09:00 (утро следующего дня)";
  return minToClock(min) + (min >= MIDNIGHT_MIN ? " — ночь" : "");
}

export function formatRub(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

/** «640 ₽/час» или «3 500 ₽ за ночь» */
export function formatTariffPrice(price: number, unit: PriceUnit): string {
  if (unit === "per_hour") return `${formatRub(price)}/час`;
  if (unit === "per_session") return `${formatRub(price)} за сеанс`;
  return `${formatRub(price)} за ночь`;
}

/** «250 руб/час», «250 руб за раз» */
export function formatExtraPrice(price: number, unit: PriceUnit): string {
  return `${price.toLocaleString("ru-RU")} ${EXTRA_UNIT_LABELS[unit]}`;
}

/** ISO → «01.12.2026» */
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function formatValidity(validFrom: string | null, validTo: string | null): string {
  if (!validFrom && !validTo) return "Бессрочно";
  if (validFrom && validTo) return `${formatIsoDate(validFrom)}–${formatIsoDate(validTo)}`;
  if (validFrom) return `с ${formatIsoDate(validFrom)}`;
  return `по ${formatIsoDate(validTo ?? "")}`;
}

/** «Будни, день (Вс–Чт, 09:00–16:00)» — для сообщений о конфликтах */
function describeTariff(t: TariffLike & { label?: string }): string {
  const label = t.label?.trim() ? `«${t.label.trim()}»` : "без подписи";
  return `${label} (${formatDays(t.daysOfWeek)}, ${formatTimeRange(t.startMin, t.endMin)})`;
}

/**
 * Сообщение об отклонении сохранения: «Пересечение с тарифом «…» (дни, время). Измените время или дни».
 * `candidateId` — id сохраняемого тарифа: в описании показывается «другой» тариф пары.
 */
export function formatOverlapsForCandidate<T extends TariffLike & { label?: string }>(
  overlaps: Overlap<T>[],
  candidateId: string
): string {
  const others = overlaps.map((o) => (o.a.id === candidateId ? o.b : o.a));
  const list = others.map(describeTariff).join("; ");
  return `Пересечение с тарифом ${list}. Измените время или дни`;
}

/** «Пересечение: «A» (…) и «B» (…) — Пн, Вт» — для блока предупреждений */
export function formatOverlap<T extends TariffLike & { label?: string }>(o: Overlap<T>): string {
  return `${describeTariff(o.a)} и ${describeTariff(o.b)} — ${formatDays(o.days)}`;
}

/** «Общий зал · Пн–Чт · нет тарифа 02:00–03:00» */
export function formatHole(hole: Hole, hallName: string): string {
  return `${hallName} · ${formatDays(hole.days)} · нет тарифа ${formatTimeRange(hole.fromMin, hole.toMin)}`;
}

/** Краткое описание интервала для живой подсказки формы */
export function describeInterval(days: number[], startMin: number, endMin: number): string {
  const night = describeRange(startMin, endMin, days);
  return `${formatDays(days)}, ${formatTimeRange(startMin, endMin)}${night ? ` ${night}` : ""}`;
}
