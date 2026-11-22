"use client";

import { Suspense, useRef, useState } from "react";
import { toast } from "sonner";
import { LazyBoundary } from "@/components/lazy-boundary";
import { createPrefetch } from "@/hooks/use-lazy-dialog";
import { useRetryableLazy } from "@/hooks/use-retryable-lazy";
import { isChunkLoadError } from "@/lib/chunk-load-error";
import type { SiteSettings } from "@/lib/settings-defaults";
import { cn } from "@/lib/utils";

type MobileMenuProps = {
  settings: SiteSettings;
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PANEL_ID = "mobile-menu-panel";

/*
 * Панель (Radix Dialog: react-remove-scroll, FocusScope, DismissableLayer ≈ 20 KB gz) —
 * отдельный чанк: бургер есть в шапке каждой страницы, и статический импорт Sheet тянул
 * Radix Dialog в начальный бандл всего сайта. Предзагрузка и ленивый компонент
 * (`useRetryableLazy`) вызывают один загрузчик — наведение прогревает тот же модуль.
 */
const loadMobileMenuPanel = () => import("./mobile-menu-panel");
const prefetchMobileMenuPanel = createPrefetch(loadMobileMenuPanel);

const CHUNK_ERROR_TOAST_ID = "mobile-menu-chunk-error";

/**
 * Бургер (.header__btn старого сайта) и выезжающая справа панель с меню и контактами.
 * Состояние открытия — у родителя (полоса шапки поднимается над затемнением, чтобы бургер
 * был виден крестиком). Закрывается по ссылке, кнопке в панели, Esc, клику вне панели (в том
 * числе по месту бургера: пока модальная панель открыта, Radix ставит `pointer-events: none`
 * на body, и клик достаётся затемнению) и смене маршрута; фокус возвращается на бургер
 * (`onCloseAutoFocus` панели).
 */
export function MobileMenu({ settings, pathname, open, onOpenChange }: MobileMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Панель монтируется при первом открытии и дальше остаётся — чтобы играла анимация закрытия
  const [mounted, setMounted] = useState(false);
  const [MobileMenuPanel, retryMobileMenuPanel] = useRetryableLazy(loadMobileMenuPanel);

  const toggle = () => {
    if (!open) setMounted(true);
    onOpenChange(!open);
  };

  // Чанк панели не загрузился (сеть, новый деплой): закрываем меню с подсказкой вместо error.tsx
  // и пересоздаём ленивый компонент — следующее открытие загрузит чанк заново. Тост — только для
  // попытки открыть: после закрытия граница сбрасывается и может поймать сбой ещё раз уже при
  // open === false. Прочие ошибки рендера — не сеть: меню тоже закрываем, но ошибку логируем.
  const handlePanelError = (error: unknown) => {
    if (isChunkLoadError(error)) {
      retryMobileMenuPanel();
      if (open) {
        toast.error("Не удалось открыть меню. Проверьте соединение и обновите страницу.", {
          id: CHUNK_ERROR_TOAST_ID,
        });
      }
    } else {
      console.error(error);
    }
    onOpenChange(false);
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground hidden w-9 text-[10px] leading-tight sm:block">
          Меню сайта
        </span>
        {/* Атрибуты — те же, что ставил SheetTrigger Radix: DOM закрытого состояния не меняется */}
        <button
          ref={triggerRef}
          type="button"
          data-slot="sheet-trigger"
          aria-haspopup="dialog"
          aria-label={open ? "Закрыть меню" : "Меню"}
          aria-expanded={open}
          aria-controls={PANEL_ID}
          data-state={open ? "open" : "closed"}
          onPointerEnter={prefetchMobileMenuPanel}
          onFocus={prefetchMobileMenuPanel}
          onClick={toggle}
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
      </div>

      {mounted || open ? (
        // fallback={null}: чанк уже предзагружен наведением/фокусом либо догрузится за доли секунды
        <LazyBoundary resetKey={open} onError={handlePanelError}>
          <Suspense fallback={null}>
            <MobileMenuPanel
              settings={settings}
              pathname={pathname}
              open={open}
              onOpenChange={onOpenChange}
              panelId={PANEL_ID}
              triggerRef={triggerRef}
            />
          </Suspense>
        </LazyBoundary>
      ) : null}
    </>
  );
}
