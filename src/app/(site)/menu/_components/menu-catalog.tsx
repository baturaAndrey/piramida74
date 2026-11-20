"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { MenuCategoryNode, MenuItemNode, MenuModifierNode } from "@/lib/queries/menu";
import { FunFact } from "./fun-fact";
import { MenuItemRow } from "./menu-item-row";
import { MenuNav, type MenuNavEntry } from "./menu-nav";
import { PriceGroupTable } from "./price-group-table";
import { formatPrice } from "../_lib/format";

type MenuCatalogProps = {
  categories: MenuCategoryNode[];
  modifiers: MenuModifierNode[];
};

const EXTRAS_SLUG = "extras";
const TAKEAWAY_NOTE = "При заказе любого блюда на вынос скидка 10%";
/** Полоса срабатывания scroll-spy: 25–35% высоты окна сверху */
const SPY_ROOT_MARGIN = "-25% 0px -65% 0px";

/** Нормализация для поиска без учёта регистра и «ё» */
const normalize = (s: string) => s.toLocaleLowerCase("ru-RU").replace(/ё/g, "е");

function matchesItem(item: MenuItemNode, q: string): boolean {
  return [item.name, item.description, item.choiceNote, item.originCountry].some(
    (field) => field != null && normalize(field).includes(q)
  );
}

/**
 * Фильтрует дерево по запросу и убирает пустые разделы
 * (раздел виден, если у него есть позиции или видимые подкатегории).
 */
function filterTree(categories: MenuCategoryNode[], q: string): MenuCategoryNode[] {
  const filterNode = (cat: MenuCategoryNode): MenuCategoryNode | null => {
    const items = q ? cat.items.filter((item) => matchesItem(item, q)) : cat.items;
    const children = cat.children.map(filterNode).filter((c): c is MenuCategoryNode => c !== null);
    if (items.length === 0 && children.length === 0) return null;
    return { ...cat, items, children };
  };
  return categories.map(filterNode).filter((c): c is MenuCategoryNode => c !== null);
}

/** Позиции, общая сетка, «интересный факт» и заметка о выносе одного раздела */
function CategoryBody({ category }: { category: MenuCategoryNode }) {
  const groupName = category.priceGroup?.name ?? null;
  const hasTakeaway = category.items.some((item) => item.isTakeawayDiscount);
  return (
    <>
      {category.priceGroup && category.items.length > 0 ? (
        <PriceGroupTable group={category.priceGroup} />
      ) : null}
      {category.items.length > 0 ? (
        <ul className="divide-y divide-[#EEF0F2] rounded-[12px] bg-white">
          {category.items.map((item) => (
            <MenuItemRow key={item.id} item={item} categoryGroupName={groupName} />
          ))}
        </ul>
      ) : null}
      {category.funFactText ? (
        <FunFact title={category.funFactTitle} text={category.funFactText} />
      ) : null}
      {hasTakeaway ? <p className="text-muted-foreground mt-3 text-xs">{TAKEAWAY_NOTE}</p> : null}
    </>
  );
}

