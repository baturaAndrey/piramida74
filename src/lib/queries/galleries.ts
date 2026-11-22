import { cacheLife, cacheTag } from "next/cache";
import { asc, eq, inArray } from "drizzle-orm";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { galleries, galleryItems, services } from "@/lib/schema";
import type { HallKind } from "@/lib/schema/enums";
import { loadMedia, type PublicMedia } from "./types";

export type GalleryItemVariant = "default" | "mobile";

export type PublicGalleryItem = {
  id: string;
  caption: string | null;
  /** `mobile` — отдельное мобильное изображение (у hero) */
  variant: GalleryItemVariant;
  media: PublicMedia;
};

export type PublicGallery = {
  key: string;
  title: string;
  items: PublicGalleryItem[];
};

export type ServiceCtaType = "booking" | "callback";

export type PublicService = {
  id: string;
  key: string;
  title: string;
  /** Подзаголовок, описание — второй строкой (рендер `whitespace-pre-line`) */
  subtitle: string | null;
  bullets: string[];
  priceFrom: number | null;
  priceFromHallKind: HallKind | null;
  priceNote: string | null;
  ctaType: ServiceCtaType;
  ctaBlock: string;
  galleryKey: string | null;
  gallery: PublicGalleryItem[];
};

/**
 * Элементы галерей по списку ключей одним запросом (+ один запрос ассетов) → Map key → items.
 * Элементы по `sortOrder`.
 */
async function loadGalleryItems(keys: string[]): Promise<Map<string, PublicGalleryItem[]>> {
  const result = new Map<string, PublicGalleryItem[]>();
  if (keys.length === 0) return result;
  const rows = await db
    .select({
      key: galleries.key,
      id: galleryItems.id,
      caption: galleryItems.caption,
      variant: galleryItems.variant,
      mediaId: galleryItems.mediaId,
    })
    .from(galleryItems)
    .innerJoin(galleries, eq(galleryItems.galleryId, galleries.id))
    .where(inArray(galleries.key, keys))
    .orderBy(asc(galleryItems.sortOrder), asc(galleryItems.id));
  const media = await loadMedia(rows.map((r) => r.mediaId));
  for (const row of rows) {
    const asset = media.get(row.mediaId);
    // FK restrict гарантирует наличие ассета; проверка — на случай гонки с удалением
    if (!asset) continue;
    const list = result.get(row.key) ?? [];
    list.push({
      id: row.id,
      caption: row.caption,
      variant: row.variant === "mobile" ? "mobile" : "default",
      media: asset,
    });
    result.set(row.key, list);
  }
  return result;
}

/**
 * Галерея по ключу (`hero`, `service_*`, `bar`, `about`, `cta`, …).
 * Неизвестный ключ → `null`; пустая галерея → `items: []`.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getGallery(key: string): Promise<PublicGallery | null> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.galleries);
  const [gallery] = await db
    .select({ key: galleries.key, title: galleries.title })
    .from(galleries)
    .where(eq(galleries.key, key))
    .limit(1);
  if (!gallery) return null;
  const items = await loadGalleryItems([gallery.key]);
  return { ...gallery, items: items.get(gallery.key) ?? [] };
}

/**
 * Активные услуги (вкладки «Услуги») по `sortOrder` с фото из галерей `galleryKey`.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getServices(): Promise<PublicService[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.services, TAGS.galleries);
  const rows = await db
    .select({
      id: services.id,
      key: services.key,
      title: services.title,
      subtitle: services.subtitle,
      bullets: services.bullets,
      priceFrom: services.priceFrom,
      priceFromHallKind: services.priceFromHallKind,
      priceNote: services.priceNote,
      ctaType: services.ctaType,
      ctaBlock: services.ctaBlock,
      galleryKey: services.galleryKey,
    })
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(asc(services.sortOrder), asc(services.title));
  const keys = [...new Set(rows.map((r) => r.galleryKey).filter((k): k is string => !!k))];
  const itemsByKey = await loadGalleryItems(keys);
  return rows.map((r) => ({
    ...r,
    // Колонка varchar: неизвестное значение трактуется как default `booking`
    ctaType: r.ctaType === "callback" ? "callback" : "booking",
    gallery: r.galleryKey ? (itemsByKey.get(r.galleryKey) ?? []) : [],
  }));
}
