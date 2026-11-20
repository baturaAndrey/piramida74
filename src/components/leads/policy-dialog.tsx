"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PolicyDialogProps = {
  title: string;
  /**
   * Текст документа, уже отрендеренный на сервере (`<PolicyDocument>` из policy-document.tsx):
   * react-markdown не попадает в клиентский бандл. Реквизиты подставлены заранее
   * (getCurrentLegalDocument).
   */
  content: React.ReactNode;
  /** Триггер (рендерится через asChild) */
  children: React.ReactNode;
};

/** Диалог с текстом политики/согласия; данные передаёт серверный родитель (футер). */
export function PolicyDialog({ title, content, children }: PolicyDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="pr-6 text-xl font-bold md:text-2xl">{title}</DialogTitle>
          <DialogDescription className="sr-only">Полный текст документа</DialogDescription>
        </DialogHeader>
        <div className="text-foreground">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
