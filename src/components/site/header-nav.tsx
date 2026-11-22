"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";
import type { SiteSettings } from "@/lib/settings-defaults";
import { cn } from "@/lib/utils";
import { Container } from "./container";
import { MobileMenu } from "./mobile-menu";
import { isNavItemActive, NAV_ITEMS } from "./nav-items";

type HeaderNavProps = {
  settings: SiteSettings;
  /** Верхняя (не закрепляемая) часть шапки — рендерится под полосой навигации */
  children: React.ReactNode;
};

/** Ширина `lg`: с неё меню в строку, ниже — бургер */
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Закрепляемая полоса шапки (`.header__nav` старого сайта): `sticky top-0`.
 * До прокрутки сливается с фоном; когда верхняя часть шапки ушла за край окна
 * (сентинел под ней перестал пересекаться с окном) — `bg-nav` с тенью, как `.header__nav.fixed`.
 * ≥ lg: пункты меню; ниже — логотип, телефон и бургер.
 */
export function HeaderNav({ settings, children }: HeaderNavProps) {
  const pathname = usePathname();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  // Меню открыто «для» конкретного пути: смена маршрута закрывает его без эффекта
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const setMenuOpen = (open: boolean) => setMenuPath(open ? pathname : null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Панель мобильного меню не нужна на десктопе: закрываем при расширении окна до lg
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuPath(null);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <div
        className={cn(
          "sticky top-0 transition-[background-color,box-shadow] duration-300",
          // Пока открыто мобильное меню, полоса поверх затемнения (z-50), чтобы бургер стал крестиком
          menuOpen ? "z-[60]" : "z-40",
          stuck || menuOpen ? "bg-nav shadow-sm" : "bg-background"
        )}
      >
        <Container>
          {/* Мобильная полоса */}
          <div className="flex h-[72px] items-center justify-between gap-3 lg:hidden">
            <Link href="/" className="shrink-0 rounded-md">
              <Image
                src="/images/logo.png"
                width={125}
                height={106}
                loading="eager"
                alt="Бильярдный клуб «Пирамида» — на главную"
                className="h-auto w-16"
              />
            </Link>
            <div className="flex items-center gap-3 sm:gap-5">
              <a
                href={settings.phoneHref}
                aria-label={`Позвонить: ${settings.phone}`}
                className="text-primary hover:text-primary-dark flex items-center gap-2 font-bold transition-colors"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-white shadow-[0_0_40px_rgb(198_198_198/0.45)]">
                  <Phone className="size-5" aria-hidden="true" />
                </span>
                <span className="text-foreground hidden text-base sm:inline">{settings.phone}</span>
              </a>
              <MobileMenu
                settings={settings}
                pathname={pathname}
                open={menuOpen}
                onOpenChange={setMenuOpen}
              />
            </div>
          </div>

          {/* Десктопное меню */}
          <nav aria-label="Основное меню" className="hidden lg:block">
            <ul className="flex items-center justify-between gap-x-2">
              {NAV_ITEMS.map((item) => {
                const active = isNavItemActive(item.href, pathname);
                return (
                  <li key={item.href} className="min-w-max">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "hover:text-primary relative inline-block py-[clamp(14px,1.354vw,26px)] text-[clamp(12px,0.73vw,14px)] font-semibold tracking-[clamp(0.5px,0.083vw,1.6px)] uppercase transition-colors duration-300",
                        // Подчёркивание 1px: у активного — во всю ширину, при hover — 60%
                        "after:bg-primary after:absolute after:bottom-[calc(clamp(14px,1.354vw,26px)-6px)] after:left-0 after:h-px after:transition-[width] after:duration-300 hover:after:w-[60%]",
                        active ? "text-primary after:w-full" : "text-muted-foreground after:w-0"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Container>
      </div>
      {children}
      {/* Сентинел: пока он в окне, полоса «не закреплена» */}
      <div ref={sentinelRef} aria-hidden="true" className="-mt-px h-px" />
    </>
  );
}
