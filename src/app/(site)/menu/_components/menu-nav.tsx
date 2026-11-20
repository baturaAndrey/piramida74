"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type MenuNavEntry = {
  slug: string;
  title: string;
  children: { slug: string; title: string }[];
};

type MenuNavProps = {
  entries: MenuNavEntry[];
  /** slug активного раздела (scroll-spy) или `null` */
  activeSlug: string | null;
  /** `sidebar` — вертикальный список на `lg+`; `chips` — строка чипов на мобильном */
  variant: "sidebar" | "chips";
  className?: string;
};

const LINK_BASE =
  "block rounded-[12px] px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function linkClass(active: boolean, extra?: string) {
  return cn(
    LINK_BASE,
    active ? "bg-primary text-white" : "bg-white text-[#8E8E8E] hover:text-foreground",
    extra
  );
}

/**
 * Прокручивает только контейнер навигации (не окно), чтобы активный пункт был виден.
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

/** Навигация по разделам меню: якоря `#cat-{slug}`, подсветка активного раздела */
export function MenuNav({ entries, activeSlug, variant, className }: MenuNavProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !activeSlug) return;
    // Скрытый вариант (display: none) не имеет размеров — пропускаем
    if (container.offsetParent === null && getComputedStyle(container).position !== "fixed") return;
    const el = container.querySelector<HTMLElement>(`[data-slug="${CSS.escape(activeSlug)}"]`);
    if (el) revealInContainer(container, el, variant === "chips" ? "x" : "y");
  }, [activeSlug, variant]);

  if (variant === "chips") {
    return (
      <nav aria-label="Разделы меню" className={className}>
        <div
          ref={containerRef}
          className="relative flex [scrollbar-width:none] gap-2 overflow-x-auto py-3 [&::-webkit-scrollbar]:hidden"
        >
          {entries.flatMap((entry) => [
            <a
              key={entry.slug}
              href={`#cat-${entry.slug}`}
              data-slug={entry.slug}
              aria-current={activeSlug === entry.slug ? "true" : undefined}
              className={linkClass(activeSlug === entry.slug, "shrink-0 whitespace-nowrap")}
            >
              {entry.title}
            </a>,
            ...entry.children.map((child) => (
              <a
                key={child.slug}
                href={`#cat-${child.slug}`}
                data-slug={child.slug}
                aria-current={activeSlug === child.slug ? "true" : undefined}
                className={linkClass(activeSlug === child.slug, "shrink-0 whitespace-nowrap")}
              >
                {child.title}
              </a>
            )),
          ])}
        </div>
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
              <a
                href={`#cat-${entry.slug}`}
                data-slug={entry.slug}
                aria-current={activeSlug === entry.slug ? "true" : undefined}
                className={linkClass(activeSlug === entry.slug)}
              >
                {entry.title}
              </a>
              {entry.children.length > 0 ? (
                <ul className="mt-1.5 space-y-1.5 pl-4">
                  {entry.children.map((child) => (
                    <li key={child.slug}>
                      <a
                        href={`#cat-${child.slug}`}
                        data-slug={child.slug}
                        aria-current={activeSlug === child.slug ? "true" : undefined}
                        className={linkClass(activeSlug === child.slug)}
                      >
                        {child.title}
                      </a>
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
