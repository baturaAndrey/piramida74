import { cacheLife, cacheTag } from "next/cache";
import { eq } from "drizzle-orm";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media/url";
import { mediaAssets } from "@/lib/schema";

/** Ширина OG-картинки: ближайший вариант ≥ 1280px (рекомендация соцсетей — 1200×630) */
const OG_IMAGE_WIDTH = 1280;

/**
 * Относительный URL OG-картинки главной по id медиа из `settings.seoDefaults` или `null`.
 * Кэш сбрасывается при сохранении настроек (`settings`) и правках медиатеки (`galleries` —
 * его сбрасывают действия медиатеки). Вызывать после `await connection()`.
 */
export async function getHomeOgImage(mediaId: string): Promise<string | null> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.settings, TAGS.galleries);
  const [asset] = await db
    .select({ path: mediaAssets.path, variants: mediaAssets.variants })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaId))
    .limit(1);
  // Пустая строка (нет подходящего варианта) → OG по умолчанию
  return (asset && mediaUrl(asset, OG_IMAGE_WIDTH, "webp")) || null;
}
