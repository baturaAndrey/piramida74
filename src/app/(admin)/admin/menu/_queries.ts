import "server-only";
import { asc, count, eq, inArray, isNotNull } from "drizzle-orm";
import { ActionError } from "@/lib/admin/action";
import type { DbOrTx } from "@/lib/admin/audit";
import { type MediaDto, toMediaDto } from "@/lib/admin/media-dto";
import { db } from "@/lib/db";
import {
  banquetSetItems,
  banquetSets,
  mediaAssets,
  menuCategories,
  menuItems,
  menuItemVariants,
  menuModifiers,
  priceGroups,
  priceGroupTiers,
} from "@/lib/schema";
import type { MeasureUnit } from "@/lib/schema/enums";
import { nanoCode, slugify } from "@/lib/slug";
import { formatVariantLabel } from "./_lib/labels";
import type { BulkSourceRow } from "./_lib/bulk-price";
import type { BulkPriceOutput } from "./_schema";

// Админка читает БД напрямую и без 'use cache': владелец всегда видит актуальные данные.

/* ---------- Типы ---------- */

export type AdminCategory = {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  funFactTitle: string | null;
  funFactText: string | null;
  priceGroupId: string | null;
  priceGroupName: string | null;
  isActive: boolean;
  itemCount: number;
  children: AdminCategory[];
};

/** Плоский вариант дерева для Select'ов: подкатегории идут сразу после родителя */
export type CategoryOption = {
  id: string;
  title: string;
  depth: 0 | 1;
  parentId: string | null;
  hasChildren: boolean;
  priceGroupId: string | null;
  priceGroupName: string | null;
};

export type AdminTier = {
  id: string;
  code: string;
  label: string;
  amount: number | null;
  unit: MeasureUnit | null;
  price: number;
};

export type AdminPriceGroup = {
  id: string;
  name: string;
  description: string | null;
  tiers: AdminTier[];
  categoryCount: number;
  itemCount: number;
};

export type AdminVariant = {
  id: string;
  code: string;
  label: string | null;
  amount: number | null;
  unit: MeasureUnit | null;
  price: number;
};

export type AdminMenuItemRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  /** Своя сетка позиции */
  priceGroupName: string | null;
  variants: AdminVariant[];
};

export type AdminMenuItem = {
  id: string;
  code: string;
  categoryId: string;
  name: string;
  description: string | null;
  choiceNote: string | null;
  originCountry: string | null;
  priceGroupId: string | null;
  imageMediaId: string | null;
  image: MediaDto | null;
  isTakeawayDiscount: boolean;
  isActive: boolean;
  variants: AdminVariant[];
};

export type AdminModifier = {
  id: string;
  name: string;
  price: number;
  categoryId: string | null;
  isActive: boolean;
};

/* ---------- Коды и slug ---------- */

type CodeTable =
  typeof menuItems | typeof menuItemVariants | typeof banquetSets | typeof priceGroupTiers;

/**
 * Новый уникальный код строки (`nanoCode()`); вызывается только при создании строки —
 * коды входят в URL калькулятора и никогда не перегенерируются.
 */
export async function newCode(tx: DbOrTx, table: CodeTable): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = nanoCode();
    const [hit] = await tx
      .select({ id: table.id })
      .from(table as typeof menuItems)
      .where(eq(table.code, code))
      .limit(1);
    if (!hit) return code;
  }
  throw new ActionError("Не удалось сгенерировать код");
}

const SLUG_MAX = 120;
const SLUG_FALLBACK = "category";

