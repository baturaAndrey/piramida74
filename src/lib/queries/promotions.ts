import { cacheLife, cacheTag } from "next/cache";
import { and, asc, eq, gte, isNull, lte, or, type SQL } from "drizzle-orm";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { promotions } from "@/lib/schema";
import type { PromotionTarget } from "@/lib/schema/enums";
import { withCovers, type PublicMedia } from "./types";

export type PublicPromotion = {
  id: string;
  slug: string;
  title: string;
  shortText: string;
  /** markdown */
  description: string;
  discountPercent: number | null;
  /** 0 = вс … 6 = сб; null = каждый день */
  daysOfWeek: number[] | null;
  /** Минуты от 09:00 операционных суток */
  startMin: number | null;
  endMin: number | null;
  target: PromotionTarget;
  targetMenuCategoryId: string | null;
  audienceNote: string | null;
  validFrom: string | null;
  validTo: string | null;
  showInCarousel: boolean;
  cover: PublicMedia | null;
};

/** Активные акции, действующие на `opDate`, с необязательным дополнительным условием. */
async function selectPromotions(opDate: string, extra?: SQL): Promise<PublicPromotion[]> {
  const rows = await db
    .select({
      id: promotions.id,
      slug: promotions.slug,
      title: promotions.title,
      shortText: promotions.shortText,
      description: promotions.description,
      discountPercent: promotions.discountPercent,
      daysOfWeek: promotions.daysOfWeek,
      startMin: promotions.startMin,
      endMin: promotions.endMin,
      target: promotions.target,
      targetMenuCategoryId: promotions.targetMenuCategoryId,
      audienceNote: promotions.audienceNote,
      validFrom: promotions.validFrom,
      validTo: promotions.validTo,
      showInCarousel: promotions.showInCarousel,
      coverMediaId: promotions.coverMediaId,
    })
    .from(promotions)
    .where(
      and(
        eq(promotions.isActive, true),
        or(isNull(promotions.validFrom), lte(promotions.validFrom, opDate)),
        or(isNull(promotions.validTo), gte(promotions.validTo, opDate)),
        extra
      )
    )
    .orderBy(asc(promotions.sortOrder), asc(promotions.title));
  return withCovers(rows);
}

/**
 * Активные акции, действующие на операционную дату `opDate` (`getOpDate()`, YYYY-MM-DD).
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getActivePromotions(opDate: string): Promise<PublicPromotion[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.promotions);
  return selectPromotions(opDate);
}

/**
 * Акции для карусели: как `getActivePromotions` + `showInCarousel = true`.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getCarouselPromotions(opDate: string): Promise<PublicPromotion[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.promotions);
  return selectPromotions(opDate, eq(promotions.showInCarousel, true));
}
