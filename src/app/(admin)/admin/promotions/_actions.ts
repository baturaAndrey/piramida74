"use server";

import { and, eq, inArray, max, ne } from "drizzle-orm";
import { ActionError, adminAction } from "@/lib/admin/action";
import { audit, type DbOrTx } from "@/lib/admin/audit";
import { TAGS } from "@/lib/cache-tags";
import { menuCategories, promotions } from "@/lib/schema";
import { slugify } from "@/lib/slug";
import { normalizeDays } from "./_lib/labels";
import { idSchema, promotionSchema, reorderSchema, toggleSchema } from "./_schema";

/** varchar(160) в БД; запас под суффикс «-NN» */
const SLUG_BASE_MAX = 150;
const SLUG_MAX_ATTEMPTS = 20;
const SLUG_FALLBACK = "akciya";

/** Свободный slug: занятый другой акцией получает суффикс `-2`, `-3`… (до 20 попыток). */
async function uniquePromotionSlug(tx: DbOrTx, source: string, excludeId?: string) {
  const base = (slugify(source) || SLUG_FALLBACK).slice(0, SLUG_BASE_MAX).replace(/-+$/, "");
  for (let attempt = 1; attempt <= SLUG_MAX_ATTEMPTS; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const sameSlug = eq(promotions.slug, candidate);
    const [taken] = await tx
      .select({ id: promotions.id })
      .from(promotions)
      .where(excludeId ? and(sameSlug, ne(promotions.id, excludeId)) : sameSlug)
      .limit(1);
    if (!taken) return candidate;
  }
  throw new ActionError("Адрес страницы занят", {
    slug: ["Такой адрес уже занят — укажите другой"],
  });
}

export const savePromotion = adminAction(
  promotionSchema,
  async (input, ctx) => {
    const { id: inputId, ...rest } = input;
    const isMenuTarget = rest.target === "menu_category";
    const values = {
      ...rest,
      daysOfWeek: normalizeDays(rest.daysOfWeek),
      // Категория меню хранится только для цели «Категория меню»
      targetMenuCategoryId: isMenuTarget ? rest.targetMenuCategoryId : null,
      audienceNote: rest.audienceNote || null,
    };

    if (isMenuTarget && values.targetMenuCategoryId) {
      const [category] = await ctx.tx
        .select({ id: menuCategories.id })
        .from(menuCategories)
        .where(eq(menuCategories.id, values.targetMenuCategoryId))
        .limit(1);
      if (!category) {
        throw new ActionError("Категория меню не найдена", {
          targetMenuCategoryId: ["Категория удалена — выберите другую"],
        });
      }
    }

    const slug = await uniquePromotionSlug(ctx.tx, values.slug || values.title, inputId);
    const after = { ...values, slug };

    if (inputId) {
      const [before] = await ctx.tx
        .select()
        .from(promotions)
        .where(eq(promotions.id, inputId))
        .limit(1);
      if (!before) throw new ActionError("Акция не найдена");
      await ctx.tx.update(promotions).set(after).where(eq(promotions.id, inputId));
      await audit(ctx.userId, "promotion.update", "promotion", inputId, { before, after }, ctx.tx);
      return { id: inputId, slug };
    }

    // Новая акция — в конец списка
    const [last] = await ctx.tx.select({ value: max(promotions.sortOrder) }).from(promotions);
    const sortOrder = (last?.value ?? -1) + 1;
    const [row] = await ctx.tx
      .insert(promotions)
      .values({ ...after, sortOrder })
      .returning({ id: promotions.id });
    if (!row) throw new ActionError("Не удалось создать акцию");
    await audit(
      ctx.userId,
      "promotion.create",
      "promotion",
      row.id,
      { after: { ...after, sortOrder } },
      ctx.tx
    );
    return { id: row.id, slug };
  },
  { tags: [TAGS.promotions] }
);

/** Заявки по акции сохраняются: FK `leads.promotion_id` — ON DELETE SET NULL. */
export const deletePromotion = adminAction(
  idSchema,
  async (input, ctx) => {
    const [deleted] = await ctx.tx
      .delete(promotions)
      .where(eq(promotions.id, input.id))
      .returning({ id: promotions.id, title: promotions.title });
    if (!deleted) throw new ActionError("Акция не найдена");
    await audit(
      ctx.userId,
      "promotion.delete",
      "promotion",
      input.id,
      { before: { title: deleted.title } },
      ctx.tx
    );
  },
  { tags: [TAGS.promotions] }
);

export const togglePromotion = adminAction(
  toggleSchema,
  async (input, ctx) => {
    const [row] = await ctx.tx
      .update(promotions)
      .set({ isActive: input.value })
      .where(eq(promotions.id, input.id))
      .returning({ id: promotions.id });
    if (!row) throw new ActionError("Акция не найдена");
    await audit(
      ctx.userId,
      "promotion.toggle",
      "promotion",
      input.id,
      { isActive: input.value },
      ctx.tx
    );
  },
  { tags: [TAGS.promotions] }
);

export const reorderPromotions = adminAction(
  reorderSchema,
  async (input, ctx) => {
    if (new Set(input.ids).size !== input.ids.length) {
      throw new ActionError("Список акций содержит повторы");
    }
    const existing = await ctx.tx
      .select({ id: promotions.id })
      .from(promotions)
      .where(inArray(promotions.id, input.ids));
    if (existing.length !== input.ids.length) {
      throw new ActionError("Список акций устарел. Обновите страницу");
    }
    for (const [index, id] of input.ids.entries()) {
      await ctx.tx.update(promotions).set({ sortOrder: index }).where(eq(promotions.id, id));
    }
    await audit(ctx.userId, "promotion.reorder", "promotion", "*", { ids: input.ids }, ctx.tx);
  },
  { tags: [TAGS.promotions] }
);
