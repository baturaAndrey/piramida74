"use client";

import { Suspense, useId } from "react";
import { Slot } from "@radix-ui/react-slot";
import { toast } from "sonner";
import { LazyBoundary } from "@/components/lazy-boundary";
import { createPrefetch, useLazyDialog } from "@/hooks/use-lazy-dialog";
import { useRetryableLazy } from "@/hooks/use-retryable-lazy";
import { isChunkLoadError } from "@/lib/chunk-load-error";

type PolicyDialogProps = {
  title: string;
  /**
   * Текст документа, уже отрендеренный на сервере (`<PolicyDocument>` из policy-document.tsx):
   * react-markdown не попадает в клиентский бандл. Реквизиты подставлены заранее
   * (getCurrentLegalDocument).
   */
  content: React.ReactNode;
  /** Триггер (рендерится через Slot, как прежний `DialogTrigger asChild`) */
  children: React.ReactNode;
};

/*
 * Radix Dialog (react-remove-scroll, FocusScope, DismissableLayer) — в отдельном чанке:
 * футер есть на каждой странице, а попап открывают редко. В начальном бандле — только
 * кнопка-триггер. Предзагрузка и ленивый компонент (`useRetryableLazy`) вызывают один загрузчик.
 */
const loadPolicyDialogContent = () => import("./policy-dialog-content");
const prefetchPolicyDialog = createPrefetch(loadPolicyDialogContent);

const CHUNK_ERROR_TOAST_ID = "policy-dialog-chunk-error";

/** Диалог с текстом политики/согласия; данные передаёт серверный родитель (футер). */
export function PolicyDialog({ title, content, children }: PolicyDialogProps) {
  const contentId = useId();
  const { open, setOpen, mounted, triggerRef, triggerProps } = useLazyDialog({
    contentId,
    prefetch: prefetchPolicyDialog,
  });
  const [PolicyDialogContent, retryPolicyDialogContent] = useRetryableLazy(loadPolicyDialogContent);

  // Чанк не загрузился (сеть, новый деплой): закрываем попап с тостом вместо error.tsx и
  // пересоздаём ленивый компонент, чтобы следующее открытие загрузило чанк заново. Тост — только
  // для попытки открыть (граница может поймать сбой повторно уже при open === false).
  // Прочие ошибки рендера — не сеть: попап тоже закрываем, но ошибку логируем.
  const handleContentError = (error: unknown) => {
    if (isChunkLoadError(error)) {
      retryPolicyDialogContent();
      if (open) {
        toast.error("Не удалось открыть документ. Проверьте соединение и обновите страницу.", {
          id: CHUNK_ERROR_TOAST_ID,
        });
      }
    } else {
      console.error(error);
    }
    setOpen(false);
  };

  return (
    <>
      {/* data-slot — как у прежнего DialogTrigger: DOM кнопки не меняется */}
      <Slot data-slot="dialog-trigger" {...triggerProps}>
        {children}
      </Slot>
      {mounted ? (
        <LazyBoundary resetKey={open} onError={handleContentError}>
          <Suspense fallback={null}>
            <PolicyDialogContent
              title={title}
              content={content}
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
