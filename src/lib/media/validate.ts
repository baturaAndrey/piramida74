// Модуль запускается и под Next, и под tsx (скрипты) — без `server-only` и `next/*`.
import { fileTypeFromBuffer } from "file-type";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export type MediaValidationCode = "TOO_LARGE" | "BAD_TYPE" | "BAD_IMAGE" | "BAD_FOLDER";

export class MediaValidationError extends Error {
  constructor(
    message: string,
    readonly code: MediaValidationCode
  ) {
    super(message);
    this.name = "MediaValidationError";
  }
}

const FOLDER_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
// Управляющие символы и символы, запрещённые в именах файлов Windows
const UNSAFE_NAME_CHARS_RE = /[\u0000-\u001f<>:"|?*]/g;
const MAX_NAME_LENGTH = 255;

/**
 * Проверка по magic bytes (расширению и client mime НЕ верим).
 * SVG и любые не-растровые типы отклоняются.
 */
export async function assertImageBuffer(buf: Buffer): Promise<AllowedMime> {
  if (buf.length === 0) throw new MediaValidationError("Пустой файл", "BAD_IMAGE");
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new MediaValidationError("Файл больше 10 МБ", "TOO_LARGE");
  }
  const ft = await fileTypeFromBuffer(buf);
  if (!ft || !(ALLOWED_MIME as readonly string[]).includes(ft.mime)) {
    throw new MediaValidationError("Допустимы только JPEG, PNG, WebP и AVIF", "BAD_TYPE");
  }
  return ft.mime as AllowedMime;
}

/** folder — только логическая метка в БД (не часть пути на диске!). */
export function assertFolder(folder: string): string {
  if (!FOLDER_RE.test(folder)) {
    throw new MediaValidationError("Некорректная папка", "BAD_FOLDER");
  }
  return folder;
}

/** Оставляет только базовое имя без опасных символов; пустой результат → "image". */
export function sanitizeOriginalName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(UNSAFE_NAME_CHARS_RE, "").trim().slice(0, MAX_NAME_LENGTH) || "image";
}
