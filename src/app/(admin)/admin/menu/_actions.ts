"use server";

import { unstable_rethrow } from "next/navigation";
import { and, count, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import { z } from "zod";
import { ActionError, adminAction, type ActionResult } from "@/lib/admin/action";
import { audit, type DbOrTx } from "@/lib/admin/audit";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import {
  menuCategories,
  menuItems,
  menuItemVariants,
  menuModifiers,
  priceGroups,
  priceGroupTiers,
} from "@/lib/schema";
import { requireStaffAction } from "@/lib/session";
import { type BulkChangeRow, computeBulkChanges } from "./_lib/bulk-price";
import { plural } from "./_lib/labels";
import {
  findVariantUsageInSets,
  loadBulkSource,
  newCode,
  uniqueCategorySlug,
  type BulkSharedGroup,
} from "./_queries";
import {
  BULK_MAX_ROWS,
  bulkPriceSchema,
  categorySchema,
  idSchema,
  itemSchema,
  modifierSchema,
  priceGroupSchema,
  quickPriceSchema,
  reorderCategoriesSchema,
  reorderIdsSchema,
  reorderItemsSchema,
  toggleSchema,
} from "./_schema";

/* ---------- Общие помощники ---------- */

/** sortOrder = индекс в переданном порядке; `update` сам ограничивает строки своим родителем */
async function applyOrder(
  ids: string[],
  update: (id: string, sortOrder: number) => Promise<unknown>
): Promise<void> {
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw new ActionError("Повторяющиеся элементы в списке");
  for (const [index, id] of ids.entries()) await update(id, index);
}

/** Блокирует удаление вариантов, которые входят в банкетные сеты */
async function assertVariantsNotInSets(
  tx: DbOrTx,
  variants: { id: string; label: string | null }[],
  itemName: string
): Promise<void> {
  const usage = await findVariantUsageInSets(
    tx,
    variants.map((variant) => variant.id)
  );
  const [first] = usage;
  if (!first) return;
  const variant = variants.find((candidate) => candidate.id === first.variantId);
  const name = variant?.label ? `${itemName} — ${variant.label}` : itemName;
  throw new ActionError(
    `Вариант «${name}» используется в сете «${first.setTitle}». Уберите его из сета`
  );
}

/** Позиции категории без своих вариантов и без своей сетки — живут на сетке категории */
async function countItemsInheritingGroup(tx: DbOrTx, categoryId: string): Promise<number> {
  const [row] = await tx
    .select({ value: count() })
    .from(menuItems)
    .where(
      and(
        eq(menuItems.categoryId, categoryId),
        isNull(menuItems.priceGroupId),
        notExists(
          tx
            .select({ id: menuItemVariants.id })
            .from(menuItemVariants)
            .where(eq(menuItemVariants.itemId, menuItems.id))
        )
      )
    );
  return row?.value ?? 0;
}

/* ---------- Категории ---------- */

export const saveCategory = adminAction(
  categorySchema,
  async (input, ctx) => {
    const { tx } = ctx;
    const existing = input.id
      ? (await tx.select().from(menuCategories).where(eq(menuCategories.id, input.id)).limit(1))[0]
      : undefined;
    if (input.id && !existing) throw new ActionError("Категория не найдена");

    if (input.parentId) {
      if (input.parentId === input.id) {
        throw new ActionError("Категория не может быть родителем самой себе", {
          parentId: ["Выберите другую категорию"],
        });
      }
      const [parent] = await tx
        .select({ id: menuCategories.id, parentId: menuCategories.parentId })
        .from(menuCategories)
        .where(eq(menuCategories.id, input.parentId))
        .limit(1);
      if (!parent) throw new ActionError("Родительская категория не найдена");
      if (parent.parentId) {
        throw new ActionError("Глубина меню — не больше двух уровней", {
          parentId: ["Родителем может быть только категория верхнего уровня"],
        });
      }
      if (input.id) {
        const [children] = await tx
          .select({ value: count() })
          .from(menuCategories)
          .where(eq(menuCategories.parentId, input.id));
        if ((children?.value ?? 0) > 0) {
          throw new ActionError("У категории есть подкатегории — её нельзя сделать вложенной", {
            parentId: ["Сначала перенесите подкатегории"],
          });
        }
      }
    }

    if (input.priceGroupId) {
      const [group] = await tx
        .select({ id: priceGroups.id })
        .from(priceGroups)
        .where(eq(priceGroups.id, input.priceGroupId))
        .limit(1);
      if (!group) throw new ActionError("Сетка цен не найдена");
    } else if (existing?.priceGroupId) {
      const inheriting = await countItemsInheritingGroup(tx, existing.id);
      if (inheriting > 0) {
        const message = `${inheriting} ${plural(inheriting, ["позиция берёт", "позиции берут", "позиций берут"])} цены из сетки категории — задайте им сетку или варианты`;
        throw new ActionError(message, { priceGroupId: [message] });
      }
    }

    const slug = await uniqueCategorySlug(tx, input.slug || input.title, input.id);
    const values = {
      title: input.title,
      slug,
      parentId: input.parentId,
      funFactTitle: input.funFactTitle,
      funFactText: input.funFactText,
      priceGroupId: input.priceGroupId,
      isActive: input.isActive,
    };

    let id: string;
    if (existing) {
      id = existing.id;
      // Перенос к другому родителю — в конец списка нового родителя
      const sortOrder =
        existing.parentId === input.parentId
          ? existing.sortOrder
          : await nextCategorySortOrder(tx, input.parentId);
      await tx
        .update(menuCategories)
        .set({ ...values, sortOrder })
        .where(eq(menuCategories.id, id));
    } else {
      const sortOrder = await nextCategorySortOrder(tx, input.parentId);
      const [row] = await tx
        .insert(menuCategories)
        .values({ ...values, sortOrder })
        .returning({ id: menuCategories.id });
      if (!row) throw new ActionError("Не удалось создать категорию");
      id = row.id;
    }

    await audit(
      ctx.userId,
      existing ? "menu_category.update" : "menu_category.create",
      "menu_category",
      id,
      existing ? { before: existing, after: values } : { after: values },
      tx
    );
    return { id, slug };
  },
  { tags: [TAGS.menu] }
);

async function nextCategorySortOrder(tx: DbOrTx, parentId: string | null): Promise<number> {
  const [row] = await tx
    .select({ value: sql<number>`coalesce(max(${menuCategories.sortOrder}), -1)::int + 1` })
    .from(menuCategories)
    .where(parentId ? eq(menuCategories.parentId, parentId) : isNull(menuCategories.parentId));
  return row?.value ?? 0;
}

export const deleteCategory = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const { tx } = ctx;
    const [category] = await tx
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.id, id))
      .limit(1);
    if (!category) throw new ActionError("Категория не найдена");

    const [items] = await tx
      .select({ value: count() })
      .from(menuItems)
      .where(eq(menuItems.categoryId, id));
    const itemCount = items?.value ?? 0;
    if (itemCount > 0) {
      throw new ActionError(
        `В категории ${itemCount} ${plural(itemCount, ["позиция", "позиции", "позиций"])} — перенесите или удалите их`
      );
    }
    const [children] = await tx
      .select({ value: count() })
      .from(menuCategories)
      .where(eq(menuCategories.parentId, id));
    const childCount = children?.value ?? 0;
    if (childCount > 0) {
      throw new ActionError(
        `В категории ${childCount} ${plural(childCount, ["подкатегория", "подкатегории", "подкатегорий"])} — перенесите или удалите их`
      );
    }

    await tx.delete(menuCategories).where(eq(menuCategories.id, id));
    await audit(ctx.userId, "menu_category.delete", "menu_category", id, { before: category }, tx);
  },
  { tags: [TAGS.menu] }
);

