import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { toMediaDto, type MediaDto } from "@/lib/admin/media-dto";
import { db } from "@/lib/db";
import { galleries, galleryItems, mediaAssets, services } from "@/lib/schema";
import { SYSTEM_GALLERY_KEYS, galleryLabel, isSystemGalleryKey } from "./_lib/labels";

export type AdminGalleryListItem = {
  key: string;
  title: string;
  /** Подпись для списка: у системных — из labels.ts */
  label: string;
  isSystem: boolean;
  itemCount: number;
};

export type AdminGalleryItem = {
  id: string;
  caption: string;
  variant: string;
  media: MediaDto;
};

export type AdminGalleryDetail = {
  key: string;
  title: string;
  label: string;
  isSystem: boolean;
  items: AdminGalleryItem[];
  /** Услуги, привязанные к галерее (`services.galleryKey`) */
  services: { id: string; title: string }[];
};

/**
 * Все галереи из БД: системные — в порядке SYSTEM_GALLERY_KEYS, затем прочие по названию.
 * Системные ключи, которых ещё нет в БД, тоже показываются (строка создаётся при первом фото).
 */
export async function listAdminGalleries(): Promise<AdminGalleryListItem[]> {
  const rows = await db
    .select({ key: galleries.key, title: galleries.title, itemCount: count(galleryItems.id) })
    .from(galleries)
    .leftJoin(galleryItems, eq(galleryItems.galleryId, galleries.id))
    .groupBy(galleries.id)
    .orderBy(asc(galleries.title));

  const byKey = new Map(rows.map((row) => [row.key, row]));
  const system = SYSTEM_GALLERY_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      title: row?.title ?? galleryLabel(key),
      label: galleryLabel(key),
      isSystem: true,
      itemCount: row?.itemCount ?? 0,
    };
  });
  const custom = rows
    .filter((row) => !isSystemGalleryKey(row.key))
    .map((row) => ({
      key: row.key,
      title: row.title,
      label: galleryLabel(row.key, row.title),
      isSystem: false,
      itemCount: row.itemCount,
    }));
  return [...system, ...custom];
}

/** Галерея для редактора; `null` — ключа нет ни в БД, ни среди системных. */
export async function getAdminGallery(key: string): Promise<AdminGalleryDetail | null> {
  const [gallery] = await db
    .select({ id: galleries.id, key: galleries.key, title: galleries.title })
    .from(galleries)
    .where(eq(galleries.key, key))
    .limit(1);

  const isSystem = isSystemGalleryKey(key);
  if (!gallery && !isSystem) return null;

  const [items, linkedServices] = await Promise.all([
    gallery
      ? db
          .select({
            id: galleryItems.id,
            caption: galleryItems.caption,
            variant: galleryItems.variant,
            media: mediaAssets,
          })
          .from(galleryItems)
          .innerJoin(mediaAssets, eq(galleryItems.mediaId, mediaAssets.id))
          .where(eq(galleryItems.galleryId, gallery.id))
          .orderBy(asc(galleryItems.sortOrder), asc(galleryItems.id))
      : Promise.resolve([]),
    db
      .select({ id: services.id, title: services.title })
      .from(services)
      .where(eq(services.galleryKey, key))
      .orderBy(asc(services.sortOrder)),
  ]);

  return {
    key,
    title: gallery?.title ?? galleryLabel(key),
    label: galleryLabel(key, gallery?.title),
    isSystem,
    items: items.map((item) => ({
      id: item.id,
      caption: item.caption ?? "",
      variant: item.variant,
      media: toMediaDto(item.media),
    })),
    services: linkedServices,
  };
}
