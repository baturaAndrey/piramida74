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
  SheetTrigger,
} from "@/components/ui/sheet";
import type { SiteSettings } from "@/lib/settings-defaults";
import { cn } from "@/lib/utils";
import { isNavItemActive, NAV_ITEMS } from "./nav-items";
import { PrimaryButton } from "./primary-button";
import { TelegramIcon, VkIcon } from "./social-icons";

type MobileMenuProps = {
  settings: SiteSettings;
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PANEL_ID = "mobile-menu-panel";

/**
 * Бургер (.header__btn старого сайта) и выезжающая справа панель с меню и контактами.
 * Состояние открытия — у родителя (полоса шапки поднимается над затемнением, чтобы бургер
 * был виден крестиком). Закрывается по ссылке, Esc, клику вне панели и смене маршрута;
 * фокус возвращается на бургер (Radix Dialog).
 */
export function MobileMenu({ settings, pathname, open, onOpenChange }: MobileMenuProps) {
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground hidden w-9 text-[10px] leading-tight sm:block">
          Меню сайта
        </span>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={open ? "Закрыть меню" : "Меню"}
            aria-expanded={open}
            aria-controls={PANEL_ID}
            className="relative z-[60] flex size-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_0_40px_rgb(198_198_198/0.45)]"
          >
            <span aria-hidden="true" className="relative block h-3.5 w-5">
              <span
                className={cn(
                  "bg-primary absolute left-0 h-0.5 w-full rounded-full transition-all duration-300",
                  open ? "top-1/2 -translate-y-1/2 -rotate-45" : "top-0"
                )}
              />
              <span
                className={cn(
                  "bg-primary absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2 rounded-full transition-all duration-300",
                  open && "opacity-0"
                )}
              />
              <span
                className={cn(
                  "bg-primary absolute left-0 h-0.5 rounded-full transition-all duration-300",
                  open ? "bottom-1/2 w-full translate-y-1/2 rotate-45" : "bottom-0 w-[44%]"
                )}
              />
            </span>
          </button>
        </SheetTrigger>
      </div>

      <SheetContent
        id={PANEL_ID}
        side="right"
        showCloseButton={false}
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
