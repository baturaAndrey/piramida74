"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Задержка появления, мс */
  delay?: number;
};

/** Срабатывает, когда верх элемента пересёк нижние 90% окна */
const ROOT_MARGIN = "0px 0px -10% 0px";

/**
 * Появление блока при прокрутке (сдвиг снизу + fade).
 * Серверный HTML виден сразу (SEO, LCP); прячутся только элементы, которые на момент
 * гидрации ниже окна. При `prefers-reduced-motion` ничего не прячется и не анимируется.
 */
export function Reveal({ children, className, delay }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Уже видимое (или выше окна) не прячем — иначе контент «мигнёт»
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = "shown";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: ROOT_MARGIN }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("scroll-reveal", className)}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