/** Уникальный slug категории: при коллизии добавляется суффикс `-2`, `-3`… */
export async function uniqueCategorySlug(
  tx: DbOrTx,
  source: string,
  excludeId?: string
): Promise<string> {
  const base = (slugify(source) || SLUG_FALLBACK).slice(0, SLUG_MAX - 4);
  const rows = await tx
    .select({ id: menuCategories.id, slug: menuCategories.slug })
    .from(menuCategories);
  const taken = new Set(rows.filter((row) => row.id !== excludeId).map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new ActionError("Не удалось подобрать адрес категории");
}

/* ---------- Категории ---------- */

/** Все категории одним запросом + число позиций группировкой; дерево собирается в JS */
export async function listCategoryTree(): Promise<AdminCategory[]> {
  const [categories, counts] = await Promise.all([
    db
      .select({
        id: menuCategories.id,
        parentId: menuCategories.parentId,
        title: menuCategories.title,
        slug: menuCategories.slug,
        funFactTitle: menuCategories.funFactTitle,
        funFactText: menuCategories.funFactText,
        priceGroupId: menuCategories.priceGroupId,
        priceGroupName: priceGroups.name,
        isActive: menuCategories.isActive,
      })
      .from(menuCategories)
      .leftJoin(priceGroups, eq(priceGroups.id, menuCategories.priceGroupId))
      .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.title)),
    db
      .select({ categoryId: menuItems.categoryId, value: count() })
      .from(menuItems)
      .groupBy(menuItems.categoryId),
  ]);

  const countBy = new Map(counts.map((row) => [row.categoryId, row.value]));
  const nodes = new Map<string, AdminCategory>(
    categories.map((row) => [row.id, { ...row, itemCount: countBy.get(row.id) ?? 0, children: [] }])
  );
  const roots: AdminCategory[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function flattenCategoryTree(tree: AdminCategory[]): CategoryOption[] {
  const result: CategoryOption[] = [];
  for (const root of tree) {
    result.push(toOption(root, 0));
    for (const child of root.children) result.push(toOption(child, 1));
  }
  return result;
}

function toOption(node: AdminCategory, depth: 0 | 1): CategoryOption {
  return {
    id: node.id,
    title: node.title,
    depth,
    parentId: node.parentId,
    hasChildren: node.children.length > 0,
    priceGroupId: node.priceGroupId,
    priceGroupName: node.priceGroupName,
  };
}

/* ---------- Сетки цен ---------- */

export async function listPriceGroups(): Promise<AdminPriceGroup[]> {
  const [groups, tiers, categoryUsage, itemUsage] = await Promise.all([
    db
      .select({ id: priceGroups.id, name: priceGroups.name, description: priceGroups.description })
      .from(priceGroups)
      .orderBy(asc(priceGroups.sortOrder), asc(priceGroups.name)),
    db
      .select({
        id: priceGroupTiers.id,
        groupId: priceGroupTiers.groupId,
        code: priceGroupTiers.code,
        label: priceGroupTiers.label,
        amount: priceGroupTiers.amount,
        unit: priceGroupTiers.unit,
        price: priceGroupTiers.price,
      })
      .from(priceGroupTiers)
      .orderBy(asc(priceGroupTiers.sortOrder)),
    db
      .select({ groupId: menuCategories.priceGroupId, value: count() })
      .from(menuCategories)
      .where(isNotNull(menuCategories.priceGroupId))
      .groupBy(menuCategories.priceGroupId),
    db
      .select({ groupId: menuItems.priceGroupId, value: count() })
      .from(menuItems)
      .where(isNotNull(menuItems.priceGroupId))
      .groupBy(menuItems.priceGroupId),
  ]);

  const categoryCount = new Map(categoryUsage.map((row) => [row.groupId, row.value]));
  const itemCount = new Map(itemUsage.map((row) => [row.groupId, row.value]));
  return groups.map((group) => ({
    ...group,
    tiers: tiers
      .filter((tier) => tier.groupId === group.id)
      .map(({ groupId: _groupId, ...tier }) => tier),
    categoryCount: categoryCount.get(group.id) ?? 0,
    itemCount: itemCount.get(group.id) ?? 0,
  }));
}

/* ---------- Позиции ---------- */

async function loadVariants(itemIds: string[]): Promise<Map<string, AdminVariant[]>> {
  const byItem = new Map<string, AdminVariant[]>();
  if (itemIds.length === 0) return byItem;
  // Один запрос на все позиции категории — без N+1
  const rows = await db
    .select({
      id: menuItemVariants.id,
      itemId: menuItemVariants.itemId,
      code: menuItemVariants.code,
      label: menuItemVariants.label,
      amount: menuItemVariants.amount,
      unit: menuItemVariants.unit,
      price: menuItemVariants.price,
    })
    .from(menuItemVariants)
    .where(inArray(menuItemVariants.itemId, itemIds))
    .orderBy(asc(menuItemVariants.sortOrder));
  for (const { itemId, ...variant } of rows) {
    const list = byItem.get(itemId);
    if (list) list.push(variant);
    else byItem.set(itemId, [variant]);
  }
  return byItem;
}

export async function listCategoryItems(categoryId: string): Promise<AdminMenuItemRow[]> {
  const items = await db
    .select({
      id: menuItems.id,
      code: menuItems.code,
      name: menuItems.name,
      description: menuItems.description,
      isActive: menuItems.isActive,
      priceGroupName: priceGroups.name,
    })
    .from(menuItems)
    .leftJoin(priceGroups, eq(priceGroups.id, menuItems.priceGroupId))
    .where(eq(menuItems.categoryId, categoryId))
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.name));
  const variants = await loadVariants(items.map((item) => item.id));
  return items.map((item) => ({ ...item, variants: variants.get(item.id) ?? [] }));
}

