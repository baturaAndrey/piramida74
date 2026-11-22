/**
 * Типы калькулятора стоимости заказа.
 *
 * Модуль намеренно не зависит от схемы БД: задачи 11/12 приводят строки БД к этим типам.
 * Время задаётся в минутах «операционных суток» (0 = 09:00 даты визита, 1440 = 09:00 следующего дня).
 */

export type CalcHallKind = "common" | "vip";
export type CalcPriceUnit = "per_hour" | "fixed" | "per_session";
export type CalcAudience = "all" | "pensioner";

export interface CalcHall {
  id: string;
  slug: string; // для URL ?hall=
  name: string;
  kind: CalcHallKind;
  tablesCount: number; // у VIP-комнаты = 1
  seatsPerTable: number;
}

export interface CalcTariff {
  id: string;
  hallId: string;
  daysOfWeek: number[]; // 0 = вс … 6 = сб, день D операционных суток
  startMin: number; // минуты от 09:00, 0..1440
  endMin: number;
  price: number; // целые рубли
  priceUnit: CalcPriceUnit;
  audience: CalcAudience;
  label: string;
  validFrom: string | null; // YYYY-MM-DD
  validTo: string | null;
}

export interface CalcExtraService {
  id: string;
  name: string;
  price: number;
  priceUnit: "per_hour" | "per_session";
}

export interface CalcMenuVariant {
  code: string; // variant.code или `${item.code}-${tier.code}` (до 17 символов, [a-z0-9-])
  itemName: string;
  label: string; // variant.label ?? "" или tier.label
  price: number;
  categorySlug: string; // menuCategories.slug категории позиции (группировка в UI)
  categoryName: string; // menuCategories.title
}

export interface CalcSet {
  code: string;
  title: string;
  pricingMode: "per_person" | "fixed";
  price: number;
  minGuests?: number | null;
  maxGuests?: number | null;
}

export interface CalcPromotion {
  id: string;
  title: string;
  discountPercent: number | null;
  daysOfWeek: number[] | null;
  startMin: number | null;
  endMin: number | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface CalculatorCatalog {
  halls: CalcHall[];
  tariffs: CalcTariff[];
  extraServices: CalcExtraService[];
  menuVariants: CalcMenuVariant[];
  sets: CalcSet[];
  promotions: CalcPromotion[];
}

export interface QuoteInput {
  opDate: string; // YYYY-MM-DD, дата визита D
  startMin: number; // минуты от 09:00 D, кратно 30
  durationMin: number; // 30..720, кратно 30
  guests: number;
  hallId: string;
  tables: number;
  pensioner: boolean;
  extras: { id: string; qty: number }[];
  sets: { code: string; qty: number }[];
  items: { code: string; qty: number }[];
}

export type QuoteLineKind = "rental" | "extra" | "set" | "item";

export interface QuoteLine {
  kind: QuoteLineKind;
  label: string;
  qty: number; // может быть дробным (стол-часы, шаг 0.5)
  unitPrice: number;
  total: number; // целые рубли
}

export interface Quote {
  lines: QuoteLine[];
  rentalTotal: number;
  foodTotal: number;
  total: number;
  perGuest: number;
  warnings: string[];
  promoHints: string[];
}
