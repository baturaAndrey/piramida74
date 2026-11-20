"use client";

import { useRef, useState } from "react";

/**
 * «Ленивый» диалог: Radix Dialog и содержимое живут в отдельном чанке (`React.lazy`),
 * а в начальный бандл попадает только кнопка-триггер. Чанк предзагружается при наведении
 * или фокусе на триггер; при клике диалог монтируется и дальше остаётся смонтированным,
 * чтобы отрабатывала анимация закрытия.
 *
 * Триггер не является `DialogTrigger` Radix, поэтому ARIA-атрибуты и `data-state` ставятся
 * здесь, а фокус при закрытии возвращает `restoreFocusOnClose` в `onCloseAutoFocus` контента.
 */

/** Загрузчик чанка → функция предзагрузки без необработанных ошибок */
export function createPrefetch(load: () => Promise<unknown>): () => void {
  return () => {
    // Ошибку сети здесь глушим: при открытии `React.lazy` запросит модуль ещё раз
    load().catch(() => {});
  };
}

/** `onCloseAutoFocus` для DialogContent: вернуть фокус на триггер вне Radix */
export function restoreFocusOnClose(triggerRef: React.RefObject<HTMLElement | null>) {
  return (event: Event) => {
    event.preventDefault();
    triggerRef.current?.focus();
  };
}

type UseLazyDialogOptions = {
  /** id контента диалога — на него ссылается `aria-controls` триггера */
  contentId: string;
  prefetch: () => void;
};

export function useLazyDialog({ contentId, prefetch }: UseLazyDialogOptions) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Те же атрибуты, что ставит Radix DialogTrigger; совместимы и с <button>, и со Slot
  const triggerProps = {
    ref: triggerRef,
    "aria-haspopup": "dialog" as const,
    "aria-expanded": open,
    "aria-controls": contentId,
    "data-state": open ? ("open" as const) : ("closed" as const),
    onPointerEnter: prefetch,
    onFocus: prefetch,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      // Как composeEventHandlers у Radix: обработчик дочернего элемента может отменить открытие
      if (event.defaultPrevented) return;
      setMounted(true);
      setOpen(true);
    },
  };

  return { open, setOpen, mounted, triggerRef, triggerProps };
}
