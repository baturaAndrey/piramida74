"use client";

import type { ReactNode } from "react";
import { Upload } from "lucide-react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import { ACCEPTED_IMAGE_ACCEPT, MAX_UPLOAD_BYTES } from "@/lib/admin/media-dto";
import { cn } from "@/lib/utils";

type MediaDropzoneProps = {
  /** Только прошедшие клиентскую проверку файлы (тип и размер) */
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  /** Текст под иконкой, например «Загрузка 2 из 5…» */
  status?: ReactNode;
  className?: string;
};

function rejectionMessage({ file, errors }: FileRejection): string {
  const code = errors[0]?.code;
  if (code === "file-too-large") return `«${file.name}»: файл больше 10 МБ`;
  if (code === "file-invalid-type")
    return `«${file.name}»: допустимы только JPEG, PNG, WebP и AVIF`;
  if (code === "too-many-files") return "Можно выбрать только один файл";
  return `«${file.name}»: файл не подходит`;
}

/** Область перетаскивания картинок (JPEG/PNG/WebP/AVIF ≤ 10 МБ); неподходящие файлы — в toast. */
export function MediaDropzone({
  onFiles,
  multiple = false,
  disabled = false,
  status,
  className,
}: MediaDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_IMAGE_ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    multiple,
    disabled,
    onDrop: (accepted, rejections) => {
      for (const rejection of rejections) toast.error(rejectionMessage(rejection));
      if (accepted.length > 0) onFiles(accepted);
    },
  });

  return (
    <div
      {...getRootProps({
        className: cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          "hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          isDragActive && "border-primary bg-accent",
          disabled && "pointer-events-none opacity-50",
          className
        ),
      })}
      aria-label={multiple ? "Загрузить изображения" : "Загрузить изображение"}
    >
      <input {...getInputProps()} />
      <Upload className="text-muted-foreground h-6 w-6" aria-hidden />
      <p className="text-sm font-medium">
        {isDragActive
          ? "Отпустите файлы здесь"
          : multiple
            ? "Перетащите изображения или нажмите, чтобы выбрать"
            : "Перетащите изображение или нажмите, чтобы выбрать"}
      </p>
      <p className="text-muted-foreground text-xs">JPEG, PNG, WebP или AVIF, до 10 МБ</p>
      {status ? (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {status}
        </p>
      ) : null}
    </div>
  );
}