export async function getMenuItem(id: string): Promise<AdminMenuItem | null> {
  const [row] = await db
    .select({ item: menuItems, image: mediaAssets })
    .from(menuItems)
    .leftJoin(mediaAssets, eq(mediaAssets.id, menuItems.imageMediaId))
    .where(eq(menuItems.id, id))
    .limit(1);
  if (!row) return null;
  const { item, image } = row;
  const variants = await loadVariants([item.id]);
  return {
    id: item.id,
    code: item.code,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    choiceNote: item.choiceNote,
    originCountry: item.originCountry,
    priceGroupId: item.priceGroupId,
    imageMediaId: item.imageMediaId,
    image: image ? toMediaDto(image) : null,
    isTakeawayDiscount: item.isTakeawayDiscount,
    isActive: item.isActive,
    variants: variants.get(item.id) ?? [],
  };
}

/* ---------- Добавки ---------- */

export async function listModifiers(): Promise<AdminModifier[]> {
  return db
    .select({
      id: menuModifiers.id,
      name: menuModifiers.name,
      price: menuModifiers.price,
      categoryId: menuModifiers.categoryId,
      isActive: menuModifiers.isActive,
    })
    .from(menuModifiers)
    .orderBy(asc(menuModifiers.sortOrder), asc(menuModifiers.name));
}

/* ---------- Массовое изменение цен ---------- */

export type BulkSharedGroup = { name: string; outsideCategories: number; outsideItems: number };

export type BulkSource = {
  rows: BulkSourceRow[];
  /** Сетки в области, которые используются и вне её (предупреждение в форме) */
  sharedGroups: BulkSharedGroup[];
};

/**
 * Строки для массового изменения цен (общая для предпросмотра и применения).
 * Область: всё меню или категория (опционально с подкатегориями). Неактивные позиции тоже входят.
 * Сетки цен в области — сетки категорий области и своих сеток позиций области;
 * для «Всего меню» — все сетки.
 */
