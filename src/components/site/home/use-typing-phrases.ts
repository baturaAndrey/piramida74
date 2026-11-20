"use client";

import { useEffect, useState } from "react";

type TypingOptions = {
  /** Задержка между набранными символами, мс */
  type?: number;
  /** Задержка между стёртыми символами, мс */
  erase?: number;
  /** Сколько показывать полностью набранную фразу, мс */
  hold?: number;
  /** Пауза между стиранием и набором следующей фразы, мс */
  gap?: number;
};

type Mode = "hold" | "erase" | "type";

/** Предельное ожидание простоя перед стартом печати после `load`, мс */
const START_IDLE_TIMEOUT_MS = 2000;

/**
 * Циклически «печатает» и стирает фразы.
 * SSR и первый кадр — полная первая фраза (хороший LCP, бейдж не пустой);
 * при `prefers-reduced-motion` или одной фразе текст статичен.
 */
export function useTypingPhrases(
  phrases: string[],
  { type = 60, erase = 30, hold = 1600, gap = 300 }: TypingOptions = {}
): string {
  const [text, setText] = useState(phrases[0] ?? "");
  // Ключ вместо массива: новый экземпляр с теми же фразами не перезапускает анимацию
  const phrasesKey = phrases.join("\u0000");

  useEffect(() => {
    const list = phrasesKey.split("\u0000");
    if (list.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let index = 0;
    let pos = (list[0] ?? "").length;
    let mode: Mode = "hold";
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const current = list[index] ?? "";
      if (mode === "hold") {
        mode = "erase";
        timer = setTimeout(tick, hold);
        return;
      }
      if (mode === "erase") {
        pos -= 1;
        setText(current.slice(0, Math.max(pos, 0)));
        if (pos <= 0) {
          index = (index + 1) % list.length;
          mode = "type";
          timer = setTimeout(tick, gap);
        } else {
          timer = setTimeout(tick, erase);
        }
        return;
      }
      pos += 1;
      setText(current.slice(0, pos));
      if (pos >= current.length) {
        mode = "hold";
        timer = setTimeout(tick, 0);
      } else {
        timer = setTimeout(tick, type);
      }
    };

    // Цикл стартует после загрузки страницы и в простое главного потока: каждый тик —
    // ре-рендер и перерисовка, которые иначе конкурируют с загрузкой и гидратацией.
    // Первая фраза уже показана (SSR), поэтому отложенный старт незаметен.
    // Первый тик в режиме `hold` сам выдерживает паузу `hold` перед стиранием.
    let idleHandle: number | undefined;
    const run = () => {
      timer = setTimeout(tick, 0);
    };
    const start = () => {
      idleHandle =
        typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback(run, { timeout: START_IDLE_TIMEOUT_MS })
          : window.setTimeout(run, 0);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      window.removeEventListener("load", start);
      if (idleHandle !== undefined) {
        if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleHandle);
        else window.clearTimeout(idleHandle);
      }
      clearTimeout(timer);
    };
  }, [phrasesKey, type, erase, hold, gap]);

  return text;
}