export const toggleCategory = adminAction(
  toggleSchema,
  async ({ id, isActive }, ctx) => {
    const [row] = await ctx.tx
      .update(menuCategories)
      .set({ isActive })
      .where(eq(menuCategories.id, id))
      .returning({ id: menuCategories.id });
    if (!row) throw new ActionError("Категория не найдена");
    await audit(ctx.userId, "menu_category.toggle", "menu_category", id, { isActive }, ctx.tx);
  },
  { tags: [TAGS.menu] }
);

export const reorderCategories = adminAction(
  reorderCategoriesSchema,
  async ({ parentId, ids }, ctx) => {
    const sameParent = parentId
      ? eq(menuCategories.parentId, parentId)
      : isNull(menuCategories.parentId);
    await applyOrder(ids, (id, sortOrder) =>
      ctx.tx
        .update(menuCategories)
        .set({ sortOrder })
        .where(and(eq(menuCategories.id, id), sameParent))
    );
    await audit(
      ctx.userId,
      "menu_category.reorder",
      "menu_category",
      "*",
      { parentId, ids },
      ctx.tx
    );
  },
  { tags: [TAGS.menu] }
);

/* ---------- Позиции ---------- */

export const saveMenuItem = adminAction(
  itemSchema,
  async (input, ctx) => {
    const { tx } = ctx;
    const [category] = await tx
      .select({ id: menuCategories.id, priceGroupId: menuCategories.priceGroupId })
      .from(menuCategories)
      .where(eq(menuCategories.id, input.categoryId))
      .limit(1);
    if (!category) {
      throw new ActionError("Категория не найдена", { categoryId: ["Выберите категорию"] });
    }

    const existing = input.id
      ? (await tx.select().from(menuItems).where(eq(menuItems.id, input.id)).limit(1))[0]
      : undefined;
    if (input.id && !existing) throw new ActionError("Позиция не найдена");

    const isGroup = input.pricingMode === "group";
    const priceGroupId = isGroup ? input.priceGroupId : null;
    if (isGroup) {
      if (priceGroupId) {
        const [group] = await tx
          .select({ id: priceGroups.id })
          .from(priceGroups)
          .where(eq(priceGroups.id, priceGroupId))
          .limit(1);
        if (!group) {
          throw new ActionError("Сетка цен не найдена", { priceGroupId: ["Выберите сетку цен"] });
        }
      } else if (!category.priceGroupId) {
        throw new ActionError("Выберите сетку цен", { priceGroupId: ["Выберите сетку цен"] });
      }
    }

    const values = {
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      choiceNote: input.choiceNote,
      originCountry: input.originCountry,
      priceGroupId,
      imageMediaId: input.imageMediaId,
      isTakeawayDiscount: input.isTakeawayDiscount,
      isActive: input.isActive,
    };

    let id: string;
    let code: string;
    if (existing) {
      id = existing.id;
      code = existing.code; // код стабилен: входит в URL калькулятора
      // Перенос в другую категорию — в конец списка новой категории
      const sortOrder =
        existing.categoryId === input.categoryId
          ? existing.sortOrder
          : await nextItemSortOrder(tx, input.categoryId);
      await tx
        .update(menuItems)
        .set({ ...values, sortOrder })
        .where(eq(menuItems.id, id));
    } else {
      code = await newCode(tx, menuItems);
      const sortOrder = await nextItemSortOrder(tx, input.categoryId);
      const [row] = await tx
        .insert(menuItems)
        .values({ ...values, code, sortOrder })
        .returning({ id: menuItems.id });
      if (!row) throw new ActionError("Не удалось создать позицию");
      id = row.id;
    }

    await syncVariants(tx, id, input.name, isGroup ? [] : input.variants);

    await audit(
      ctx.userId,
      existing ? "menu_item.update" : "menu_item.create",
      "menu_item",
      id,
      { after: input },
      tx
    );
    return { id, code };
  },
  { tags: [TAGS.menu, TAGS.sets] }
);

