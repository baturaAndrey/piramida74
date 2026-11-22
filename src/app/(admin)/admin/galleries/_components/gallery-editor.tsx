"use client";

import { useId, useRef, useState, useTransition, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Images,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { MediaPicker } from "@/components/admin/media-picker";
import { SortableList } from "@/components/admin/sortable-list";
import { Picture } from "@/components/media/picture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadMedia, validateImageFile } from "@/lib/admin/media-client";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/admin/media-dto";
import { cn } from "@/lib/utils";
import {
  addGalleryItems,
  createGallery,
  deleteGallery,
  removeGalleryItem,
  renameGallery,
  reorderGalleryItems,
  updateGalleryItem,
} from "../_actions";
import { galleryHint } from "../_lib/labels";
import {
  GALLERY_TEXT_MAX,
  GALLERY_TITLE_MAX,
  createGallerySchema,
  type CreateGalleryInput,
} from "../_schema";
import type { AdminGalleryDetail, AdminGalleryItem, AdminGalleryListItem } from "../_queries";

/** Папка медиатеки для фото галерей (метка папки допускает только `[a-z0-9-]`) */
const UPLOAD_FOLDER = "galleries";
/** Одновременных загрузок не больше двух — не перегружаем sharp на сервере */
const UPLOAD_CONCURRENCY = 2;

const galleryHref = (key: string) => `/admin/galleries?key=${encodeURIComponent(key)}`;

// ---------------------------------------------------------------------------
// Навигация по галереям
// ---------------------------------------------------------------------------

export function GalleryNav({
  galleries,
  activeKey,
}: {
  galleries: AdminGalleryListItem[];
  activeKey: string;
}) {
  const router = useRouter();
  const system = galleries.filter((g) => g.isSystem);
  const custom = galleries.filter((g) => !g.isSystem);

  return (
    <div className="space-y-4">
      {/* Мобильные: выпадающий список */}
      <div className="space-y-2 md:hidden">
        <Label htmlFor="gallery-switch">Галерея</Label>
        <Select value={activeKey} onValueChange={(key) => router.push(galleryHref(key))}>
          <SelectTrigger id="gallery-switch" className="w-full">
            <SelectValue placeholder="Выберите галерею" />
          </SelectTrigger>
          <SelectContent>
            {galleries.map((g) => (
              <SelectItem key={g.key} value={g.key}>
                {g.label} ({g.itemCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Десктоп: список ссылок */}
      <nav aria-label="Галереи" className="hidden space-y-4 md:block">
        <GalleryNavGroup title="Системные" items={system} activeKey={activeKey} />
        {custom.length > 0 ? (
          <GalleryNavGroup title="Дополнительные" items={custom} activeKey={activeKey} />
        ) : null}
      </nav>

      <CreateGalleryDialog />
    </div>
  );
}

function GalleryNavGroup({
  title,
  items,
  activeKey,
}: {
  title: string;
  items: AdminGalleryListItem[];
  activeKey: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground px-2 text-xs font-medium">{title}</p>
      <ul className="space-y-1">
        {items.map((g) => {
          const active = g.key === activeKey;
          return (
            <li key={g.key}>
              <Link
                href={galleryHref(g.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
                  active ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/60"
                )}
              >
                <span className="min-w-0 truncate">{g.label}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {g.itemCount}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CreateGalleryDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<CreateGalleryInput>({
    resolver: zodResolver(createGallerySchema),
    defaultValues: { key: "", title: "" },
  });

  async function onSubmit(values: CreateGalleryInput) {
    const result = await createGallery(values);
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (field === "key" || field === "title") {
          form.setError(field, { message: messages[0] ?? result.error });
        }
      }
      toast.error(result.error);
      return;
    }
    toast.success("Галерея создана");
    setOpen(false);
    form.reset();
    router.push(galleryHref(result.data.key));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4" aria-hidden />
          Новая галерея
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая галерея</DialogTitle>
          <DialogDescription>
            Сайт показывает только системные галереи; новые можно привязать к услуге (поле «Галерея»
            в /admin/services).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ключ</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="service_banquet" autoComplete="off" />
                  </FormControl>
                  <FormDescription>
                    Латиница в нижнем регистре, цифры и _. После создания не меняется.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={GALLERY_TITLE_MAX} placeholder="Банкеты" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Создать
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Редактор галереи
// ---------------------------------------------------------------------------

export function GalleryEditor({ gallery }: { gallery: AdminGalleryDetail }) {
  const router = useRouter();
  const hint = galleryHint(gallery.key);

  return (
    <div className="space-y-6">
      <GalleryHeader gallery={gallery} />

      {hint ? (
        <p className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
          Рекомендации: {hint}
        </p>
      ) : null}

      <GalleryUploader galleryKey={gallery.key} onAdded={() => router.refresh()} />

      {gallery.items.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm">
          <Images className="h-8 w-8" aria-hidden />
          Фото ещё нет
        </div>
      ) : (
        <SortableList
          items={gallery.items}
          className="grid grid-cols-2 gap-3 space-y-0 sm:grid-cols-3 lg:grid-cols-4"
          onReorder={async (ids) => {
            const result = await reorderGalleryItems({ key: gallery.key, ids });
            if (result.ok) router.refresh();
            return result;
          }}
          renderItem={(item, ctx) => (
            <GalleryItemCard
              // Пересоздаём карточку после сохранения, чтобы «чистые» значения совпали с БД
              key={`${item.id}:${item.media.alt}:${item.caption}`}
              item={item}
              isMain={ctx.index === 0}
              dragHandle={ctx.dragHandle}
              onMoveUp={ctx.canMoveUp ? ctx.moveUp : undefined}
              onMoveDown={ctx.canMoveDown ? ctx.moveDown : undefined}
              onChanged={() => router.refresh()}
            />
          )}
        />
      )}
    </div>
  );
}

function GalleryHeader({ gallery }: { gallery: AdminGalleryDetail }) {
  const router = useRouter();
  const [title, setTitle] = useState(gallery.title);
  const [pending, startTransition] = useTransition();
  const trimmed = title.trim();
  const dirty = trimmed !== gallery.title && trimmed.length > 0;

  function save() {
    startTransition(async () => {
      const result = await renameGallery({ key: gallery.key, title: trimmed });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Название сохранено");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold break-words">{gallery.label}</h2>
          <p className="text-muted-foreground text-xs">
            Ключ: <code className="font-mono">{gallery.key}</code>
            {gallery.isSystem ? " · системная" : null}
          </p>
          {gallery.services.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              Используется в услугах: {gallery.services.map((s) => `«${s.title}»`).join(", ")}
            </p>
          ) : null}
        </div>
        {gallery.isSystem ? null : (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="outline" size="sm" className="text-destructive">
                <Trash2 className="h-4 w-4" aria-hidden />
                Удалить галерею
              </Button>
            }
            title="Удалить галерею?"
            description={
              gallery.services.length > 0
                ? `Галерея привязана к услугам: ${gallery.services.map((s) => `«${s.title}»`).join(", ")}. Сначала выберите для них другую галерею в разделе «Услуги».`
                : "Фото останутся в медиатеке, удалятся только сама галерея и её порядок."
            }
            onConfirm={async () => {
              const result = await deleteGallery({ key: gallery.key });
              if (result.ok) {
                toast.success("Галерея удалена");
                router.push("/admin/galleries");
              }
              return result;
            }}
          />
        )}
      </div>

      {gallery.isSystem ? null : (
        <div className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="gallery-title">Название</Label>
            <Input
              id="gallery-title"
              value={title}
              maxLength={GALLERY_TITLE_MAX}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          {dirty ? (
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Сохранить
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Загрузка файлов
// ---------------------------------------------------------------------------

type UploadStatus = "pending" | "uploading" | "done" | "error";
type UploadEntry = { id: string; name: string; status: UploadStatus; error?: string };

function GalleryUploader({ galleryKey, onAdded }: { galleryKey: string; onAdded: () => void }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  function patch(id: string, next: Partial<UploadEntry>) {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...next } : e)));
  }

  async function attach(mediaIds: string[]) {
    if (mediaIds.length === 0) return;
    const result = await addGalleryItems({ key: galleryKey, mediaIds });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { added, skipped } = result.data;
    toast.success(
      skipped > 0
        ? `Добавлено фото: ${added}, уже были в галерее: ${skipped}`
        : `Добавлено фото: ${added}`
    );
    onAdded();
  }

  async function uploadAll(files: File[]) {
    if (files.length === 0 || busy) return;
    const batch = files.map((file, index) => ({
      file,
      entry: {
        id: `${Date.now()}-${index}-${file.name}`,
        name: file.name,
        status: "pending" as UploadStatus,
      },
    }));
    setEntries(batch.map((b) => b.entry));
    setBusy(true);

    // Результаты по индексу файла — порядок в галерее совпадает с порядком выбора
    const mediaIds: (string | null)[] = batch.map(() => null);
    let cursor = 0;
    async function worker() {
      while (cursor < batch.length) {
        const index = cursor++;
        const item = batch[index];
        if (!item) continue;
        const problem = validateImageFile(item.file);
        if (problem) {
          patch(item.entry.id, { status: "error", error: problem });
          continue;
        }
        patch(item.entry.id, { status: "uploading" });
        try {
          const asset = await uploadMedia(item.file, { folder: UPLOAD_FOLDER });
          mediaIds[index] = asset.id;
          patch(item.entry.id, { status: "done" });
        } catch (error) {
          patch(item.entry.id, {
            status: "error",
            error: error instanceof Error ? error.message : "Не удалось загрузить файл",
          });
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, batch.length) }, () => worker())
    );

    await attach(mediaIds.filter((id): id is string => id !== null));
    setBusy(false);
    // Успешные строки убираем, ошибки оставляем на виду
    setEntries((list) => list.filter((e) => e.status === "error"));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    void uploadAll(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          dragOver ? "border-primary bg-accent" : "border-border"
        )}
      >
        <Upload className="text-muted-foreground h-6 w-6" aria-hidden />
        <p className="text-muted-foreground text-sm">
          Перетащите фото сюда или выберите файлы. JPEG, PNG, WebP, AVIF до 10 МБ.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            multiple
            className="sr-only"
            tabIndex={-1}
            disabled={busy}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              // Сброс, чтобы повторный выбор тех же файлов снова вызвал change
              event.target.value = "";
              void uploadAll(files);
            }}
          />
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="h-4 w-4" aria-hidden />
            )}
            Добавить фото
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPickerOpen(true)}
            disabled={busy}
          >
            <Images className="h-4 w-4" aria-hidden />
            Из медиатеки
          </Button>
        </div>
      </div>

      {entries.length > 0 ? (
        <ul className="space-y-1" aria-live="polite">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2 text-sm">
              {entry.status === "uploading" || entry.status === "pending" ? (
                <Loader2
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    entry.status === "uploading" ? "animate-spin" : "text-muted-foreground"
                  )}
                  aria-hidden
                />
              ) : entry.status === "done" ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
              ) : (
                <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 break-words">
                <span className="font-medium">{entry.name}</span>
                {entry.status === "pending" ? " — в очереди" : null}
                {entry.status === "uploading" ? " — загрузка…" : null}
                {entry.status === "done" ? " — загружено" : null}
                {entry.error ? <span className="text-destructive"> — {entry.error}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
        folder={UPLOAD_FOLDER}
        onSelect={(assets) => void attach(assets.map((asset) => asset.id))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Карточка фото
// ---------------------------------------------------------------------------

function GalleryItemCard({
  item,
  isMain,
  dragHandle,
  onMoveUp,
  onMoveDown,
  onChanged,
}: {
  item: AdminGalleryItem;
  isMain: boolean;
  dragHandle: ReactNode;
  onMoveUp: (() => void) | undefined;
  onMoveDown: (() => void) | undefined;
  onChanged: () => void;
}) {
  const altId = useId();
  const captionId = useId();
  const [alt, setAlt] = useState(item.media.alt);
  const [caption, setCaption] = useState(item.caption);
  const [pending, startTransition] = useTransition();
  const dirty = alt.trim() !== item.media.alt || caption.trim() !== item.caption;

  function save() {
    startTransition(async () => {
      const result = await updateGalleryItem({ id: item.id, alt, caption });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Сохранено");
      onChanged();
    });
  }

  return (
    <div className="bg-card flex h-full flex-col overflow-hidden rounded-lg border shadow-sm">
      <div className="bg-muted relative aspect-[4/3]">
        <Picture
          asset={item.media}
          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 50vw"
          alt={item.media.alt || item.media.originalName}
          className="h-full w-full object-cover"
          pictureClassName="block h-full w-full"
        />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {isMain ? <Badge>Главное</Badge> : null}
          {item.variant === "mobile" ? <Badge variant="secondary">Мобильная</Badge> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        <div className="flex items-center justify-between gap-1">
          <div className="bg-background/80 rounded-md">{dragHandle}</div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Переместить раньше"
              disabled={!onMoveUp}
              onClick={onMoveUp}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Переместить позже"
              disabled={!onMoveDown}
              onClick={onMoveDown}
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
            <ConfirmDialog
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive size-8"
                  aria-label="Убрать из галереи"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              }
              title="Убрать фото из галереи?"
              description="Файл останется в медиатеке."
              confirmLabel="Убрать"
              onConfirm={async () => {
                const result = await removeGalleryItem({ id: item.id });
                if (result.ok) {
                  toast.success("Фото убрано из галереи");
                  onChanged();
                }
                return result;
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={altId} className="text-xs">
            Описание (alt)
          </Label>
          <Input
            id={altId}
            value={alt}
            maxLength={GALLERY_TEXT_MAX}
            onChange={(event) => setAlt(event.target.value)}
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={captionId} className="text-xs">
            Подпись
          </Label>
          <Input
            id={captionId}
            value={caption}
            maxLength={GALLERY_TEXT_MAX}
            onChange={(event) => setCaption(event.target.value)}
            className="h-8"
          />
        </div>
        {dirty ? (
          <Button type="button" size="sm" onClick={save} disabled={pending} className="mt-auto">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Сохранить
          </Button>
        ) : null}
      </div>
    </div>
  );
}
