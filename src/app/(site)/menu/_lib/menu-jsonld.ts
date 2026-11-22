import type { MenuCategoryNode, MenuItemNode, MenuTree } from "@/lib/queries/menu";
import { minPrice } from "./format";

/**
 * JSON-LD `Menu` страницы `/menu`. Общий `menuJsonLd` из `@/lib/seo/jsonld` не умеет
 * вложенные разделы, поэтому дерево (категория → подкатегории) строится здесь.
 * Результат сериализуется через `jsonLdScript`.
 */

type JsonLdOffer = { "@type": "Offer"; price: string; priceCurrency: "RUB" };

type JsonLdMenuItem = {
  "@type": "MenuItem";
  name: string;
  description?: string;
  offers?: JsonLdOffer;
};

type JsonLdMenuSection = {
  "@type": "MenuSection";
  name: string;
  hasMenuItem: JsonLdMenuItem[];
  hasMenuSection?: JsonLdMenuSection[];
};

/** Цена «от»: минимум среди вариантов, для позиций по сетке — минимум сетки */
function itemMinPrice(item: MenuItemNode): number | null {
  return item.variants.length > 0
    ? minPrice(item.variants)
    : minPrice(item.priceGroup?.tiers ?? []);
}

function toMenuItem(item: MenuItemNode): JsonLdMenuItem {
  const price = itemMinPrice(item);
  return {
    "@type": "MenuItem",
    name: item.name,
    ...(item.description ? { description: item.description } : {}),
    ...(price != null
      ? { offers: { "@type": "Offer", price: String(price), priceCurrency: "RUB" } }
      : {}),
  };
}

function toMenuSection(category: MenuCategoryNode): JsonLdMenuSection {
  const children = category.children.filter((c) => c.items.length > 0).map(toMenuSection);
  return {
    "@type": "MenuSection",
    name: category.title,
    hasMenuItem: category.items.map(toMenuItem),
    ...(children.length > 0 ? { hasMenuSection: children } : {}),
  };
}

export function menuJsonLd(tree: MenuTree, siteUrl: string) {
  const base = siteUrl.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: "Меню бильярдного клуба «Пирамида»",
    url: `${base}/menu`,
    inLanguage: "ru",
    hasMenuSection: tree.categories
      .filter((c) => c.items.length > 0 || c.children.some((child) => child.items.length > 0))
      .map(toMenuSection),
  };
}
