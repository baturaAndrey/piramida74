"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useCookieConsent, writeConsent } from "./cookie-consent";
import { PrimaryButton } from "./primary-button";

/**
 * CSS-переменная на <html> с занятой плашкой высотой (с отступом снизу):
 * кнопка «наверх» поднимается над плашкой, а не перекрывается ею.
 */
export const COOKIE_BANNER_OFFSET_VAR = "--cookie-banner-offset";

/**
 * Плашка согласия на cookie и Яндекс Метрику (#cookie_notification старого сайта).
 * Показывается, только когда решения нет; до гидрации не рендерится, чтобы не мигать.
 */
export function CookieBanner() {
  const consent = useCookieConsent();
  if (consent !== null) return null;
  return <CookieBannerPanel />;
}

function CookieBannerPanel() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => {
      const offset = window.innerHeight - el.getBoundingClientRect().top;
      root.style.setProperty(COOKIE_BANNER_OFFSET_VAR, `${Math.max(0, Math.round(offset))}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty(COOKIE_BANNER_OFFSET_VAR);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Cookie"
      aria-describedby="cookie-banner-text"
      className="animate-fade-up fixed inset-x-3 bottom-3 z-50 rounded-xl bg-white p-4 shadow-lg sm:right-6 sm:bottom-6 sm:left-auto sm:max-w-md md:p-5"
    >
      <p id="cookie-banner-text" className="text-foreground text-sm leading-relaxed">
        Для улучшения работы сайта мы используем файлы cookie и сервис Яндекс Метрика (в т.ч.
        Вебвизор). Подробнее — в{" "}
        <Link href="/politika" className="text-primary underline underline-offset-2">
          политике
        </Link>
        . Вы можете принять все или оставить только необходимые.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <PrimaryButton
          size="sm"
          className="h-11 px-4 text-sm sm:h-11 sm:flex-1"
          onClick={() => writeConsent("all")}
        >
          Принять
        </PrimaryButton>
        <PrimaryButton
          size="sm"
          variant="outline"
          className="h-11 px-4 text-sm sm:h-11 sm:flex-1"
          onClick={() => writeConsent("necessary")}
        >
          Только необходимые
        </PrimaryButton>
      </div>
    </div>
  );
}
