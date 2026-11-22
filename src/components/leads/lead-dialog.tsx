"use client";

import { Suspense, useId } from "react";
import { Slot } from "@radix-ui/react-slot";
import { toast } from "sonner";
import { LazyBoundary } from "@/components/lazy-boundary";
import { createPrefetch, useLazyDialog } from "@/hooks/use-lazy-dialog";
import { useRetryableLazy } from "@/hooks/use-retryable-lazy";
import { isChunkLoadError } from "@/lib/chunk-load-error";

export type LeadDialogKind = "callback" | "booking" | "promo" | "tournament";

type LeadDialogTriggerProps = {
  kind: LeadDialogKind;
  block: string;
  formTitle?: string;
  promotionId?: string;
  tournamentId?: string;
  asChild?: boolean;
  className?: string;
  children: React.ReactNode;
};

/*
 * Попап (Radix Dialog + форма с react-hook-form, zod и маской телефона) — отдельный чанк.
 * Триггер есть в шапке каждой страницы, поэтому статический импорт тянул форму в начальный
 * бандл всего сайта. Предзагрузка и ленивый компонент (`useRetryableLazy`) вызывают один
 * загрузчик — наведение прогревает тот же модуль.
 */
const loadLeadDialogContent = () => import("./lead-dialog-content");
const prefetchLeadDialog = createPrefetch(loadLeadDialogContent);

/** Один тост на все триггеры страницы: повторные клики обновляют его, а не множат */
const CHUNK_ERROR_TOAST_ID = "lead-dialog-chunk-error";

/** Кнопка-триггер + попап с формой заявки (замена попапов старого сайта). */
export function LeadDialogTrigger({
  kind,
  block,
  formTitle,
  promotionId,
  tournamentId,
  asChild = false,
  className,
  children,
}: LeadDialogTriggerProps) {
  const contentId = useId();
  const { open, setOpen, mounted, triggerRef, triggerProps } = useLazyDialog({
    contentId,
    prefetch: prefetchLeadDialog,
  });
  const [LeadDialogContent, retryLeadDialogContent] = useRetryableLazy(loadLeadDialogContent);

  // Чанк формы не загрузился (сеть, новый деплой): закрываем попап с подсказкой вместо error.tsx
  // и пересоздаём ленивый компонент, чтобы «попробуйте ещё раз» действительно загрузило чанк.
  // Тост — только для попытки открыть: после setOpen(false) граница сбрасывается и может поймать
  // сбой ещё раз уже при open === false. Прочие ошибки рендера — не сеть: закрываем и логируем.
  const handleContentError = (error: unknown) => {
    if (isChunkLoadError(error)) {
      retryLeadDialogContent();
      if (open) {
        toast.error(
          "Не удалось открыть форму. Проверьте соединение и попробуйте ещё раз или позвоните нам.",
          { id: CHUNK_ERROR_TOAST_ID }
        );
      }
    } else {
      console.error(error);
    }
    setOpen(false);
  };

  return (
    <>
      {asChild ? (
        <Slot className={className} {...triggerProps}>
          {children}
        </Slot>
      ) : (
        <button type="button" className={className} {...triggerProps}>
          {children}
        </button>
      )}
      {mounted ? (
        // fallback={null}: чанк уже предзагружен наведением/фокусом либо догрузится за доли секунды
        <LazyBoundary resetKey={open} onError={handleContentError}>
          <Suspense fallback={null}>
            <LeadDialogContent
              kind={kind}
              block={block}
              formTitle={formTitle}
              promotionId={promotionId}
              tournamentId={tournamentId}
              open={open}
              onOpenChange={setOpen}
              contentId={contentId}
              triggerRef={triggerRef}
            />
          </Suspense>
        </LazyBoundary>
      ) : null}
    </>
  );
}