async function nextItemSortOrder(tx: DbOrTx, categoryId: string): Promise<number> {
  const [row] = await tx
    .select({ value: sql<number>`coalesce(max(${menuItems.sortOrder}), -1)::int + 1` })
    .from(menuItems)
    .where(eq(menuItems.categoryId, categoryId));
  return row?.value ?? 0;
}

type VariantRowInput = z.output<typeof itemSchema>["variants"][number];

/**
 * Синхронизация вариантов по id: существующие обновляются (код не меняется), новые вставляются
 * с новым кодом, отсутствующие в форме удаляются (если не входят в банкетные сеты).
 */
async function syncVariants(
  tx: DbOrTx,
  itemId: string,
  itemName: string,
  variants: VariantRowInput[]
): Promise<void> {
  const current = await tx
    .select({ id: menuItemVariants.id, label: menuItemVariants.label })
    .from(menuItemVariants)
    .where(eq(menuItemVariants.itemId, itemId));
  const currentIds = new Set(current.map((variant) => variant.id));

  const keptIds = new Set<string>();
  for (const variant of variants) {
    if (!variant.id) continue;
    if (!currentIds.has(variant.id)) throw new ActionError("Вариант не найден — обновите страницу");
    if (keptIds.has(variant.id)) throw new ActionError("Повторяющийся вариант");
    keptIds.add(variant.id);
  }

  const removed = current.filter((variant) => !keptIds.has(variant.id));
  if (removed.length > 0) {
    await assertVariantsNotInSets(tx, removed, itemName);
    await tx.delete(menuItemVariants).where(
      inArray(
        menuItemVariants.id,
        removed.map((variant) => variant.id)
      )
    );
  }

  for (const [sortOrder, variant] of variants.entries()) {
    const values = {
      label: variant.label,
      amount: variant.amount,
      unit: variant.unit,
      price: variant.price,
      sortOrder,
    };
    if (variant.id) {
      await tx.update(menuItemVariants).set(values).where(eq(menuItemVariants.id, variant.id));
    } else {
      const code = await newCode(tx, menuItemVariants);
      await tx.insert(menuItemVariants).values({ ...values, itemId, code });
    }
  }
}

