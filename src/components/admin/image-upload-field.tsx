"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, ImagePlus, Images, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Picture } from "@/components/media/picture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadMedia, validateImageFile } from "@/lib/admin/media-client";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/admin/media-dto";
import type { MediaDto } from "@/lib/admin/media-dto";
import { MediaPicker } from "./media-picker";

export type ImageUploadFieldProps = {
  /** mediaId */
  value: string | null;
  /** Для превью уже сохранённой картинки */
  initialAsset?: MediaDto | null;
  onChange: (mediaId: string | null, asset: MediaDto | null) => void;
  /** Папка медиатеки для загрузки: "tournaments" | "promotions" | "galleries" | "blog" | … */
  folder: string;
  label?: string;
  /** Пропорция превью (например 16 / 6) — только `object-cover`, без кадрирования */
  aspect?: number;
  disabled?: boolean;
};

const DEFAULT_ASPECT = 16 / 9;
const MAX_ALT_LENGTH = 300;

/** Контролируемое поле картинки: загрузка, выбор из медиатеки, очистка, превью. */
export function ImageUploadField({
  value,
  initialAsset = null,
  onChange,
  folder,
  label = "Изображение",
  aspect = DEFAULT_ASPECT,
  disabled = false,
}: ImageUploadFieldProps) {
  const inputId = useId();
  const altId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [asset, setAsset] = useState<MediaDto | null>(initialAsset);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Превью соответствует текущему value: при сбросе формы извне (value → null) картинка скрывается
  const preview = value && asset?.id === value ? asset : null;
  const hasValueWithoutPreview = Boolean(value) && !preview;
  const isBusy = disabled || uploading;

  function select(next: MediaDto | null) {
    setAsset(next);
    onChange(next?.id ?? null, next);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Сбрасываем input, чтобы повторный выбор того же файла снова вызвал change
    event.target.value = "";
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadMedia(file, { folder, alt: alt.trim() || undefined });
      select(uploaded);
      setAlt("");
      toast.success("Изображение загружено");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить файл");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>

      <div
        className="bg-muted relative w-full max-w-xl overflow-hidden rounded-lg border"
        style={{ aspectRatio: aspect }}
      >
        {preview ? (
          <Picture
            asset={preview}
            sizes="(min-width: 768px) 576px, 100vw"
            alt={preview.alt || preview.originalName}
            className="h-full w-full object-cover"
            pictureClassName="block h-full w-full"
          />
        ) : (
          <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-sm">
            <ImageIcon className="h-6 w-6" aria-hidden />
            {hasValueWithoutPreview ? "Изображение выбрано" : "Изображение не выбрано"}
          </div>
        )}
        {uploading ? (
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-label="Загрузка" />
          </div>
        ) : null}
      </div>

      {preview ? (
        <p className="text-muted-foreground text-xs">
          {preview.originalName} · {preview.width}×{preview.height}
          {preview.alt ? ` · alt: ${preview.alt}` : " · alt не задан (редактируется в медиатеке)"}
        </p>
      ) : (
        <div className="max-w-xl space-y-1">
          <Label htmlFor={altId} className="text-muted-foreground text-xs font-normal">
            Описание (alt) для загружаемого файла
          </Label>
          <Input
            id={altId}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            maxLength={MAX_ALT_LENGTH}
            placeholder="Например: Финал турнира по русской пирамиде"
            disabled={isBusy}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => void handleFile(event)}
          disabled={isBusy}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-4 w-4" aria-hidden />
          )}
          Загрузить
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPickerOpen(true)}
          disabled={isBusy}
        >
          <Images className="h-4 w-4" aria-hidden />
          Выбрать из медиатеки
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => select(null)}
            disabled={isBusy}
          >
            <X className="h-4 w-4" aria-hidden />
            Убрать
          </Button>
        ) : null}
      </div>

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        folder={folder}
        onSelect={(assets) => {
          const [first] = assets;
          if (first) select(first);
        }}
      />
    </div>
  );
}
