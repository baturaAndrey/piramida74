import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { type MediaDto, toMediaDto } from "@/lib/admin/media-dto";
import { db } from "@/lib/db";
import {
  banquetSetItems,
  banquetSets,
  mediaAssets,
  menuCategories,
  menuItems,
  menuItemVariants,
} from "@/lib/schema";
import type { SetPricingMode } from "@/lib/schema/enums";
import { formatVariantLabel } from "../menu/_lib/labels";

// Без 'use cache': админка всегда видит актуальные данные.

export type AdminSetRow = {
  id: string;
  code: string;
  title: string;
  cover: MediaDto | null;
  pricingMode: SetPricingMode;
  price: number;
  minGuests: number | null;
  maxGuests: number | null;
  isActive: boolean;
  itemCount: number;
};

export type AdminSetItem = {
  kind: "menu" | "custom";
  menuItemVariantId: string | null;
  customLabel: string | null;
  qty: number;
};

export type AdminSet = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  coverMediaId: string | null;
  cover: MediaDto | null;
  pricingMode: SetPricingMode;
  price: number;
  minGuests: number | null;
  maxGuests: number | null;
  isActive: boolean;
  items: AdminSetItem[];
};

export type VariantOption = {
  id: string;
  code: string;
  itemName: string;
  label: string;
  price: number;
  /** Позиция или категория скрыта на сайте */
  inactive: boolean;
};

export async function listSets(): Promise<AdminSetRow[]> {
  const [rows, counts] = await Promise.all([
    db
      .select({ set: banquetSets, cover: mediaAssets })
      .from(banquetSets)
      .leftJoin(mediaAssets, eq(mediaAssets.id, banquetSets.coverMediaId))
      .orderBy(asc(banquetSets.sortOrder), asc(banquetSets.title)),
    db
      .select({ setId: banquetSetItems.setId, value: count() })
      .from(banquetSetItems)
      .groupBy(banquetSetItems.setId),
  ]);
  const countBy = new Map(counts.map((row) => [row.setId, row.value]));
  return rows.map(({ set, cover }) => ({
    id: set.id,
    code: set.code,
    title: set.title,
    cover: cover ? toMediaDto(cover) : null,
    pricingMode: set.pricingMode,
    price: set.price,
    minGuests: set.minGuests,
    maxGuests: set.maxGuests,
    isActive: set.isActive,
    itemCount: countBy.get(set.id) ?? 0,
  }));
}

export async function getSet(id: string): Promise<AdminSet | null> {
  const [row] = await db
    .select({ set: banquetSets, cover: mediaAssets })
    .from(banquetSets)
    .leftJoin(mediaAssets, eq(mediaAssets.id, banquetSets.coverMediaId))
    .where(eq(banquetSets.id, id))
    .limit(1);
  if (!row) return null;
  const { set, cover } = row;
  const items = await db
    .select({
      menuItemVariantId: banquetSetItems.menuItemVariantId,
      customLabel: banquetSetItems.customLabel,
      qty: banquetSetItems.qty,
    })
    .from(banquetSetItems)
    .where(eq(banquetSetItems.setId, id))
    .orderBy(asc(banquetSetItems.sortOrder));
  return {
    id: set.id,
    code: set.code,
    title: set.title,
    description: set.description,
    coverMediaId: set.coverMediaId,
    cover: cover ? toMediaDto(cover) : null,
    pricingMode: set.pricingMode,
    price: set.price,
    minGuests: set.minGuests,
    maxGuests: set.maxGuests,
    isActive: set.isActive,
    items: items.map((item) =>
      item.menuItemVariantId
        ? {
            kind: "menu",
            menuItemVariantId: item.menuItemVariantId,
            customLabel: null,
            qty: item.qty,
          }
        : {
            kind: "custom",
            menuItemVariantId: null,
            // Вариант мог быть удалён (onDelete: set null) — строка становится пустым «своим текстом»
            customLabel: item.customLabel ?? "",
            qty: item.qty,
          }
    ),
  };
}

/** Все варианты позиций меню для выбора в составе сета (одним запросом) */
export async function listVariantOptions(): Promise<VariantOption[]> {
  const rows = await db
    .select({
      id: menuItemVariants.id,
      code: menuItemVariants.code,
      label: menuItemVariants.label,
      amount: menuItemVariants.amount,
      unit: menuItemVariants.unit,
      price: menuItemVariants.price,
      itemName: menuItems.name,
      itemActive: menuItems.isActive,
      categoryActive: menuCategories.isActive,
    })
    .from(menuItemVariants)
    .innerJoin(menuItems, eq(menuItems.id, menuItemVariants.itemId))
    .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
    .orderBy(
      asc(menuCategories.sortOrder),
      asc(menuItems.sortOrder),
      asc(menuItemVariants.sortOrder)
    );
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    itemName: row.itemName,
    label: formatVariantLabel(row),
    price: row.price,
    inactive: !row.itemActive || !row.categoryActive,
  }));
}