export const deleteMenuItem = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const { tx } = ctx;
    const [item] = await tx.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
    if (!item) throw new ActionError("Позиция не найдена");
    const variants = await tx
      .select({ id: menuItemVariants.id, label: menuItemVariants.label })
      .from(menuItemVariants)
      .where(eq(menuItemVariants.itemId, id));
    await assertVariantsNotInSets(tx, variants, item.name);
    // Варианты удаляются каскадом
    await tx.delete(menuItems).where(eq(menuItems.id, id));
    await audit(ctx.userId, "menu_item.delete", "menu_item", id, { before: item }, tx);
  },
  { tags: [TAGS.menu, TAGS.sets] }
);

export const toggleMenuItem = adminAction(
  toggleSchema,
  async ({ id, isActive }, ctx) => {
    const [row] = await ctx.tx
      .update(menuItems)
      .set({ isActive })
      .where(eq(menuItems.id, id))
      .returning({ id: menuItems.id });
    if (!row) throw new ActionError("Позиция не найдена");
    await audit(ctx.userId, "menu_item.toggle", "menu_item", id, { isActive }, ctx.tx);
  },
  { tags: [TAGS.menu] }
);

export const quickSetPrice = adminAction(
  quickPriceSchema,
  async ({ variantId, price }, ctx) => {
    const [before] = await ctx.tx
      .select({ itemId: menuItemVariants.itemId, price: menuItemVariants.price })
      .from(menuItemVariants)
      .where(eq(menuItemVariants.id, variantId))
      .limit(1);
    if (!before) throw new ActionError("Вариант не найден");
    await ctx.tx.update(menuItemVariants).set({ price }).where(eq(menuItemVariants.id, variantId));
    await audit(
      ctx.userId,
      "menu_item.price",
      "menu_item",
      before.itemId,
      { variantId, before: before.price, after: price },
      ctx.tx
    );
    return { price };
  },
  { tags: [TAGS.menu, TAGS.sets] }
);

export const reorderMenuItems = adminAction(
  reorderItemsSchema,
  async ({ categoryId, ids }, ctx) => {
    await applyOrder(ids, (id, sortOrder) =>
      ctx.tx
        .update(menuItems)
        .set({ sortOrder })
        .where(and(eq(menuItems.id, id), eq(menuItems.categoryId, categoryId)))
    );
    await audit(ctx.userId, "menu_item.reorder", "menu_item", "*", { categoryId, ids }, ctx.tx);
  },
  { tags: [TAGS.menu] }
);

/* ---------- Сетки цен ---------- */

