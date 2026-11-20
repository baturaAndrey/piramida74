/**
 * Типы данных seed. Модули `scripts/seed-data/*.ts` — только типизированные константы
 * (без обращений к БД); запись в БД делает `scripts/seed.ts`.
 *
 * Union-типы enum'ов берутся из схемы, чтобы данные seed не разошлись с БД.
 */
import type {
  Discipline,
  HallKind,
  LegalDocType,
  MeasureUnit,
  PenaltyKind,
  PriceUnit,
  PromotionTarget,
  SetPricingMode,
  TariffAudience,
  TournamentLevel,
} from "../../src/lib/schema/enums";

export type Unit = MeasureUnit;

// ── Залы, тарифы, доп. услуги, штрафы ──────────────────────────────────────

export type SeedHall = {
  name: string;
  slug: string;
  kind: HallKind;
  tablesCount: number;
  seatsPerTable: number;
};

export type SeedTariff = {
  /** slug зала из SEED_HALLS */
  hallSlug: string;
  /** 0 = вс … 6 = сб — день D начала операционных суток */
  daysOfWeek: number[];
  /** Минуты от 09:00 операционных суток */
  startMin: number;
  endMin: number;
  price: number;
  priceUnit: PriceUnit;
  audience: TariffAudience;
  label: string;
};

export type SeedExtraService = {
  name: string;
  price: number;
  priceUnit: PriceUnit;
};

export type SeedPenalty = {
  kind: PenaltyKind;
  name: string;
  price: number;
  priceIsMinimum?: boolean;
};

// ── Турниры ────────────────────────────────────────────────────────────────

export type SeedTournamentSeries = {
  slug: string;
  name: string;
  description: string;
};

export type SeedTournament = {
  title: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  /** slug серии и номер тура — только у серийных турниров */
  series?: { slug: string; stage: number };
  discipline: Discipline | null;
  level: TournamentLevel;
  categories: string[];
};

// ── Акции ──────────────────────────────────────────────────────────────────

export type SeedPromotion = {
  slug: string;
  title: string;
  shortText: string;
  /** markdown */
  description: string;
  discountPercent: number | null;
  daysOfWeek: number[] | null;
  startMin: number | null;
  endMin: number | null;
  target: PromotionTarget;
  /** slug категории меню — только для target = menu_category */
  targetMenuCategorySlug?: string;
  audienceNote: string | null;
  showInCarousel: boolean;
  sortOrder: number;
};

// ── Меню ───────────────────────────────────────────────────────────────────

export type SeedVariant = {
  label?: string;
  amount?: number;
  unit?: Unit;
  price: number;
};

export type SeedItem = {
  name: string;
  /** Состав / описание — дословно из источника */
  description?: string;
  /** Выбор без изменения цены: «рис / овсянка» */
  choiceNote?: string;
  /** Пиво: «Чехия» */
  originCountry?: string;
  /** По умолчанию берётся из категории */
  takeawayDiscount?: boolean;
  /** Короткая форма одной цены (взаимоисключающе с variants) */
  price?: number;
  amount?: number;
  unit?: Unit;
  /** Явный список вариантов */
  variants?: SeedVariant[];
};

export type SeedModifier = { name: string; price: number };

export type SeedCategory = {
  slug: string;
  title: string;
  /** funFactTitle = «Интересный факт», funFactText = цитата из источника */
  funFact?: string;
  /** key общей сетки цен (SEED_PRICE_GROUPS) */
  priceGroup?: string;
  takeawayDiscount: boolean;
  items: SeedItem[];
  children?: SeedCategory[];
  modifiers?: SeedModifier[];
};

export type SeedPriceGroupTier = { label: string; amount: number; unit: Unit; price: number };

export type SeedPriceGroup = {
  key: string;
  name: string;
  tiers: SeedPriceGroupTier[];
};

// ── Банкетные сеты ─────────────────────────────────────────────────────────

export type SeedBanquetSetItem = {
  /** Точное название позиции меню (menuItems.name) */
  itemName: string;
  qty: number;
};

export type SeedBanquetSet = {
  title: string;
  description: string;
  pricingMode: SetPricingMode;
  minGuests: number;
  maxGuests: number;
  /** Число гостей, на которое делится сумма состава (только для per_person) */
  pricePerPersonDivisor?: number;
  items: SeedBanquetSetItem[];
};

// ── Контент ────────────────────────────────────────────────────────────────

export type SeedService = {
  key: "russian" | "american" | "vip" | "training";
  title: string;
  subtitle: string;
  bullets: string[];
  priceFrom: number | null;
  priceFromHallKind: HallKind | null;
  priceNote: string | null;
  ctaBlock: string;
  ctaType: "booking" | "callback";
  galleryKey: string;
};

export type SeedGallery = { key: string; title: string };

export type SeedLegalDocument = {
  type: LegalDocType;
  version: string;
  title: string;
  body: string;
};