/** Каталог меню: поиск, навигация по разделам со scroll-spy и сами разделы */
export function MenuCatalog({ categories, modifiers }: MenuCatalogProps) {
  const [query, setQuery] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const q = normalize(deferredQuery.trim());
  const isSearching = q.length > 0;

  const visible = useMemo(() => filterTree(categories, q), [categories, q]);
  const visibleModifiers = useMemo(
    () => (q ? modifiers.filter((m) => normalize(m.name).includes(q)) : modifiers),
    [modifiers, q]
  );

  const navEntries = useMemo<MenuNavEntry[]>(() => {
    const entries: MenuNavEntry[] = visible.map((cat) => ({
      slug: cat.slug,
      title: cat.title,
      children: cat.children.map((c) => ({ slug: c.slug, title: c.title })),
    }));
    if (visibleModifiers.length > 0) {
      entries.push({ slug: EXTRAS_SLUG, title: "Дополнительно", children: [] });
    }
    return entries;
  }, [visible, visibleModifiers]);

  // Порядок разделов в документе — для выбора самого глубокого/последнего видимого
  const sectionOrder = useMemo(
    () => navEntries.flatMap((e) => [e.slug, ...e.children.map((c) => c.slug)]),
    [navEntries]
  );

  useEffect(() => {
    // При поиске разделы прыгают — scroll-spy отключён
    if (isSearching || typeof IntersectionObserver === "undefined") return;
    const elements = sectionOrder
      .map((slug) => document.getElementById(`cat-${slug}`))
      .filter((el): el is HTMLElement => el !== null);
    const intersecting = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const slug = (entry.target as HTMLElement).dataset.menuSection;
          if (!slug) continue;
          if (entry.isIntersecting) intersecting.add(slug);
          else intersecting.delete(slug);
        }
        // Подкатегория идёт в документе после родителя, поэтому последний видимый — самый точный
        const current = sectionOrder.findLast((slug) => intersecting.has(slug));
        if (current) setActiveSlug(current);
      },
      { rootMargin: SPY_ROOT_MARGIN }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isSearching, sectionOrder]);

  const navActive = isSearching ? null : activeSlug;
  const nothingFound = visible.length === 0 && visibleModifiers.length === 0;

  return (
    <div className="mt-8 lg:flex lg:items-start lg:gap-10">
      <aside className="hidden shrink-0 lg:sticky lg:top-24 lg:block lg:w-[260px]">
        <MenuNav entries={navEntries} activeSlug={navActive} variant="sidebar" />
      </aside>

      <div className="min-w-0 flex-1">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти блюдо или напиток"
            aria-label="Найти блюдо или напиток"
            className="h-12 rounded-[12px] border-transparent bg-white pr-12 pl-12 text-base md:text-base [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:ring-[3px]"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {navEntries.length > 0 ? (
          <MenuNav
            entries={navEntries}
            activeSlug={navActive}
            variant="chips"
            className="bg-background/90 bleed-gutter sticky top-[72px] z-30 mt-4 border-b backdrop-blur lg:hidden"
          />
        ) : null}

        <div className="mt-6 lg:mt-8" aria-live="polite">
          {nothingFound ? (
            <p className="text-muted-foreground rounded-[12px] bg-white p-6 text-center">
              Ничего не найдено. Попробуйте другое слово
            </p>
          ) : null}
        </div>

        {visible.map((cat) => (
          <section
            key={cat.id}
            id={`cat-${cat.slug}`}
            data-menu-section={cat.slug}
            aria-labelledby={`cat-${cat.slug}-title`}
            className="mb-10 scroll-mt-12 lg:scroll-mt-4"
          >
            <h2
              id={`cat-${cat.slug}-title`}
              className="mb-4 text-[clamp(22px,2.1vw,40px)] leading-tight font-semibold"
            >
              {cat.title}
            </h2>
            {cat.description ? (
              <p className="text-subtle mb-4 max-w-3xl text-sm md:text-base">{cat.description}</p>
            ) : null}
            <CategoryBody category={cat} />

            {cat.children.map((child) => (
              <div
                key={child.id}
                id={`cat-${child.slug}`}
                data-menu-section={child.slug}
                className="mt-8 scroll-mt-12 lg:scroll-mt-4"
              >
                <h3 className="mb-3 text-xl font-semibold">{child.title}</h3>
                {child.description ? (
                  <p className="text-subtle mb-3 max-w-3xl text-sm">{child.description}</p>
                ) : null}
                <CategoryBody category={child} />
              </div>
            ))}
          </section>
        ))}

        {visibleModifiers.length > 0 ? (
          <section
            id={`cat-${EXTRAS_SLUG}`}
            data-menu-section={EXTRAS_SLUG}
            aria-labelledby="cat-extras-title"
            className="mb-10 scroll-mt-12 lg:scroll-mt-4"
          >
            <h2
              id="cat-extras-title"
              className="mb-2 text-[clamp(22px,2.1vw,40px)] leading-tight font-semibold"
            >
              Дополнительно
            </h2>
            <p className="text-subtle mb-4 text-sm">
              Платные добавки к блюдам. Уточняйте у официанта
            </p>
            <ul className="grid gap-x-8 rounded-[12px] bg-white p-4 md:grid-cols-2 md:p-5">
              {visibleModifiers.map((m) => (
                <li
                  key={m.id}
                  className="flex items-baseline justify-between gap-4 border-b border-[#EEF0F2] py-2.5"
                >
                  <span>{m.name}</span>
                  <span className="shrink-0 font-bold tabular-nums">{formatPrice(m.price)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