export const savePriceGroup = adminAction(
  priceGroupSchema,
  async (input, ctx) => {
    const { tx } = ctx;
    const existing = input.id
      ? (await tx.select().from(priceGroups).where(eq(priceGroups.id, input.id)).limit(1))[0]
      : undefined;
    if (input.id && !existing) throw new ActionError("Сетка цен не найдена");

    let id: string;
    if (existing) {
      id = existing.id;
      await tx
        .update(priceGroups)
        .set({ name: input.name, description: input.description })
        .where(eq(priceGroups.id, id));
    } else {
      const [order] = await tx
        .select({ value: sql<number>`coalesce(max(${priceGroups.sortOrder}), -1)::int + 1` })
        .from(priceGroups);
      const [row] = await tx
        .insert(priceGroups)
        .values({ name: input.name, description: input.description, sortOrder: order?.value ?? 0 })
        .returning({ id: priceGroups.id });
      if (!row) throw new ActionError("Не удалось создать сетку цен");
      id = row.id;
    }

    // Синхронизация уровней по id: код существующих не меняется (входит в URL калькулятора)
    const current = await tx
      .select({ id: priceGroupTiers.id })
      .from(priceGroupTiers)
      .where(eq(priceGroupTiers.groupId, id));
    const currentIds = new Set(current.map((tier) => tier.id));
    const keptIds = new Set<string>();
    for (const tier of input.tiers) {
      if (!tier.id) continue;
      if (!currentIds.has(tier.id)) throw new ActionError("Уровень не найден — обновите страницу");
      if (keptIds.has(tier.id)) throw new ActionError("Повторяющийся уровень");
      keptIds.add(tier.id);
    }
    const removedIds = [...currentIds].filter((tierId) => !keptIds.has(tierId));
    if (removedIds.length > 0) {
      await tx.delete(priceGroupTiers).where(inArray(priceGroupTiers.id, removedIds));
    }
    for (const [sortOrder, tier] of input.tiers.entries()) {
      const values = {
        label: tier.label,
        amount: tier.amount,
        unit: tier.unit,
        price: tier.price,
        sortOrder,
      };
      if (tier.id) {
        await tx.update(priceGroupTiers).set(values).where(eq(priceGroupTiers.id, tier.id));
      } else {
        const code = await newCode(tx, priceGroupTiers);
        await tx.insert(priceGroupTiers).values({ ...values, groupId: id, code });
      }
    }

    await audit(
      ctx.userId,
      existing ? "price_group.update" : "price_group.create",
      "price_group",
      id,
      { after: input, removedTierIds: removedIds },
      tx
    );
    return { id };
  },
  { tags: [TAGS.menu] }
);

export const deletePriceGroup = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const { tx } = ctx;
    const [group] = await tx.select().from(priceGroups).where(eq(priceGroups.id, id)).limit(1);
    if (!group) throw new ActionError("Сетка цен не найдена");
    // В схеме onDelete: set null — без этой проверки позиции молча остались бы без цен
    const [categoryUsage] = await tx
      .select({ value: count() })
      .from(menuCategories)
      .where(eq(menuCategories.priceGroupId, id));
    const [itemUsage] = await tx
      .select({ value: count() })
      .from(menuItems)
      .where(eq(menuItems.priceGroupId, id));
    const categoryCount = categoryUsage?.value ?? 0;
    const itemCount = itemUsage?.value ?? 0;
    if (categoryCount > 0 || itemCount > 0) {
      throw new ActionError(
        `Сетку используют: ${categoryCount} ${plural(categoryCount, ["категория", "категории", "категорий"])}, ${itemCount} ${plural(itemCount, ["позиция", "позиции", "позиций"])}. Сначала отвяжите их`
      );
    }
    // Уровни удаляются каскадом
    await tx.delete(priceGroups).where(eq(priceGroups.id, id));
    await audit(ctx.userId, "price_group.delete", "price_group", id, { before: group }, tx);
  },
  { tags: [TAGS.menu] }
);

/* ---------- Добавки ---------- */

export const saveModifier = adminAction(
  modifierSchema,
  async (input, ctx) => {
    const { tx } = ctx;
    if (input.categoryId) {
      const [category] = await tx
        .select({ id: menuCategories.id })
        .from(menuCategories)
        .where(eq(menuCategories.id, input.categoryId))
        .limit(1);
      if (!category) throw new ActionError("Категория не найдена");
    }
    const values = {
      name: input.name,
      price: input.price,
      categoryId: input.categoryId,
      isActive: input.isActive,
    };
    let id: string;
    if (input.id) {
      const [row] = await tx
        .update(menuModifiers)
        .set(values)
        .where(eq(menuModifiers.id, input.id))
        .returning({ id: menuModifiers.id });
      if (!row) throw new ActionError("Добавка не найдена");
      id = row.id;
    } else {
      const [order] = await tx
        .select({ value: sql<number>`coalesce(max(${menuModifiers.sortOrder}), -1)::int + 1` })
        .from(menuModifiers);
      const [row] = await tx
        .insert(menuModifiers)
        .values({ ...values, sortOrder: order?.value ?? 0 })
        .returning({ id: menuModifiers.id });
      if (!row) throw new ActionError("Не удалось создать добавку");
      id = row.id;
    }
    await audit(
      ctx.userId,
      input.id ? "menu_modifier.update" : "menu_modifier.create",
      "menu_modifier",
      id,
      { after: values },
      tx
    );
    return { id };
  },
  { tags: [TAGS.menu] }
);

export const deleteModifier = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const [row] = await ctx.tx.delete(menuModifiers).where(eq(menuModifiers.id, id)).returning();
    if (!row) throw new ActionError("Добавка не найдена");
    await audit(ctx.userId, "menu_modifier.delete", "menu_modifier", id, { before: row }, ctx.tx);
  },
  { tags: [TAGS.menu] }
);

