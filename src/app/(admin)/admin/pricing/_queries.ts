import "server-only";
import { asc } from "drizzle-orm";
import { getToday } from "@/lib/dates";
import { db } from "@/lib/db";
import { extraServices, halls, penaltyItems, rentalTariffs } from "@/lib/schema";
import { analyzeTariffs } from "./_lib/tariff-analysis";

/** Данные раздела «Цены» без кэша: админка всегда видит актуальное состояние БД. */
export async function getPricingAdminData() {
  const [hallRows, tariffRows, extraRows, penaltyRows] = await Promise.all([
    db.select().from(halls).orderBy(asc(halls.sortOrder), asc(halls.name)),
    db.select().from(rentalTariffs).orderBy(asc(rentalTariffs.sortOrder)),
    db.select().from(extraServices).orderBy(asc(extraServices.sortOrder), asc(extraServices.name)),
    db.select().from(penaltyItems).orderBy(asc(penaltyItems.sortOrder), asc(penaltyItems.name)),
  ]);
  const warnings = analyzeTariffs(
    tariffRows,
    hallRows.filter((h) => h.isActive).map((h) => h.id),
    getToday()
  );
  return {
    halls: hallRows,
    tariffs: tariffRows,
    extras: extraRows,
    penalties: penaltyRows,
    warnings,
  };
}

export type PricingAdminData = Awaited<ReturnType<typeof getPricingAdminData>>;
