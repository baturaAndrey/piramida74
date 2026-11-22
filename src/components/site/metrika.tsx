"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useCookieConsent } from "./cookie-consent";

const TAG_URL = "https://mc.yandex.ru/metrika/tag.js";

/** Опции счётчика старого сайта; `defer: true` — хиты отправляются вручную при смене маршрута */
const INIT_OPTIONS = {
  defer: true,
  clickmap: true,
  trackLinks: true,
  accurateTrackBounce: true,
  webvisor: true,
  ssr: true,
} as const;

type YmStub = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

// Состояние модуля: init один раз за жизнь вкладки, без повторного хита того же URL
// (StrictMode в dev вызывает эффекты дважды)
let initializedId: number | null = null;
let lastHitUrl: string | null = null;

/**
 * Очередь `ym` из официального сниппета: вызовы до загрузки tag.js копятся в `ym.a`
 * и выполняются по порядку после загрузки (init → hit).
 */
function ensureYmQueue(): void {
  if (typeof window.ym === "function") return;
  const stub: YmStub = (...args: unknown[]) => {
    (stub.a ??= []).push(args);
  };
  stub.l = Date.now();
  window.ym = stub;
}

function parseCounterId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Яндекс Метрика: подключается только после согласия «Принять» (`cookie_consent=all`)
 * и при заданном `NEXT_PUBLIC_YM_ID`. Без согласия к mc.yandex.ru нет ни одного запроса.
 * `<noscript>`-пиксель не добавляется — он сработал бы без согласия.
 */
export function Metrika() {
  const consent = useCookieConsent();
  const pathname = usePathname();
  const counterId = parseCounterId(process.env.NEXT_PUBLIC_YM_ID);
  const enabled = consent === "all" && counterId !== null;

  useEffect(() => {
    if (!enabled || counterId === null) return;
    ensureYmQueue();
    const ym = window.ym;
    if (!ym) return;
    if (initializedId !== counterId) {
      ym(counterId, "init", INIT_OPTIONS);
      initializedId = counterId;
    }
    // Хит на каждую смену пути, включая первый показ страницы
    const url = window.location.pathname + window.location.search;
    if (url === lastHitUrl) return;
    // Реферер клиентского перехода — предыдущая страница сайта, первого хита — внешний
    const referer = lastHitUrl ? window.location.origin + lastHitUrl : document.referrer;
    lastHitUrl = url;
    ym(counterId, "hit", url, { referer });
  }, [enabled, counterId, pathname]);

  if (!enabled) return null;
  return <Script id="yandex-metrika" src={TAG_URL} strategy="afterInteractive" />;
}
