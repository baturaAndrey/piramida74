// `server-only` намеренно не импортируется (как в rate-limit/request-ip): он бросает вне Next.js (Vitest).
import type { CalculatorCatalog } from "@/lib/calculator";
import { db } from "@/lib/db";
import { fetchCalculatorCatalog } from "@/lib/queries/calculator-fetch";

/**
 * Каталог калькулятора для серверного пересчёта заявки.
 * Намеренно НЕ кэшируется (без 'use cache' / next/cache): сумма заявки считается по свежим ценам.
 * Источник общий с `getCalculatorCatalog` — `fetchCalculatorCatalog`.
 */
export async function loadCatalogForQuote(): Promise<CalculatorCatalog> {
  return fetchCalculatorCatalog(db);
}
