"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import type { MenuCategoryNode, MenuItemNode, MenuModifierNode } from "@/lib/queries/menu";
import { FunFact } from "./fun-fact";
import { MenuItemRow } from "./menu-item-row";
import { MenuNav, type MenuNavEntry } from "./menu-nav";
import { MenuSection } from "./menu-section";
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
/** Префикс якорей разделов: `#cat-{slug}` (стабильные ссылки, не менять) */
const SECTION_ID_PREFIX = "cat-";

/** Разделы, свёрнутые вручную во время поиска; сбрасываются при смене запроса */
type SearchCollapse = { query: string; closed: string[] };

const sectionId = (slug: string) => `${SECTION_ID_PREFIX}${slug}`;

/** slug раздела/подкатегории из `#cat-{slug}` либо `null` */
function slugFromHash(hash: string): string | null {
  let id: string;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return null; // битая percent-последовательность в адресе
  }
  return id.startsWith(SECTION_ID_PREFIX) ? id.slice(SECTION_ID_PREFIX.length) || null : null;
}

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

/**
 * Каталог меню: поиск, навигация по разделам верхнего уровня со scroll-spy и сами
 * разделы — аккордеон, по умолчанию раскрыт только первый раздел (по `sortOrder`).
 */
export function MenuCatalog({ categories, modifiers }: MenuCatalogProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const q = normalize(deferredQuery.trim());
  const isSearching = q.length > 0;

  const firstSlug = categories[0]?.slug ?? null;
  const [openSlugs, setOpenSlugs] = useState<string[]>(() => (firstSlug ? [firstSlug] : []));
  const [searchCollapse, setSearchCollapse] = useState<SearchCollapse>({ query: "", closed: [] });
  const [activeSlug, setActiveSlug] = useState<string | null>(firstSlug);
  /**
   * Запрос прокрутки к разделу, когда тот раскроется. Новый объект на каждый переход —
   * повторный клик по тому же пункту тоже прокручивает.
   */
  const [scrollRequest, setScrollRequest] = useState<{
    slug: string;
    behavior: ScrollBehavior;
  } | null>(null);

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

  /** slug любого раздела (в т. ч. скрытого поиском) → slug его раздела верхнего уровня */
  const rootOf = useMemo(() => {
    const map = new Map<string, string>([[EXTRAS_SLUG, EXTRAS_SLUG]]);
    for (const cat of categories) {
      map.set(cat.slug, cat.slug);
      for (const child of cat.children) map.set(child.slug, cat.slug);
    }
    return map;
  }, [categories]);

  const rootSlugs = useMemo(() => navEntries.map((e) => e.slug), [navEntries]);
  // При поиске раскрыты все найденные разделы, кроме свёрнутых вручную для этого запроса
  const searchClosed = searchCollapse.query === q ? searchCollapse.closed : [];
  const openValue = isSearching ? rootSlugs.filter((s) => !searchClosed.includes(s)) : openSlugs;

  const handleOpenChange = (next: string[]) => {
    if (isSearching) {
      setSearchCollapse({ query: q, closed: rootSlugs.filter((s) => !next.includes(s)) });
    } else {
      setOpenSlugs(next);
    }
  };

  /** Раскрывает раздел верхнего уровня, содержащий `slug`; остальные не трогает */
  const openSectionOf = useCallback(
    (slug: string) => {
      const root = rootOf.get(slug);
      if (!root) return;
      setOpenSlugs((prev) => (prev.includes(root) ? prev : [...prev, root]));
      setSearchCollapse((prev) =>
        prev.closed.includes(root)
          ? { ...prev, closed: prev.closed.filter((s) => s !== root) }
          : prev
      );
    },
    [rootOf]
  );

  /** Переход к разделу (клик в навигации, якорь в адресе): раскрыть, подсветить, прокрутить */
  const navigateTo = useCallback(
    (slug: string, behavior: ScrollBehavior = "auto") => {
      if (!rootOf.has(slug)) return;
      openSectionOf(slug);
      setActiveSlug(slug);
      setScrollRequest({ slug, behavior });
    },
    [openSectionOf, rootOf]
  );

  const handleNavigate = useCallback(
    (slug: string) => {
      navigateTo(slug);
      // Якорь в адресе — чтобы ссылкой на раздел можно было поделиться
      window.history.replaceState(window.history.state, "", `#${sectionId(slug)}`);
    },
    [navigateTo]
  );

  useEffect(() => {
    if (!scrollRequest) return;
    // Эффект идёт после коммита: раздел уже раскрыт и имеет размеры
    document.getElementById(sectionId(scrollRequest.slug))?.scrollIntoView({
      block: "start",
      behavior: scrollRequest.behavior,
    });
  }, [scrollRequest]);

  // Глубокие ссылки /menu#cat-{slug}: сервер якоря не знает, раскрываем после гидратации
  useEffect(() => {
    const handleHash = (behavior: ScrollBehavior) => {
      const slug = slugFromHash(window.location.hash);
      if (slug) navigateTo(slug, behavior);
    };
    // При загрузке — без плавной прокрутки: страница ещё дорисовывается, и плавная
    // прокрутка, начатая до сдвигов вёрстки, останавливается не у того раздела
    handleHash("instant");
    const handleHashChange = () => handleHash("auto");
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [navigateTo]);

  // Порядок разделов в документе — для выбора самого глубокого/последнего видимого
  const sectionOrder = useMemo(
    () => navEntries.flatMap((e) => [e.slug, ...e.children.map((c) => c.slug)]),
    [navEntries]
  );

  useEffect(() => {
    // При поиске разделы прыгают — scroll-spy отключён
    if (isSearching || typeof IntersectionObserver === "undefined") return;
    // Подкатегории свёрнутых разделов скрыты и в полосу срабатывания не попадают
    const elements = sectionOrder
      .map((slug) => document.getElementById(sectionId(slug)))
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
  const navProps = {
    entries: navEntries,
    activeSlug: navActive,
    // В навигации раскрыт раздел активного пункта: под ним видны подкатегории
    expandedSlug: navActive ? (rootOf.get(navActive) ?? null) : null,
    onNavigate: handleNavigate,
  };
  const nothingFound = visible.length === 0 && visibleModifiers.length === 0;

  return (
    <div className="mt-8 lg:flex lg:items-start lg:gap-10">
      <aside className="hidden shrink-0 lg:sticky lg:top-24 lg:block lg:w-[260px]">
        <MenuNav {...navProps} variant="sidebar" />
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
            {...navProps}
            variant="chips"
            className="bg-background/90 bleed-gutter sticky top-[72px] z-30 mt-4 border-b backdrop-blur lg:hidden"
          />
        ) : null}

        <div className="mt-4 lg:mt-6" aria-live="polite">
          {nothingFound ? (
            <p className="text-muted-foreground rounded-[12px] bg-white p-6 text-center">
              Ничего не найдено. Попробуйте другое слово
            </p>
          ) : null}
        </div>

        <Accordion type="multiple" value={openValue} onValueChange={handleOpenChange}>
          {visible.map((cat) => (
            <MenuSection
              key={cat.id}
              slug={cat.slug}
              title={cat.title}
              open={openValue.includes(cat.slug)}
              onReveal={openSectionOf}
            >
              {cat.description ? (
                <p className="text-subtle mb-4 max-w-3xl text-sm md:text-base">{cat.description}</p>
              ) : null}
              <CategoryBody category={cat} />

              {cat.children.map((child) => (
                <div
                  key={child.id}
                  id={sectionId(child.slug)}
                  data-menu-section={child.slug}
                  className="mt-8 scroll-mt-12 first:mt-0 lg:scroll-mt-4"
                >
                  <h3 className="mb-3 text-xl font-semibold">{child.title}</h3>
                  {child.description ? (
                    <p className="text-subtle mb-3 max-w-3xl text-sm">{child.description}</p>
                  ) : null}
                  <CategoryBody category={child} />
                </div>
              ))}
            </MenuSection>
          ))}

          {visibleModifiers.length > 0 ? (
            <MenuSection
              slug={EXTRAS_SLUG}
              title="Дополнительно"
              open={openValue.includes(EXTRAS_SLUG)}
              onReveal={openSectionOf}
            >
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
            </MenuSection>
          ) : null}
        </Accordion>
      </div>
    </div>
  );
}
