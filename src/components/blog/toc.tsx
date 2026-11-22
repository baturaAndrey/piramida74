"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";
import { TOC_ANCHOR, type TocHeading } from "@/lib/content/markdown";
import { cn } from "@/lib/utils";

/**
 * Оглавление статьи (H2–H6). Список приходит с сервера (`extractHeadings`) и есть
 * в HTML; остров только подсвечивает текущий раздел (scroll-spy через
 * `IntersectionObserver`). Без JS якоря всё равно работают.
 */

type TableOfContentsProps = {
  headings: TocHeading[];
  className?: string;
};

const INDENT: Record<TocHeading["level"], string> = {
  2: "pl-0",
  3: "pl-4",
  4: "pl-8",
  5: "pl-12",
  6: "pl-16",
};

/** Раздел считается текущим, когда его заголовок в верхних 30% окна */
const SPY_ROOT_MARGIN = "0px 0px -70% 0px";

export function TableOfContents({ headings, className }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    if (headings.length === 0 || typeof IntersectionObserver === "undefined") return;
    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = visible[0]?.target.id;
        if (id) setActiveId(id);
      },
      { rootMargin: SPY_ROOT_MARGIN, threshold: [0, 1] }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav
      id={TOC_ANCHOR}
      aria-label="Оглавление статьи"
      className={cn(
        "bg-card text-card-foreground scroll-mt-28 rounded-lg border p-5 md:p-6",
        className
      )}
    >
      <p className="mb-4 inline-flex items-center gap-2 text-lg font-semibold md:text-xl">
        <List className="text-primary h-5 w-5" aria-hidden="true" />
        Оглавление статьи
      </p>
      <ol className="space-y-2 text-sm md:text-base">
        {headings.map((h) => {
          const active = activeId === h.id;
          return (
            <li key={h.id} className={INDENT[h.level]}>
              <a
                href={`#${h.id}`}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "hover:text-primary block leading-snug transition-colors",
                  active ? "text-primary font-semibold" : "text-foreground"
                )}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
