"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uploadMedia } from "@/lib/admin/media-client";
import type { MediaDto } from "@/lib/admin/media-dto";
import { cn } from "@/lib/utils";
import { MediaDropzone } from "./media-dropzone";
import { MediaFilters } from "./media-filters";
import { MediaThumb } from "./media-thumb";
import { useMediaList } from "./use-media-list";

export type MediaPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Вызывается кнопкой «Выбрать»; в одиночном режиме — массив из одного элемента */
  onSelect: (assets: MediaDto[]) => void;
  multiple?: boolean;
  /** Папка для файлов, загруженных из пикера (по умолчанию `general`); список показывает все папки */
  folder?: string;
};

type PickerTab = "library" | "upload";

/** Диалог выбора картинок из медиатеки (одиночный или множественный выбор) с вкладкой загрузки. */
export function MediaPicker({ open, onOpenChange, ...rest }: MediaPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
        {/* Тело монтируется только в открытом диалоге: выбор и вкладка сбрасываются при каждом открытии */}
        {open ? <MediaPickerBody onOpenChange={onOpenChange} {...rest} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function MediaPickerBody({
  onOpenChange,
  onSelect,
  multiple = false,
  folder = "general",
}: Omit<MediaPickerProps, "open">) {
  const list = useMediaList();
  const [tab, setTab] = useState<PickerTab>("library");
  // Map сохраняет порядок выбора и сами ассеты (они могут уйти из списка при смене фильтра)
  const [selected, setSelected] = useState<Map<string, MediaDto>>(new Map());
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);

  function toggle(asset: MediaDto) {
    setSelected((prev) => {
      const next = new Map(multiple ? prev : []);
      if (prev.has(asset.id)) next.delete(asset.id);
      else next.set(asset.id, asset);
      return next;
    });
  }

  async function handleFiles(files: File[]) {
    setUpload({ done: 0, total: files.length });
    const uploaded: MediaDto[] = [];
    for (const [index, file] of files.entries()) {
      try {
        const asset = await uploadMedia(file, { folder });
        uploaded.push(asset);
        list.prepend(asset);
      } catch (error) {
        toast.error(
          `«${file.name}»: ${error instanceof Error ? error.message : "ошибка загрузки"}`
        );
      }
      setUpload({ done: index + 1, total: files.length });
    }
    setUpload(null);
    if (uploaded.length === 0) return;
    // Загруженные файлы сразу выбраны; в одиночном режиме — последний
    setSelected((prev) => {
      const next = new Map(multiple ? prev : []);
      for (const asset of multiple ? uploaded : uploaded.slice(-1)) next.set(asset.id, asset);
      return next;
    });
    setTab("library");
  }

  function confirm() {
    onSelect(Array.from(selected.values()));
    onOpenChange(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{multiple ? "Выбор изображений" : "Выбор изображения"}</DialogTitle>
        <DialogDescription>
          {multiple
            ? "Отметьте одно или несколько изображений и нажмите «Выбрать»."
            : "Отметьте изображение и нажмите «Выбрать»."}
        </DialogDescription>
      </DialogHeader>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as PickerTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList>
          <TabsTrigger value="library">Медиатека</TabsTrigger>
          <TabsTrigger value="upload">Загрузить</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="flex min-h-0 flex-1 flex-col gap-4">
          <MediaFilters
            query={list.query}
            onQueryChange={list.setQuery}
            folder={list.folder}
            onFolderChange={list.setFolder}
          />
          <div className="min-h-48 flex-1 overflow-y-auto">
            {list.loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2
                  className="text-muted-foreground h-6 w-6 animate-spin"
                  aria-label="Загрузка"
                />
              </div>
            ) : list.error ? (
              <p className="text-destructive py-12 text-center text-sm">{list.error}</p>
            ) : list.items.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-sm">Файлов не найдено</p>
            ) : (
              <div className="space-y-4">
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {list.items.map((asset) => {
                    const isSelected = selected.has(asset.id);
                    return (
                      <li key={asset.id}>
                        <button
                          type="button"
                          onClick={() => toggle(asset)}
                          aria-pressed={isSelected}
                          aria-label={asset.alt || asset.originalName}
                          title={asset.originalName}
                          className={cn(
                            "focus-visible:ring-ring/50 relative block w-full rounded-md ring-offset-2 transition-shadow focus-visible:ring-[3px] focus-visible:outline-none",
                            isSelected && "ring-primary ring-2"
                          )}
                        >
                          <MediaThumb asset={asset} sizes="160px" />
                          {isSelected ? (
                            <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full shadow-sm">
                              <Check className="h-4 w-4" aria-hidden />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {list.hasMore ? (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void list.loadMore()}
                      disabled={list.loadingMore}
                    >
                      {list.loadingMore ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : null}
                      Загрузить ещё
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="upload">
          <MediaDropzone
            multiple={multiple}
            disabled={upload !== null}
            onFiles={(files) => void handleFiles(files)}
            status={
              upload
                ? `Загрузка ${Math.min(upload.done + 1, upload.total)} из ${upload.total}…`
                : null
            }
            className="min-h-48"
          />
        </TabsContent>
      </Tabs>

      <DialogFooter className="items-center gap-2 sm:justify-between">
        <span className="text-muted-foreground text-sm">
          {selected.size > 0 ? `Выбрано: ${selected.size}` : "Ничего не выбрано"}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={confirm} disabled={selected.size === 0 || upload !== null}>
            Выбрать
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
