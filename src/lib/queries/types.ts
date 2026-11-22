import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { mediaAssets, type MediaVariant } from "@/lib/schema";

/**
 * Медиа-ассет в публичной выдаче (сериализуемый).
 * Структурно совпадает с `PictureAsset` из `src/lib/media/url.ts` (задача 09).
 */
export type PublicMedia = {
  id: string;
  path: string;
  width: number;
  height: number;
  blurDataUrl: string;
  alt: string;
  variants: MediaVariant[];
};

/** Строка `media_assets` → `PublicMedia` (только поля, нужные для `<Picture>`). */
export function toPublicMedia(
  row: typeof mediaAssets.$inferSelect | null | undefined
): PublicMedia | null {
  if (!row) return null;
  return {
    id: row.id,
    path: row.path,
    width: row.width,
    height: row.height,
    blurDataUrl: row.blurDataUrl,
    alt: row.alt,
    // jsonb может прийти не массивом при ручной правке БД — не роняем рендер
    variants: Array.isArray(row.variants) ? row.variants.map((v) => ({ ...v })) : [],
  };
}

/**
 * Загружает ассеты одним запросом по списку id → Map (присоединение без N+1).
 * Не кэшируется сама: вызывается изнутри `'use cache'` запросов.
 */
export async function loadMedia(
  ids: (string | null | undefined)[]
): Promise<Map<string, PublicMedia>> {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string"))];
  const map = new Map<string, PublicMedia>();
  if (unique.length === 0) return map;
  const rows = await db.select().from(mediaAssets).where(inArray(mediaAssets.id, unique));
  for (const row of rows) {
    const media = toPublicMedia(row);
    if (media) map.set(media.id, media);
  }
  return map;
}

/** Достаёт ассет из Map по nullable id. */
export function pickMedia(
  map: Map<string, PublicMedia>,
  id: string | null | undefined
): PublicMedia | null {
  return id ? (map.get(id) ?? null) : null;
}

/**
 * Присоединяет обложки (`coverMediaId` → `cover`) одним запросом
 * и убирает служебное поле `coverMediaId` из результата.
 */
export async function withCovers<T extends { coverMediaId: string | null }>(
  rows: T[]
): Promise<(Omit<T, "coverMediaId"> & { cover: PublicMedia | null })[]> {
  const media = await loadMedia(rows.map((r) => r.coverMediaId));
  return rows.map(({ coverMediaId, ...rest }) => ({
    ...rest,
    cover: pickMedia(media, coverMediaId),
  }));
}
