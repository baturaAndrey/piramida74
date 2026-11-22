"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { AccordionItem } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

type MenuSectionProps = {
  slug: string;
  title: string;
  open: boolean;
  /** Раскрыть раздел: браузер нашёл текст внутри свёрнутого содержимого (Ctrl+F) */
  onReveal: (slug: string) => void;
  children: ReactNode;
};

/**
 * Раздел меню верхнего уровня — пункт аккордеона.
 *
 * Содержимое всегда в DOM (`forceMount`): его видят краулеры и поиск по странице.
 * Свёрнутое содержимое помечается `hidden="until-found"`: Ctrl+F находит блюдо и браузер
 * шлёт `beforematch`, по которому раздел раскрывается. React сериализует `hidden` только
 * как булев атрибут, поэтому в SSR-разметке это обычный `hidden`, а значение
 * `until-found` выставляется после гидратации (браузеры без поддержки трактуют его как `hidden`).
 *
 * Заголовок — `h2` с кнопкой внутри (а не `summary` с заголовком): так заголовок
 * остаётся в навигации скринридера по заголовкам.
 */
export function MenuSection({ slug, title, open, onReveal, children }: MenuSectionProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = `cat-${slug}-title`;

  useLayoutEffect(() => {
    // React только что выставил `hidden=""` (или снял его при раскрытии)
    if (!open) contentRef.current?.setAttribute("hidden", "until-found");
  }, [open]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handleBeforeMatch = () => onReveal(slug);
    el.addEventListener("beforematch", handleBeforeMatch);
    return () => el.removeEventListener("beforematch", handleBeforeMatch);
  }, [onReveal, slug]);

  return (
    <AccordionItem value={slug} asChild>
      <section
        id={`cat-${slug}`}
        data-menu-section={slug}
        aria-labelledby={titleId}
        className="scroll-mt-12 lg:scroll-mt-4"
      >
        <AccordionPrimitive.Header asChild>
          <h2 id={titleId} className="m-0">
            <AccordionPrimitive.Trigger
              className={cn(
                "group flex w-full cursor-pointer items-center justify-between gap-4 rounded-md py-4 text-left md:py-5",
                "text-[clamp(22px,2.1vw,40px)] leading-tight font-semibold transition-colors",
                "hover:text-primary focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]"
              )}
            >
              <span className="min-w-0">{title}</span>
              <span
                aria-hidden="true"
                className="bg-primary group-data-[state=open]:text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-white transition-[transform,background-color,color] duration-300 group-data-[state=open]:rotate-45 group-data-[state=open]:bg-white group-data-[state=open]:shadow-sm md:size-10"
              >
                <Plus className="size-4 md:size-5" strokeWidth={3} />
              </span>
            </AccordionPrimitive.Trigger>
          </h2>
        </AccordionPrimitive.Header>
        <AccordionPrimitive.Content
          ref={contentRef}
          forceMount
          // Radix с `forceMount` не скрывает содержимое сам — скрываем по состоянию
          hidden={!open}
          // Только прозрачность, без анимации высоты: растущий блок сбивал прокрутку
          // к подкатегории (scroll anchoring браузера уезжал за разделами ниже)
          className="motion-safe:data-[state=open]:animate-fade-in"
        >
          <div className="pt-1 pb-10">{children}</div>
        </AccordionPrimitive.Content>
      </section>
    </AccordionItem>
  );
}
