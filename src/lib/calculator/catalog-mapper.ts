import type { CalcMenuVariant } from "./types";

/**
 * Плоские строки БД (задачи 11/12 выбирают их из menuCategories/menuItems/menuItemVariants/priceGroupTiers).
 * Фильтрация по isActive — ответственность вызывающих.
 */
export interface MenuVariantSourceRows {
  categories: {
    id: string;
    slug: string;
    title: string;
    priceGroupId: string | null;
    sortOrder: number;
  }[];
  items: {
    id: string;
    code: string;
    name: string;
    categoryId: string;
    priceGroupId: string | null;
    sortOrder: number;
  }[]; // только активные
  variants: {
    code: string;
    itemId: string;
    label: string | null;
    price: number;
    sortOrder: number;
  }[]; // только активные
  tiers: { code: string; groupId: string; label: string; price: number; sortOrder: number }[];
}

/** Стабильная сортировка копии — вход не мутируется */
const bySort = <T extends { sortOrder: number }>(list: readonly T[]): T[] =>
  [...list].sort((a, b) => a.sortOrder - b.sortOrder);

function groupBy<T>(list: readonly T[], key: (e: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const e of list) {
    const k = key(e);
    const arr = m.get(k);
    if (arr) arr.push(e);
    else m.set(k, [e]);
  }
  return m;
}

/**
 * Строки меню → варианты калькулятора:
 * собственные варианты позиции → по записи на вариант;
 * иначе сетка `item.priceGroupId ?? category.priceGroupId` → по записи на уровень (`${item.code}-${tier.code}`);
 * иначе позиция пропускается.
 */
export function buildMenuVariants(rows: MenuVariantSourceRows): CalcMenuVariant[] {
  const itemsByCat = groupBy(bySort(rows.items), (i) => i.categoryId);
  const variantsByItem = groupBy(bySort(rows.variants), (v) => v.itemId);
  const tiersByGroup = groupBy(bySort(rows.tiers), (t) => t.groupId);
  const out: CalcMenuVariant[] = [];
  for (const cat of bySort(rows.categories)) {
    for (const item of itemsByCat.get(cat.id) ?? []) {
      const base = { itemName: item.name, categorySlug: cat.slug, categoryName: cat.title };
      const own = variantsByItem.get(item.id);
      if (own?.length) {
        for (const v of own)
          out.push({ ...base, code: v.code, label: v.label ?? "", price: v.price });
        continue;
      }
      const groupId = item.priceGroupId ?? cat.priceGroupId;
      if (!groupId) continue; // ни вариантов, ни сетки — в калькулятор не попадает
      for (const t of tiersByGroup.get(groupId) ?? []) {
        out.push({ ...base, code: `${item.code}-${t.code}`, label: t.label, price: t.price });
      }
    }
  }
  return out;
}
