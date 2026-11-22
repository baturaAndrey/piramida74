import type { PriceUnit } from "@/lib/schema/enums";

/** «1 250 ₽» — `toLocaleString` ставит неразрывный пробел между разрядами */
export const formatPrice = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

/** Цена тарифа аренды: «580 ₽/час», «3 500 ₽ за ночь», «900 ₽ за сеанс» */
export function formatTariffPrice(price: number, unit: PriceUnit): string {
  switch (unit) {
    case "per_hour":
      return `${formatPrice(price)}/час`;
    case "fixed":
      return `${formatPrice(price)} за ночь`;
    case "per_session":
      return `${formatPrice(price)} за сеанс`;
  }
}

/** Цена доп. услуги: почасовая — «250 ₽/час», иначе «250 ₽» */
export function formatServicePrice(price: number, unit: PriceUnit): string {
  return unit === "per_hour" ? `${formatPrice(price)}/час` : formatPrice(price);
}

/** Штраф: `priceIsMinimum` → «от 500 ₽» */
export function formatPenaltyPrice(price: number, isMinimum: boolean): string {
  return isMinimum ? `от ${formatPrice(price)}` : formatPrice(price);
}

/** "2026-12-31" → "31.12" */
export function formatDayMonth(iso: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[2]}.${match[1]}` : iso;
}

/** Русское склонение: plural(5, ["стол", "стола", "столов"]) → «столов» */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
