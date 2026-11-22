"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { ArticleBody } from "@/components/blog/article-body";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ContentPreviewButtonProps = {
  /** Текущий Markdown формы — читается в момент открытия */
  getSource: () => string;
  showToc?: boolean;
  title?: string;
};

/**
 * Клиентский предпросмотр текста статьи: тот же изоморфный `ArticleBody`, что и на сайте
 * (видео/документы — настоящие `VideoEmbed`/`DocumentEmbed`), без запросов на сервер.
 */
export function ContentPreviewButton({
  getSource,
  showToc = true,
  title,
}: ContentPreviewButtonProps) {
  const [source, setSource] = useState<string | null>(null);

  function openPreview() {
    const body = getSource();
    if (!body.trim()) {
      toast.info("Текст пока пуст — нечего показывать");
      return;
    }
    setSource(body);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openPreview}>
        <Eye className="h-4 w-4" aria-hidden />
        Предпросмотр
      </Button>
      <Dialog
        open={source !== null}
        onOpenChange={(open) => {
          if (!open) setSource(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Предпросмотр (может отличаться от финальной страницы)</DialogTitle>
            <DialogDescription>
              Оформление текста, картинок, видео и врезок — как на сайте. Обложка, автор и
              оглавление показываются только на странице статьи.
            </DialogDescription>
          </DialogHeader>
          {title ? <h1 className="text-h2 font-bold">{title}</h1> : null}
          {source !== null ? <ArticleBody body={source} withToc={showToc} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
