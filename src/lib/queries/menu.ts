import { cacheLife, cacheTag } from "next/cache";
import { asc, eq, inArray } from "drizzle-orm";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import {
  banquetSetItems,
  banquetSets,
  menuCategories,
  menuItems,
  menuItemVariants,
  menuModifiers,
  priceGroups,
  priceGroupTiers,
} from "@/lib/schema";
import type { MeasureUnit, SetPricingMode } from "@/lib/schema/enums";
import { loadMedia, pickMedia, withCovers, type PublicMedia } from "./types";

export type MenuPriceTier = {
  /** `priceGroupTiers.code`; код калькулятора — `${item.code}-${code}` */
  code?: string;
  label: string;
  amount: number | null;
  unit: MeasureUnit | null;
  price: number;
};

export type MenuPriceGroup = { name: string; tiers: MenuPriceTier[] };

export type MenuModifierNode = {
  id: string;
  name: string;
  price: number;
  categoryId: string | null;
};

export type MenuVariantNode = {
  code: string;
  label: string | null;
  amount: number | null;
  unit: MeasureUnit | null;
  price: number;
};

export type MenuItemNode = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  choiceNote: string | null;
  originCountry: string | null;
  isTakeawayDiscount: boolean;
  image: PublicMedia | null;
  /** Сетка цен позиции: своя (`item.priceGroupId`) либо унаследованная от категории, если нет вариантов */
  priceGroup: MenuPriceGroup | null;
  variants: MenuVariantNode[];
};

export type MenuCategoryNode = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  funFactTitle: string | null;
  funFactText: string | null;
  /** Общая сетка цен раздела (Teatone, фирменные чаи, лимонады) */
  priceGroup: MenuPriceGroup | null;
  items: MenuItemNode[];
  children: MenuCategoryNode[];
  /** Добавки, привязанные к этой категории */
  modifiers: MenuModifierNode[];
};

export type MenuTree = {
  /** Корневые категории; у каждой — подкатегории в `children` (два уровня) */
  categories: MenuCategoryNode[];
  /** Все активные добавки (в т.ч. без категории) */
  modifiers: MenuModifierNode[];
};

export type PublicBanquetSet = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  pricingMode: SetPricingMode;
  price: number;
  minGuests: number | null;
  maxGuests: number | null;
  cover: PublicMedia | null;
  items: { label: string; qty: number }[];
};

function groupBy<T>(list: readonly T[], key: (e: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const e of list) {
    const k = key(e);
    if (k == null) continue;
    const arr = map.get(k);
    if (arr) arr.push(e);
    else map.set(k, [e]);
  }
  return map;
}

/** Сетки цен с уровнями → Map по id группы. */
async function loadPriceGroups(): Promise<Map<string, MenuPriceGroup>> {
  const [groups, tiers] = await Promise.all([
    db.select({ id: priceGroups.id, name: priceGroups.name }).from(priceGroups),
    db
      .select({
        groupId: priceGroupTiers.groupId,
        code: priceGroupTiers.code,
        label: priceGroupTiers.label,
        amount: priceGroupTiers.amount,
        unit: priceGroupTiers.unit,
        price: priceGroupTiers.price,
      })
      .from(priceGroupTiers)
      .orderBy(asc(priceGroupTiers.sortOrder), asc(priceGroupTiers.price)),
  ]);
  const tiersByGroup = groupBy(tiers, (t) => t.groupId);
  return new Map(
    groups.map((g) => [
      g.id,
      {
        name: g.name,
        tiers: (tiersByGroup.get(g.id) ?? []).map(({ groupId: _groupId, ...tier }) => tier),
      },
    ])
  );
}

