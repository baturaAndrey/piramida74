"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMediaAction, updateMediaAlt } from "@/app/(admin)/admin/media/actions";
import { Picture } from "@/components/media/picture";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadMedia } from "@/lib/admin/media-client";
import { folderLabel, formatBytes } from "@/lib/admin/media-dto";
import type { MediaDto, MediaListResponse } from "@/lib/admin/media-dto";
import { TZ } from "@/lib/dates";
import type { MediaUsage } from "@/lib/media/storage";
import { ConfirmDialog } from "./confirm-dialog";
import { MediaDropzone } from "./media-dropzone";
import { MediaFilters } from "./media-filters";
import { MediaThumb } from "./media-thumb";
import { useMediaList } from "./use-media-list";

type MediaLibraryProps = {
  /** Первая страница без фильтров, прочитанная сервером */
  initial: MediaListResponse;
  /** Папки, в которых есть файлы */
  folders: string[];
};

const DEFAULT_UPLOAD_FOLDER = "general";
const MAX_ALT_LENGTH = 300;

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  dateStyle: "short",
  timeStyle: "short",
});

/** UI страницы медиатеки: загрузка (dropzone), поиск/фильтр, сетка, карточка с alt и удалением. */
export function MediaLibrary({ initial, folders }: MediaLibraryProps) {
  const list = useMediaList({ initial });
  const [upload, setUpload] = useState<{ current: number; total: number } | null>(null);
  const [active, setActive] = useState<MediaDto | null>(null);
  const uploadFolder = list.folder || DEFAULT_UPLOAD_FOLDER;

  async function handleFiles(files: File[]) {
    let succeeded = 0;
    // Последовательно: проще показывать прогресс и не перегружать обработку изображений на сервере
    for (const [index, file] of files.entries()) {
      setUpload({ current: index + 1, total: files.length });
      try {
        const asset = await uploadMedia(file, { folder: uploadFolder });
        list.prepend(asset);
        succeeded += 1;
      } catch (error) {
        toast.error(
          `«${file.name}»: ${error instanceof Error ? error.message : "ошибка загрузки"}`
        );
      }
    }
    setUpload(null);
    if (succeeded > 0) toast.success(`Загружено файлов: ${succeeded} из ${files.length}`);
  }

  return (
    <div className="space-y-6">
      <MediaDropzone
        multiple
        disabled={upload !== null}
        onFiles={(files) => void handleFiles(files)}
        status={
          upload
            ? `Загрузка ${upload.current} из ${upload.total}…`
            : `Файлы попадут в папку «${folderLabel(uploadFolder)}»`
        }
      />

      <MediaFilters
        query={list.query}
        onQueryChange={list.setQuery}
        folder={list.folder}
        onFolderChange={list.setFolder}
        folders={folders}
      />

      {list.loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-label="Загрузка" />
        </div>
      ) : list.error ? (
        <p className="text-destructive py-12 text-center text-sm">{list.error}</p>
      ) : list.items.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">Файлов не найдено</p>
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Показано {list.items.length} из {list.total}
          </p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {list.items.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => setActive(asset)}
                  className="group focus-visible:ring-ring/50 block w-full space-y-1 rounded-lg text-left focus-visible:ring-[3px] focus-visible:outline-none"
                >
                  <MediaThumb asset={asset} className="transition-opacity group-hover:opacity-90" />
                  <span className="block truncate text-sm font-medium" title={asset.originalName}>
                    {asset.originalName}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {formatBytes(asset.size)} · {folderLabel(asset.folder)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {list.hasMore ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => void list.loadMore()}
                disabled={list.loadingMore}
              >
                {list.loadingMore ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Загрузить ещё
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {active ? (
            <MediaDetails
              // key: при открытии другого файла состояние формы alt сбрасывается
              key={active.id}
              asset={active}
              onUpdated={(asset) => {
                list.replace(asset);
                setActive(asset);
              }}
              onDeleted={(id) => {
                list.remove(id);
                setActive(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MediaDetails({
  asset,
  onUpdated,
  onDeleted,
}: {
  asset: MediaDto;
  onUpdated: (asset: MediaDto) => void;
  onDeleted: (id: string) => void;
}) {
  const [alt, setAlt] = useState(asset.alt);
  const [savingAlt, setSavingAlt] = useState(false);
  const [usages, setUsages] = useState<MediaUsage[] | null>(null);
  const altChanged = alt.trim() !== asset.alt;

  async function saveAlt() {
    setSavingAlt(true);
    try {
      const result = await updateMediaAlt({ id: asset.id, alt });
      if (!result.ok) {
        toast.error(result.fieldErrors?.alt?.[0] ?? result.error);
        return;
      }
      onUpdated({ ...asset, alt: result.data.alt });
      toast.success("Описание сохранено");
    } catch {
      toast.error("Не удалось сохранить описание");
    } finally {
      setSavingAlt(false);
    }
  }

  // Исключение оставит ConfirmDialog открытым и покажет toast
  async function remove() {
    const result = await deleteMediaAction({ id: asset.id });
    if (!result.ok) throw new Error(result.error);
    if (!result.data.deleted) {
      setUsages(result.data.usages);
      toast.error("Файл используется — удаление невозможно");
      return;
    }
    toast.success("Файл удалён");
    onDeleted(asset.id);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="truncate pr-6">{asset.originalName}</DialogTitle>
        <DialogDescription>
          {asset.width}×{asset.height} · {formatBytes(asset.size)} · папка «
          {folderLabel(asset.folder)}» · {dateFormat.format(new Date(asset.createdAt))}
        </DialogDescription>
      </DialogHeader>

      <div className="bg-muted overflow-hidden rounded-lg border">
        <Picture
          asset={asset}
          sizes="(min-width: 768px) 720px, 100vw"
          alt={asset.alt || asset.originalName}
          className="mx-auto max-h-[50vh] w-auto object-contain"
          pictureClassName="block"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="media-alt">Описание (alt)</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="media-alt"
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            maxLength={MAX_ALT_LENGTH}
            placeholder="Что изображено на картинке"
            disabled={savingAlt}
          />
          <Button
            type="button"
            onClick={() => void saveAlt()}
            disabled={savingAlt || !altChanged}
            className="shrink-0"
          >
            {savingAlt ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Сохранить alt
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Используется для доступности и SEO; обновится на сайте во всех местах, где стоит картинка.
        </p>
      </div>

      {usages && usages.length > 0 ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 space-y-1 rounded-md border p-3 text-sm"
        >
          <p className="text-destructive font-medium">Файл используется — удаление невозможно.</p>
          <p className="text-muted-foreground">Используется в:</p>
          <ul className="list-inside list-disc">
            {usages.map((usage) => (
              <li key={`${usage.entity}-${usage.label}`}>
                {usage.label} ({usage.count})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <DialogFooter className="sm:justify-start">
        <ConfirmDialog
          trigger={
            <Button type="button" variant="outline" className="text-destructive">
              <Trash2 className="h-4 w-4" aria-hidden />
              Удалить
            </Button>
          }
          title="Удалить файл?"
          description="Файл будет удалён с диска без возможности восстановления. Используемые файлы не удаляются."
          onConfirm={remove}
        />
      </DialogFooter>
    </>
  );
}
