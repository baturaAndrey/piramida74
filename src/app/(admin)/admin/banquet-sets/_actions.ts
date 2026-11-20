"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { ActionError, adminAction } from "@/lib/admin/action";
import { audit } from "@/lib/admin/audit";
import { TAGS } from "@/lib/cache-tags";
import { banquetSetItems, banquetSets, menuItemVariants } from "@/lib/schema";
import { idSchema, reorderSchema, setSchema, toggleSchema } from "./_schema";
import { newCode } from "../menu/_queries";

/** Создание/редактирование сета; состав синхронизируется заменой в той же транзакции. */
export const saveSet = adminAction(
  setSchema,
  async (input, ctx) => {
    const { tx } = ctx;
    const existing = input.id
      ? (await tx.select().from(banquetSets).where(eq(banquetSets.id, input.id)).limit(1))[0]
      : undefined;
    if (input.id && !existing) throw new ActionError("Сет не найден");

    const variantIds = [
      ...new Set(
        input.items.flatMap((item) => (item.menuItemVariantId ? [item.menuItemVariantId] : []))
      ),
    ];
    if (variantIds.length > 0) {
      const found = await tx
        .select({ id: menuItemVariants.id })
        .from(menuItemVariants)
        .where(inArray(menuItemVariants.id, variantIds));
      if (found.length !== variantIds.length) {
        throw new ActionError("Позиция меню не найдена — обновите страницу и выберите заново");
      }
    }

    const values = {
      title: input.title,
      description: input.description,
      coverMediaId: input.coverMediaId,
      pricingMode: input.pricingMode,
      price: input.price,
      minGuests: input.minGuests,
      maxGuests: input.maxGuests,
      isActive: input.isActive,
    };

    let id: string;
    let code: string;
    if (existing) {
      id = existing.id;
      code = existing.code; // код стабилен: входит в URL калькулятора (?s=<code>:8)
      await tx.update(banquetSets).set(values).where(eq(banquetSets.id, id));
    } else {
      code = await newCode(tx, banquetSets);
      const [order] = await tx
        .select({ value: sql<number>`coalesce(max(${banquetSets.sortOrder}), -1)::int + 1` })
        .from(banquetSets);
      const [row] = await tx
        .insert(banquetSets)
        .values({ ...values, code, sortOrder: order?.value ?? 0 })
        .returning({ id: banquetSets.id });
      if (!row) throw new ActionError("Не удалось создать сет");
      id = row.id;
    }

    await tx.delete(banquetSetItems).where(eq(banquetSetItems.setId, id));
    if (input.items.length > 0) {
      await tx.insert(banquetSetItems).values(
        input.items.map((item, sortOrder) => ({
          setId: id,
          menuItemVariantId: item.menuItemVariantId,
          customLabel: item.customLabel,
          qty: item.qty,
          sortOrder,
        }))
      );
    }

    await audit(
      ctx.userId,
      existing ? "banquet_set.update" : "banquet_set.create",
      "banquet_set",
      id,
      { after: input },
      tx
    );
    return { id, code };
  },
  { tags: [TAGS.sets] }
);

export const deleteSet = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    // Состав удаляется каскадом
    const [row] = await ctx.tx.delete(banquetSets).where(eq(banquetSets.id, id)).returning();
    if (!row) throw new ActionError("Сет не найден");
    await audit(ctx.userId, "banquet_set.delete", "banquet_set", id, { before: row }, ctx.tx);
  },
  { tags: [TAGS.sets] }
);

export const toggleSet = adminAction(
  toggleSchema,
  async ({ id, isActive }, ctx) => {
    const [row] = await ctx.tx
      .update(banquetSets)
      .set({ isActive })
      .where(eq(banquetSets.id, id))
      .returning({ id: banquetSets.id });
    if (!row) throw new ActionError("Сет не найден");
    await audit(ctx.userId, "banquet_set.toggle", "banquet_set", id, { isActive }, ctx.tx);
  },
  { tags: [TAGS.sets] }
);

export const reorderSets = adminAction(
  reorderSchema,
  async ({ ids }, ctx) => {
    if (new Set(ids).size !== ids.length) throw new ActionError("Повторяющиеся элементы в списке");
    for (const [sortOrder, id] of ids.entries()) {
      await ctx.tx.update(banquetSets).set({ sortOrder }).where(eq(banquetSets.id, id));
    }
    await audit(ctx.userId, "banquet_set.reorder", "banquet_set", "*", { ids }, ctx.tx);
  },
  { tags: [TAGS.sets] }
);
