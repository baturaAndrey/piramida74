"use client";

import Link from "next/link";
import { Clock, MapPin, Phone } from "lucide-react";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { restoreFocusOnClose } from "@/hooks/use-lazy-dialog";
import type { SiteSettings } from "@/lib/settings-defaults";
import { cn } from "@/lib/utils";
import { isNavItemActive, NAV_ITEMS } from "./nav-items";
import { PrimaryButton } from "./primary-button";
import { TelegramIcon, VkIcon } from "./social-icons";

/**
 * Панель мобильного меню (Radix Dialog через Sheet) — отдельный чанк. Бургер есть в шапке
 * каждой страницы, и статический импорт Sheet тянул react-remove-scroll, FocusScope и
 * DismissableLayer (≈ 20 KB gz) в начальный бандл всего сайта. Грузится лениво из
 * `MobileMenu` (mobile-menu.tsx) при наведении/фокусе/клике на бургер.
 */
export type MobileMenuPanelProps = {
  settings: SiteSettings;
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** id панели — на него ссылается `aria-controls` бургера */
  panelId: string;
  /** Бургер вне Radix (`SheetTrigger` не используется): на него возвращается фокус */
  triggerRef: React.RefObject<HTMLElement | null>;
};

/** Панель с меню и контактами; default export — для `React.lazy`. */
export default function MobileMenuPanel({
  settings,
  pathname,
  open,
  onOpenChange,
  panelId,
  triggerRef,
}: MobileMenuPanelProps) {
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        id={panelId}
        side="right"
        showCloseButton={false}
        // Особой обработки бургера в onInteractOutside не нужно: модальная панель ставит
        // `pointer-events: none` на body (клик по месту бургера достаётся затемнению и закрывает
        // панель), а уход фокуса наружу FocusScope не пускает и Radix сам игнорирует.
        // Без SheetTrigger Radix не знает, куда вернуть фокус: возвращаем на бургер
        onCloseAutoFocus={restoreFocusOnClose(triggerRef)}
        // Панель начинается под полосой шапки (она поверх затемнения, как в оригинале)
        className="bg-nav w-[min(88vw,380px)] gap-0 overflow-y-auto border-l-0 px-6 pt-24 pb-8 sm:max-w-none"
      >
        <SheetTitle className="sr-only">Меню сайта</SheetTitle>
        <SheetDescription className="sr-only">Разделы сайта и контакты клуба</SheetDescription>
        <nav aria-label="Меню сайта">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isNavItemActive(item.href, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "hover:text-primary block py-2 text-lg font-semibold transition-colors",
                      active ? "text-primary" : "text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-foreground/10 mt-6 space-y-4 border-t pt-6 text-sm">
          <p className="flex gap-3">
            <MapPin className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <span>
              {settings.address}
              {settings.addressNote ? (
                <span className="text-subtle block">{settings.addressNote}</span>
              ) : null}
            </span>
          </p>
          <p className="flex items-center gap-3">
            <Clock className="text-primary size-5 shrink-0" aria-hidden="true" />
            <span>{settings.hours}</span>
          </p>
          <a
            href={settings.phoneHref}
            className="hover:text-primary flex items-center gap-3 text-lg font-bold transition-colors"
          >
            <Phone className="text-primary size-5 shrink-0" aria-hidden="true" />
            {settings.phone}
          </a>
          <div className="flex items-center gap-3 pt-1">
            {settings.telegramUrl ? (
              <a
                href={settings.telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Написать в Telegram"
                className="border-border flex size-11 items-center justify-center rounded-lg border bg-white text-[#05a0eb] transition-transform hover:scale-110"
              >
                <TelegramIcon className="size-5" />
              </a>
            ) : null}
            {settings.vkUrl ? (
              <a
                href={settings.vkUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Мы во ВКонтакте"
                className="border-border flex size-11 items-center justify-center rounded-lg border bg-white text-[#0561eb] transition-transform hover:scale-110"
              >
                <VkIcon className="size-6" />
              </a>
            ) : null}
          </div>
        </div>

        <LeadDialogTrigger kind="callback" block="Шапка сайта" asChild>
          <PrimaryButton className="mt-6 h-14 w-full text-base">Заказать звонок</PrimaryButton>
        </LeadDialogTrigger>

        {/* Бургер-крестик вне фокус-ловушки панели: закрытие с клавиатуры (кроме Esc) — здесь.
            В конце панели, чтобы автофокус при открытии попадал на первый пункт меню. */}
        <SheetClose className="text-primary mt-6 self-center rounded-md px-3 py-2 text-sm font-semibold underline-offset-4 hover:underline">
          Закрыть меню
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