export async function loadBulkSource(
  conn: DbOrTx,
  input: Pick<BulkPriceOutput, "categoryId" | "includeSubcategories" | "includePriceGroups">
): Promise<BulkSource> {
  const categories = await conn
    .select({
      id: menuCategories.id,
      parentId: menuCategories.parentId,
      priceGroupId: menuCategories.priceGroupId,
    })
    .from(menuCategories);

  let scopeIds: Set<string> | null = null;
  if (input.categoryId) {
    const root = categories.find((category) => category.id === input.categoryId);
    if (!root) throw new ActionError("Категория не найдена");
    scopeIds = new Set([root.id]);
    if (input.includeSubcategories) {
      for (const category of categories) {
        if (category.parentId === root.id) scopeIds.add(category.id);
      }
    }
  }
  const inScope = (categoryId: string) => scopeIds === null || scopeIds.has(categoryId);

  const variantRows = await conn
    .select({
      id: menuItemVariants.id,
      label: menuItemVariants.label,
      amount: menuItemVariants.amount,
      unit: menuItemVariants.unit,
      price: menuItemVariants.price,
      itemName: menuItems.name,
      categoryId: menuItems.categoryId,
    })
    .from(menuItemVariants)
    .innerJoin(menuItems, eq(menuItems.id, menuItemVariants.itemId))
    .where(scopeIds ? inArray(menuItems.categoryId, [...scopeIds]) : undefined)
    .orderBy(asc(menuItems.categoryId), asc(menuItems.sortOrder), asc(menuItemVariants.sortOrder));

  const rows: BulkSourceRow[] = variantRows.map((variant) => ({
    kind: "variant",
    id: variant.id,
    itemName: variant.itemName,
    label: formatVariantLabel(variant),
    oldPrice: variant.price,
  }));

  const sharedGroups: BulkSharedGroup[] = [];
  if (!input.includePriceGroups) return { rows, sharedGroups };

  const itemGroupRows = await conn
    .select({ categoryId: menuItems.categoryId, priceGroupId: menuItems.priceGroupId })
    .from(menuItems)
    .where(isNotNull(menuItems.priceGroupId));

  const groups = await conn
    .select({ id: priceGroups.id, name: priceGroups.name })
    .from(priceGroups)
    .orderBy(asc(priceGroups.sortOrder), asc(priceGroups.name));

  const groupIdsInScope = new Set<string>();
  if (scopeIds === null) {
    for (const group of groups) groupIdsInScope.add(group.id);
  } else {
    for (const category of categories) {
      if (category.priceGroupId && inScope(category.id)) groupIdsInScope.add(category.priceGroupId);
    }
    for (const item of itemGroupRows) {
      if (item.priceGroupId && inScope(item.categoryId)) groupIdsInScope.add(item.priceGroupId);
    }
  }
  if (groupIdsInScope.size === 0) return { rows, sharedGroups };

  const tiers = await conn
    .select({
      id: priceGroupTiers.id,
      groupId: priceGroupTiers.groupId,
      label: priceGroupTiers.label,
      price: priceGroupTiers.price,
    })
    .from(priceGroupTiers)
    .where(inArray(priceGroupTiers.groupId, [...groupIdsInScope]))
    .orderBy(asc(priceGroupTiers.sortOrder));

  for (const group of groups) {
    if (!groupIdsInScope.has(group.id)) continue;
    for (const tier of tiers) {
      if (tier.groupId !== group.id) continue;
      rows.push({
        kind: "tier",
        id: tier.id,
        itemName: `Сетка: ${group.name}`,
        label: tier.label,
        oldPrice: tier.price,
      });
    }
    if (scopeIds !== null) {
      const outsideCategories = categories.filter(
        (category) => category.priceGroupId === group.id && !inScope(category.id)
      ).length;
      const outsideItems = itemGroupRows.filter(
        (item) => item.priceGroupId === group.id && !inScope(item.categoryId)
      ).length;
      if (outsideCategories > 0 || outsideItems > 0) {
        sharedGroups.push({ name: group.name, outsideCategories, outsideItems });
      }
    }
  }
  return { rows, sharedGroups };
}

/** Сеты, где используются варианты: для сообщений «Вариант «…» используется в сете «…»» */
export async function findVariantUsageInSets(
  conn: DbOrTx,
  variantIds: string[]
): Promise<{ variantId: string; setTitle: string }[]> {
  if (variantIds.length === 0) return [];
  return conn
    .selectDistinct({
      variantId: banquetSetItems.menuItemVariantId,
      setTitle: banquetSets.title,
    })
    .from(banquetSetItems)
    .innerJoin(banquetSets, eq(banquetSets.id, banquetSetItems.setId))
    .where(inArray(banquetSetItems.menuItemVariantId, variantIds))
    .then((rows) =>
      rows.flatMap((row) =>
        row.variantId ? [{ variantId: row.variantId, setTitle: row.setTitle }] : []
      )
    );
}
