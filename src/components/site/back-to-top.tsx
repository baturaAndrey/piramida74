"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Кнопка появляется после прокрутки на это расстояние, px */
const SHOW_AFTER_PX = 400;

/** Кнопка «наверх» (.to-top старого сайта): круг 48px / 64px с md. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Наверх"
      // Скрытая кнопка не должна попадать в порядок табуляции
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={cn(
        "bg-primary hover:bg-primary-dark fixed right-6 bottom-[calc(var(--cookie-banner-offset,0px)+1.5rem)] z-40 flex size-12 items-center justify-center rounded-full text-white shadow-md transition-[opacity,background-color,bottom] duration-300 md:size-16",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <ArrowUp className="size-5 md:size-6" aria-hidden="true" />
    </button>
  );
}