export const toggleModifier = adminAction(
  toggleSchema,
  async ({ id, isActive }, ctx) => {
    const [row] = await ctx.tx
      .update(menuModifiers)
      .set({ isActive })
      .where(eq(menuModifiers.id, id))
      .returning({ id: menuModifiers.id });
    if (!row) throw new ActionError("Добавка не найдена");
    await audit(ctx.userId, "menu_modifier.toggle", "menu_modifier", id, { isActive }, ctx.tx);
  },
  { tags: [TAGS.menu] }
);

export const reorderModifiers = adminAction(
  reorderIdsSchema,
  async ({ ids }, ctx) => {
    await applyOrder(ids, (id, sortOrder) =>
      ctx.tx.update(menuModifiers).set({ sortOrder }).where(eq(menuModifiers.id, id))
    );
    await audit(ctx.userId, "menu_modifier.reorder", "menu_modifier", "*", { ids }, ctx.tx);
  },
  { tags: [TAGS.menu] }
);

/* ---------- Массовое изменение цен ---------- */

export type BulkPreview = {
  rows: BulkChangeRow[];
  /** Сколько цен рассмотрено в области (включая неизменившиеся) */
  scanned: number;
  sharedGroups: BulkSharedGroup[];
};

/** Не мутация: проверка роли и zod без `adminAction`, без аудита и тегов. */
export async function previewBulkPrice(input: unknown): Promise<ActionResult<BulkPreview>> {
  try {
    await requireStaffAction();
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Нет доступа" };
  }
  const parsed = bulkPriceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте введённые данные",
    };
  }
  try {
    const source = await loadBulkSource(db, parsed.data);
    const rows = computeBulkChanges(source.rows, parsed.data.mode, parsed.data.round);
    return {
      ok: true,
      data: { rows, scanned: source.rows.length, sharedGroups: source.sharedGroups },
    };
  } catch (error) {
    if (error instanceof ActionError) return { ok: false, error: error.message };
    console.error("[previewBulkPrice]", error);
    return { ok: false, error: "Не удалось рассчитать изменения" };
  }
}

/** Размер пакета для UPDATE … FROM (VALUES …) */
const BULK_UPDATE_CHUNK = 500;

async function updatePricesBatch(
  tx: DbOrTx,
  table: "menu_item_variants" | "price_group_tiers",
  rows: BulkChangeRow[]
): Promise<void> {
  for (let start = 0; start < rows.length; start += BULK_UPDATE_CHUNK) {
    const chunk = rows.slice(start, start + BULK_UPDATE_CHUNK);
    const values = sql.join(
      chunk.map((row) => sql`(${row.id}::uuid, ${row.newPrice}::int)`),
      sql`, `
    );
    await tx.execute(
      sql`update ${sql.identifier(table)} as t set price = v.price from (values ${values}) as v(id, price) where t.id = v.id`
    );
  }
}

/** Пересчитывает всё на сервере (предпросмотру клиента не доверяем) и применяет в одной транзакции. */
export const applyBulkPrice = adminAction(
  bulkPriceSchema,
  async (input, ctx) => {
    const source = await loadBulkSource(ctx.tx, input);
    const changes = computeBulkChanges(source.rows, input.mode, input.round);
    if (changes.length === 0) throw new ActionError("Нет цен для изменения");
    if (changes.length > BULK_MAX_ROWS) {
      throw new ActionError(
        `Слишком много цен за раз (${changes.length}). Максимум — ${BULK_MAX_ROWS}, сузьте область`
      );
    }
    const variantRows = changes.filter((row) => row.kind === "variant");
    const tierRows = changes.filter((row) => row.kind === "tier");
    await updatePricesBatch(ctx.tx, "menu_item_variants", variantRows);
    await updatePricesBatch(ctx.tx, "price_group_tiers", tierRows);

    await audit(
      ctx.userId,
      "menu_bulk_price.apply",
      "menu_bulk_price",
      "*",
      {
        scope: {
          categoryId: input.categoryId,
          includeSubcategories: input.includeSubcategories,
          includePriceGroups: input.includePriceGroups,
        },
        mode: input.mode,
        round: input.round,
        count: changes.length,
        sample: changes.slice(0, 20),
      },
      ctx.tx
    );
    return { count: changes.length };
  },
  { tags: [TAGS.menu, TAGS.sets] }
);