/**
 * Дерево меню: категории (2 уровня) → позиции → варианты / сетки цен, добавки, «интересные факты».
 * Плоские запросы без N+1, сборка в JS; только активные категории/позиции/варианты, порядок — `sortOrder`.
 * Подкатегории неактивной корневой категории не показываются.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getMenuTree(): Promise<MenuTree> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.menu);

  const [categories, items, variants, modifiers, groups] = await Promise.all([
    db
      .select({
        id: menuCategories.id,
        parentId: menuCategories.parentId,
        slug: menuCategories.slug,
        title: menuCategories.title,
        description: menuCategories.description,
        funFactTitle: menuCategories.funFactTitle,
        funFactText: menuCategories.funFactText,
        priceGroupId: menuCategories.priceGroupId,
      })
      .from(menuCategories)
      .where(eq(menuCategories.isActive, true))
      .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.title)),
    db
      .select({
        id: menuItems.id,
        code: menuItems.code,
        categoryId: menuItems.categoryId,
        name: menuItems.name,
        description: menuItems.description,
        choiceNote: menuItems.choiceNote,
        originCountry: menuItems.originCountry,
        isTakeawayDiscount: menuItems.isTakeawayDiscount,
        priceGroupId: menuItems.priceGroupId,
        imageMediaId: menuItems.imageMediaId,
      })
      .from(menuItems)
      .where(eq(menuItems.isActive, true))
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.name)),
    db
      .select({
        itemId: menuItemVariants.itemId,
        code: menuItemVariants.code,
        label: menuItemVariants.label,
        amount: menuItemVariants.amount,
        unit: menuItemVariants.unit,
        price: menuItemVariants.price,
      })
      .from(menuItemVariants)
      .where(eq(menuItemVariants.isActive, true))
      .orderBy(asc(menuItemVariants.sortOrder), asc(menuItemVariants.price)),
    db
      .select({
        id: menuModifiers.id,
        name: menuModifiers.name,
        price: menuModifiers.price,
        categoryId: menuModifiers.categoryId,
      })
      .from(menuModifiers)
      .where(eq(menuModifiers.isActive, true))
      .orderBy(asc(menuModifiers.sortOrder), asc(menuModifiers.name)),
    loadPriceGroups(),
  ]);

  const media = await loadMedia(items.map((i) => i.imageMediaId));
  const variantsByItem = groupBy(variants, (v) => v.itemId);
  const itemsByCategory = groupBy(items, (i) => i.categoryId);
  const modifiersByCategory = groupBy(modifiers, (m) => m.categoryId);
  const childrenByParent = groupBy(categories, (c) => c.parentId);
  const groupOf = (id: string | null) => (id ? (groups.get(id) ?? null) : null);

  const buildCategory = (
    cat: (typeof categories)[number],
    children: MenuCategoryNode[]
  ): MenuCategoryNode => {
    const categoryGroup = groupOf(cat.priceGroupId);
    return {
      id: cat.id,
      slug: cat.slug,
      title: cat.title,
      description: cat.description,
      funFactTitle: cat.funFactTitle,
      funFactText: cat.funFactText,
      priceGroup: categoryGroup,
      items: (itemsByCategory.get(cat.id) ?? []).map((item) => {
        const itemVariants = (variantsByItem.get(item.id) ?? []).map(
          ({ itemId: _itemId, ...v }) => v
        );
        return {
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          choiceNote: item.choiceNote,
          originCountry: item.originCountry,
          isTakeawayDiscount: item.isTakeawayDiscount,
          image: pickMedia(media, item.imageMediaId),
          // Та же логика, что в buildMenuVariants: свои варианты важнее сетки категории
          priceGroup:
            groupOf(item.priceGroupId) ?? (itemVariants.length === 0 ? categoryGroup : null),
          variants: itemVariants,
        };
      }),
      children,
      modifiers: modifiersByCategory.get(cat.id) ?? [],
    };
  };

  const roots = categories
    .filter((c) => c.parentId == null)
    .map((root) =>
      buildCategory(
        root,
        (childrenByParent.get(root.id) ?? []).map((child) => buildCategory(child, []))
      )
    );

  return { categories: roots, modifiers };
}

/**
 * Активные банкетные сеты с составом и обложкой, по `sortOrder`.
 * `label` элемента — `customLabel` либо «<название позиции> <метка варианта>».
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getBanquetSets(): Promise<PublicBanquetSet[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.sets, TAGS.menu);

  const sets = await db
    .select({
      id: banquetSets.id,
      code: banquetSets.code,
      title: banquetSets.title,
      description: banquetSets.description,
      pricingMode: banquetSets.pricingMode,
      price: banquetSets.price,
      minGuests: banquetSets.minGuests,
      maxGuests: banquetSets.maxGuests,
      coverMediaId: banquetSets.coverMediaId,
    })
    .from(banquetSets)
    .where(eq(banquetSets.isActive, true))
    .orderBy(asc(banquetSets.sortOrder), asc(banquetSets.title));
  if (sets.length === 0) return [];

  const [setItems, withMedia] = await Promise.all([
    db
      .select({
        setId: banquetSetItems.setId,
        customLabel: banquetSetItems.customLabel,
        qty: banquetSetItems.qty,
        itemName: menuItems.name,
        variantLabel: menuItemVariants.label,
      })
      .from(banquetSetItems)
      .leftJoin(menuItemVariants, eq(banquetSetItems.menuItemVariantId, menuItemVariants.id))
      .leftJoin(menuItems, eq(menuItemVariants.itemId, menuItems.id))
      .where(
        inArray(
          banquetSetItems.setId,
          sets.map((s) => s.id)
        )
      )
      .orderBy(asc(banquetSetItems.sortOrder)),
    withCovers(sets),
  ]);

  const itemsBySet = groupBy(setItems, (i) => i.setId);
  return withMedia.map((set) => ({
    ...set,
    items: (itemsBySet.get(set.id) ?? []).flatMap((i) => {
      const custom = i.customLabel?.trim();
      const label =
        custom ||
        [i.itemName, i.variantLabel]
          .filter((s) => s && s.trim())
          .join(" ")
          .trim();
      // Строка без своей подписи, чей вариант меню удалён, — показывать нечего
      return label ? [{ label, qty: i.qty }] : [];
    }),
  }));
}
