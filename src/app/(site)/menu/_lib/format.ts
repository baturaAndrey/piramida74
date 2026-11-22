import type { MenuPriceTier, MenuVariantNode } from "@/lib/queries/menu";

/** Подписи единиц измерения меню (`measure_unit`) */
export const UNIT_LABEL = { g: "г", ml: "мл", l: "л", pcs: "шт" } as const;

export type MenuUnit = keyof typeof UNIT_LABEL;

/** «1 250 ₽» — `toLocaleString` ставит неразрывный пробел между разрядами */
export const formatPrice = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

/** Выход/объём: 300 → «300 г», 0.5 → «0,5 л»; без количества или единицы — пустая строка */
export function formatAmount(amount: number | string | null, unit: MenuUnit | null): string {
  if (amount == null || unit == null) return "";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  return `${Number.isInteger(n) ? n : String(n).replace(".", ",")} ${UNIT_LABEL[unit]}`;
}

/** Подпись варианта/уровня сетки без цены: «Чайник 600 мл», «0,3 л», «Бокал» */
export function formatPortion(
  entry: Pick<MenuVariantNode | MenuPriceTier, "label" | "amount" | "unit">
) {
  return [entry.label?.trim(), formatAmount(entry.amount, entry.unit)].filter(Boolean).join(" ");
}

/** Минимальная цена списка; `null` для пустого списка */
export function minPrice(list: readonly { price: number }[]): number | null {
  return list.length === 0 ? null : Math.min(...list.map((e) => e.price));
}
