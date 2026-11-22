"use client";

import { useEffect, useState } from "react";

/**
 * «Загрузить, когда понадобится» — для тяжёлых блоков далеко под первым экраном (форма заявки
 * CTA на главной). Lighthouse в симуляции считает каждый чанк, запрошенный до LCP, поэтому
 * такой блок не должен грузиться вместе со страницей. Флаг становится `true` (один раз и
 * навсегда) при первом из событий:
 *
 * - контейнер подошёл к окну ближе чем на `rootMargin` (пользователь листает к блоку);
 * - первое действие пользователя на странице (касание, клик, клавиша, фокус, прокрутка):
 *   человек, который начал что-то делать, скорее всего дойдёт и до формы;
 * - запасной вариант: через `fallbackDelayMs` после `load` в простое браузера. Он нужен, чтобы
 *   блок появился и без действий пользователя — например, e2e сразу после `page.goto('/')`
 *   заполняет форму без прокрутки (Playwright ждёт появления полей).
 */

/** Насколько заранее (до входа в окно) начинать загрузку: ≈ экран-полтора мобильной прокрутки */
const DEFAULT_ROOT_MARGIN = "1000px 0px";
/** Пауза после `load`: к этому моменту LCP и основной JS страницы уже отработали */
const DEFAULT_FALLBACK_DELAY_MS = 3000;
/** Сколько максимум ждать простоя браузера после паузы */
const IDLE_TIMEOUT_MS = 2000;

const INTERACTION_EVENTS = ["pointerdown", "keydown", "touchstart", "focusin", "scroll"] as const;

type UseLoadWhenNeededOptions = {
  rootMargin?: string;
  fallbackDelayMs?: number;
};

export function useLoadWhenNeeded(
  ref: React.RefObject<Element | null>,
  {
    rootMargin = DEFAULT_ROOT_MARGIN,
    fallbackDelayMs = DEFAULT_FALLBACK_DELAY_MS,
  }: UseLoadWhenNeededOptions = {}
): boolean {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;

    let done = false;
    let observer: IntersectionObserver | undefined;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let idleHandle: number | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const listenerOptions: AddEventListenerOptions = { passive: true, capture: true };

    const cleanup = () => {
      observer?.disconnect();
      for (const type of INTERACTION_EVENTS) {
        window.removeEventListener(type, trigger, listenerOptions);
      }
      window.removeEventListener("load", startFallback);
      if (delayTimer !== undefined) clearTimeout(delayTimer);
      if (idleTimer !== undefined) clearTimeout(idleTimer);
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
    };

    // Срабатывает первый из источников, остальные снимаются сразу
    function trigger() {
      if (done) return;
      done = true;
      cleanup();
      setShouldLoad(true);
    }

    function startFallback() {
      delayTimer = setTimeout(() => {
        // Где requestIdleCallback нет (Safari) — просто следующий тик
        if (typeof window.requestIdleCallback === "function") {
          idleHandle = window.requestIdleCallback(trigger, { timeout: IDLE_TIMEOUT_MS });
        } else {
          idleTimer = setTimeout(trigger, 0);
        }
      }, fallbackDelayMs);
    }

    const element = ref.current;
    if (element && typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) trigger();
        },
        { rootMargin }
      );
      observer.observe(element);
    }

    // capture: событие ловится, даже если обработчик элемента остановил всплытие
    for (const type of INTERACTION_EVENTS) {
      window.addEventListener(type, trigger, listenerOptions);
    }

    if (document.readyState === "complete") startFallback();
    else window.addEventListener("load", startFallback, { once: true });

    return cleanup;
  }, [ref, rootMargin, fallbackDelayMs, shouldLoad]);

  return shouldLoad;
}
