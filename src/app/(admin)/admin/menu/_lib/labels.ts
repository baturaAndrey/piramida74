// Изоморфный модуль: подписи и форматтеры меню для серверных и клиентских компонентов админки.
import type { MeasureUnit } from "@/lib/schema/enums";

export const UNIT_LABELS: Record<MeasureUnit, string> = {
  g: "г",
  ml: "мл",
  l: "л",
  pcs: "шт",
};

export const UNIT_VALUES = ["g", "ml", "l", "pcs"] as const satisfies readonly MeasureUnit[];

const rubFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const amountFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** 1200 → «1 200 ₽» */
export function formatRub(value: number): string {
  return `${rubFormat.format(value)} ₽`;
}

/** Разница со знаком: +50 ₽ / −30 ₽ */
export function formatRubDelta(value: number): string {
  if (value === 0) return formatRub(0);
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatRub(Math.abs(value))}`;
}

/** Выход/объём: (0.3, "l") → «0,3 л»; без количества или единицы — пустая строка */
export function formatAmount(amount: number | null, unit: MeasureUnit | null): string {
  if (amount == null || unit == null) return "";
  return `${amountFormat.format(amount)} ${UNIT_LABELS[unit]}`;
}

/** Подпись варианта для списков: «Малая · 0,3 л»; если нет ни подписи, ни выхода — fallback */
export function formatVariantLabel(
  variant: { label: string | null; amount: number | null; unit: MeasureUnit | null },
  fallback = ""
): string {
  const parts = [variant.label?.trim(), formatAmount(variant.amount, variant.unit)].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

/** Склонение по числу: plural(3, ["позиция", "позиции", "позиций"]) → «позиции» */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}
