import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { toMediaDto, type MediaDto } from "@/lib/admin/media-dto";
import { db } from "@/lib/db";
import { mediaAssets, menuCategories, promotions, type Promotion } from "@/lib/schema";

/** Строка списка акций (сериализуемая — уходит в клиентский список) */
export type PromotionRow = {
  id: string;
  title: string;
  daysOfWeek: number[] | null;
  startMin: number | null;
  endMin: number | null;
  discountPercent: number | null;
  validTo: string | null;
  showInCarousel: boolean;
  isActive: boolean;
  cover: MediaDto | null;
};

export type MenuCategoryOption = { id: string; title: string; parentTitle: string | null };

export async function listPromotions(): Promise<PromotionRow[]> {
  const rows = await db
    .select({
      id: promotions.id,
      title: promotions.title,
      daysOfWeek: promotions.daysOfWeek,
      startMin: promotions.startMin,
      endMin: promotions.endMin,
      discountPercent: promotions.discountPercent,
      validTo: promotions.validTo,
      showInCarousel: promotions.showInCarousel,
      isActive: promotions.isActive,
      cover: mediaAssets,
    })
    .from(promotions)
    .leftJoin(mediaAssets, eq(promotions.coverMediaId, mediaAssets.id))
    .orderBy(asc(promotions.sortOrder), asc(promotions.title));
  return rows.map(({ cover, ...row }) => ({ ...row, cover: cover ? toMediaDto(cover) : null }));
}

export type PromotionWithCover = { promotion: Promotion; cover: MediaDto | null };

export async function getPromotion(id: string): Promise<PromotionWithCover | null> {
  const [row] = await db
    .select({ promotion: promotions, cover: mediaAssets })
    .from(promotions)
    .leftJoin(mediaAssets, eq(promotions.coverMediaId, mediaAssets.id))
    .where(eq(promotions.id, id))
    .limit(1);
  if (!row) return null;
  return { promotion: row.promotion, cover: row.cover ? toMediaDto(row.cover) : null };
}

/** Категории меню для выбора цели акции: «Родитель → Категория» */
export async function listMenuCategoryOptions(): Promise<MenuCategoryOption[]> {
  const parent = alias(menuCategories, "parent");
  return (
    db
      .select({
        id: menuCategories.id,
        title: menuCategories.title,
        parentTitle: parent.title,
      })
      .from(menuCategories)
      .leftJoin(parent, eq(menuCategories.parentId, parent.id))
      // Группируем по корневой категории: сначала сама корневая, затем её подкатегории
      .orderBy(
        sql`coalesce(${parent.sortOrder}, ${menuCategories.sortOrder})`,
        sql`coalesce(${parent.id}, ${menuCategories.id})`,
        desc(sql`${parent.id} is null`),
        asc(menuCategories.sortOrder),
        asc(menuCategories.title)
      )
  );
}
