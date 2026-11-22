"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { restoreFocusOnClose } from "@/hooks/use-lazy-dialog";

/**
 * Попап с текстом политики (Radix Dialog) — отдельный чанк: кнопка есть в футере каждой
 * страницы, и статический импорт Dialog тянул Radix в начальный бандл всего сайта.
 * Грузится лениво из `PolicyDialog` (policy-dialog.tsx).
 */
export type PolicyDialogContentProps = {
  title: string;
  /** Текст документа, отрендеренный на сервере (`<PolicyDocument>`) */
  content: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** id контента — на него ссылается `aria-controls` триггера */
  contentId: string;
  /** Триггер вне Radix (`DialogTrigger` не используется): вернуть на него фокус при закрытии */
  triggerRef: React.RefObject<HTMLElement | null>;
};

/** default export — для `React.lazy` */
export default function PolicyDialogContent({
  title,
  content,
  open,
  onOpenChange,
  contentId,
  triggerRef,
}: PolicyDialogContentProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id={contentId}
        onCloseAutoFocus={restoreFocusOnClose(triggerRef)}
        className="max-h-[85vh] overflow-y-auto bg-white sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="pr-6 text-xl font-bold md:text-2xl">{title}</DialogTitle>
          <DialogDescription className="sr-only">Полный текст документа</DialogDescription>
        </DialogHeader>
        <div className="text-foreground">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
