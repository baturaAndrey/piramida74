"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

export type MenuNavEntry = {
  slug: string;
  title: string;
  children: { slug: string; title: string }[];
};

type MenuNavProps = {
  /** Только разделы верхнего уровня; подкатегории — в `children` */
  entries: MenuNavEntry[];
  /** slug активного раздела или подкатегории (scroll-spy / клик) либо `null` */
  activeSlug: string | null;
  /** slug раскрытого в навигации раздела верхнего уровня: под ним видны подкатегории */
  expandedSlug: string | null;
  /** Переход к разделу: раскрыть его в каталоге и прокрутить к якорю */
  onNavigate: (slug: string) => void;
  /** `sidebar` — вертикальный список на `lg+`; `chips` — строка чипов на мобильном */
  variant: "sidebar" | "chips";
  className?: string;
};

type LinkState = "active" | "parent" | "idle";

const LINK_BASE =
  "block rounded-[12px] px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const LINK_STATE: Record<LinkState, string> = {
  active: "bg-primary text-white",
  // Раздел, внутри которого активна подкатегория
  parent: "bg-accent text-accent-foreground",
  idle: "bg-white text-[#8E8E8E] hover:text-foreground",
};

/**
 * Прокручивает только контейнер навигации (не окно), чтобы пункт был виден.
 * `scrollIntoView` здесь не подходит: он двигает и страницу, мешая пользователю скроллить.
 */
function revealInContainer(container: HTMLElement, el: HTMLElement, axis: "x" | "y") {
  if (axis === "x") {
    const left = el.offsetLeft - (container.clientWidth - el.offsetWidth) / 2;
    container.scrollTo({ left: Math.max(0, left) });
    return;
  }
  const top = el.offsetTop;
  const bottom = top + el.offsetHeight;
  if (top < container.scrollTop) container.scrollTo({ top });
  else if (bottom > container.scrollTop + container.clientHeight) {
    container.scrollTo({ top: bottom - container.clientHeight });
  }
}

/** Скрытый вариант навигации (display: none) не имеет размеров — прокручивать нечего */
function isRendered(el: HTMLElement) {
  return el.offsetParent !== null || getComputedStyle(el).position === "fixed";
}

function revealSlug(container: HTMLElement | null, slug: string | null, axis: "x" | "y") {
  if (!container || !slug || !isRendered(container)) return;
  const el = container.querySelector<HTMLElement>(`[data-slug="${CSS.escape(slug)}"]`);
  if (el) revealInContainer(container, el, axis);
}

type NavLinkProps = {
  slug: string;
  title: string;
  state: LinkState;
  onNavigate: (slug: string) => void;
  className?: string;
};

function NavLink({ slug, title, state, onNavigate, className }: NavLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Открытие в новой вкладке и т. п. оставляем браузеру
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    // Свёрнутый раздел скрыт, нативный переход по якорю не сработает — раскрываем сами
    event.preventDefault();
    onNavigate(slug);
  };

  return (
    <a
      href={`#cat-${slug}`}
      data-slug={slug}
      aria-current={state === "active" ? "true" : undefined}
      onClick={handleClick}
      className={cn(LINK_BASE, LINK_STATE[state], className)}
    >
      {title}
    </a>
  );
}

/**
 * Навигация по меню: только разделы верхнего уровня, подкатегории — у раскрытого раздела.
 * Якоря `#cat-{slug}` сохраняются в `href` (работают без JS и при копировании ссылки).
 */
export function MenuNav({
  entries,
  activeSlug,
  expandedSlug,
  onNavigate,
  variant,
  className,
}: MenuNavProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const childrenRowRef = useRef<HTMLDivElement>(null);
  const expanded = entries.find((entry) => entry.slug === expandedSlug) ?? null;

  const rootState = (slug: string): LinkState => {
    if (slug === activeSlug) return "active";
    return slug === expandedSlug && activeSlug !== null ? "parent" : "idle";
  };
  const childState = (slug: string): LinkState => (slug === activeSlug ? "active" : "idle");

  useEffect(() => {
    if (variant === "chips") {
      revealSlug(containerRef.current, expandedSlug, "x");
      revealSlug(childrenRowRef.current, activeSlug, "x");
    } else {
      revealSlug(containerRef.current, activeSlug, "y");
    }
  }, [activeSlug, expandedSlug, variant]);

  if (variant === "chips") {
    const rowClass =
      "relative flex [scrollbar-width:none] gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden";
    return (
      <nav aria-label="Разделы меню" className={className}>
        <div ref={containerRef} className={cn(rowClass, "py-3")}>
          {entries.map((entry) => (
            <NavLink
              key={entry.slug}
              slug={entry.slug}
              title={entry.title}
              state={rootState(entry.slug)}
              onNavigate={onNavigate}
              className="shrink-0 whitespace-nowrap"
            />
          ))}
        </div>
        {expanded && expanded.children.length > 0 ? (
          <div
            ref={childrenRowRef}
            aria-label={`Подразделы: ${expanded.title}`}
            role="group"
            className={cn(rowClass, "-mt-1 pb-3")}
          >
            {expanded.children.map((child) => (
              <NavLink
                key={child.slug}
                slug={child.slug}
                title={child.title}
                state={childState(child.slug)}
                onNavigate={onNavigate}
                className="shrink-0 px-2.5 py-1.5 text-xs whitespace-nowrap"
              />
            ))}
          </div>
        ) : null}
      </nav>
    );
  }

  return (
    <nav aria-label="Разделы меню" className={className}>
      <div
        ref={containerRef}
        className="relative max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain p-1"
      >
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.slug}>
              <NavLink
                slug={entry.slug}
                title={entry.title}
                state={rootState(entry.slug)}
                onNavigate={onNavigate}
              />
              {entry.slug === expandedSlug && entry.children.length > 0 ? (
                <ul className="mt-1.5 space-y-1.5 pl-4">
                  {entry.children.map((child) => (
                    <li key={child.slug}>
                      <NavLink
                        slug={child.slug}
                        title={child.title}
                        state={childState(child.slug)}
                        onNavigate={onNavigate}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
