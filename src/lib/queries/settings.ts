import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { siteSettings } from "@/lib/schema";
import { mergeSettings, type SiteSettings } from "@/lib/settings-defaults";

/**
 * Настройки сайта с дефолтами (пустая таблица → `SETTINGS_DEFAULTS`).
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getSettings(): Promise<SiteSettings> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.settings);
  const rows = await db
    .select({ key: siteSettings.key, value: siteSettings.value })
    .from(siteSettings);
  return mergeSettings(rows);
}
