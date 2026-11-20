import { cacheLife, cacheTag } from "next/cache";
import { and, asc, eq, min } from "drizzle-orm";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { extraServices, halls, penaltyItems, rentalTariffs } from "@/lib/schema";
import type { HallKind, PenaltyKind, PriceUnit, TariffAudience } from "@/lib/schema/enums";

export type PublicHall = {
  id: string;
  name: string;
  slug: string;
  kind: HallKind;
  tablesCount: number;
  seatsPerTable: number;
  description: string | null;
};

export type PublicTariff = {
  id: string;
  hallId: string;
  hallName: string;
  hallKind: HallKind;
  /** 0 = вс … 6 = сб, день операционных суток */
  daysOfWeek: number[];
  /** Минуты от 09:00 операционных суток */
  startMin: number;
  endMin: number;
  price: number;
  priceUnit: PriceUnit;
  audience: TariffAudience;
  label: string;
  validFrom: string | null;
  validTo: string | null;
  sortOrder: number;
};

export type PublicExtraService = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  priceUnit: PriceUnit;
};

export type PublicPenalty = {
  id: string;
  kind: PenaltyKind;
  name: string;
  price: number;
  priceIsMinimum: boolean;
};

/**
 * Активные залы по `sortOrder`.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getHalls(): Promise<PublicHall[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.pricing);
  return db
    .select({
      id: halls.id,
      name: halls.name,
      slug: halls.slug,
      kind: halls.kind,
      tablesCount: halls.tablesCount,
      seatsPerTable: halls.seatsPerTable,
      description: halls.description,
    })
    .from(halls)
    .where(eq(halls.isActive, true))
    .orderBy(asc(halls.sortOrder), asc(halls.name));
}

/**
 * Все активные тарифы активных залов (включая пенсионные и ограниченные по сроку —
 * фильтрацию по дате действия делают потребители). Порядок: зал, затем тариф по `sortOrder`.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getTariffs(): Promise<PublicTariff[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.pricing);
  const rows = await db
    .select({
      id: rentalTariffs.id,
      hallId: rentalTariffs.hallId,
      hallName: halls.name,
      hallKind: halls.kind,
      daysOfWeek: rentalTariffs.daysOfWeek,
      startMin: rentalTariffs.startMin,
      endMin: rentalTariffs.endMin,
      price: rentalTariffs.price,
      priceUnit: rentalTariffs.priceUnit,
      audience: rentalTariffs.audience,
      label: rentalTariffs.label,
      validFrom: rentalTariffs.validFrom,
      validTo: rentalTariffs.validTo,
      sortOrder: rentalTariffs.sortOrder,
    })
    .from(rentalTariffs)
    .innerJoin(halls, eq(rentalTariffs.hallId, halls.id))
    .where(and(eq(rentalTariffs.isActive, true), eq(halls.isActive, true)))
    .orderBy(asc(halls.sortOrder), asc(rentalTariffs.sortOrder), asc(rentalTariffs.startMin));
  return rows;
}

/**
 * Активные доп. услуги (нарды/шахматы, прокат кия, тренер) по `sortOrder`.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getExtraServices(): Promise<PublicExtraService[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.pricing);
  return db
    .select({
      id: extraServices.id,
      name: extraServices.name,
      description: extraServices.description,
      price: extraServices.price,
      priceUnit: extraServices.priceUnit,
    })
    .from(extraServices)
    .where(eq(extraServices.isActive, true))
    .orderBy(asc(extraServices.sortOrder), asc(extraServices.name));
}

/**
 * Активные штрафы: сначала по `kind`, затем по `sortOrder`.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getPenalties(): Promise<PublicPenalty[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.pricing);
  return db
    .select({
      id: penaltyItems.id,
      kind: penaltyItems.kind,
      name: penaltyItems.name,
      price: penaltyItems.price,
      priceIsMinimum: penaltyItems.priceIsMinimum,
    })
    .from(penaltyItems)
    .where(eq(penaltyItems.isActive, true))
    .orderBy(asc(penaltyItems.kind), asc(penaltyItems.sortOrder));
}

/**
 * Минимальная почасовая цена (₽/час) среди активных тарифов `audience = 'all'`
 * активных залов указанного вида; `null`, если таких тарифов нет.
 * Пенсионные тарифы и тарифы с другой единицей на минимум не влияют.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getPriceFrom(hallKind: HallKind): Promise<number | null> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.pricing);
  const [row] = await db
    .select({ price: min(rentalTariffs.price) })
    .from(rentalTariffs)
    .innerJoin(halls, eq(rentalTariffs.hallId, halls.id))
    .where(
      and(
        eq(rentalTariffs.isActive, true),
        eq(rentalTariffs.priceUnit, "per_hour"),
        eq(rentalTariffs.audience, "all"),
        eq(halls.isActive, true),
        eq(halls.kind, hallKind)
      )
    );
  return row?.price == null ? null : Number(row.price);
}
