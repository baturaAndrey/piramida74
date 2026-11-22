import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import type { CalculatorCatalog } from "@/lib/calculator/types";
import { db } from "@/lib/db";
import { fetchCalculatorCatalog } from "./calculator-fetch";

/**
 * Кэшированный каталог калькулятора для превью на сайте.
 * Данные и порядок — из общего `fetchCalculatorCatalog`, тот же источник использует серверный
 * пересчёт заявки (`loadCatalogForQuote`), поэтому превью и итоговая сумма не расходятся.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getCalculatorCatalog(): Promise<CalculatorCatalog> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.pricing, TAGS.menu, TAGS.sets, TAGS.promotions);

  return fetchCalculatorCatalog(db);
}
