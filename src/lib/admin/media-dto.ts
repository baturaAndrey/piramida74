// Изоморфный модуль (без серверных импортов): типы и константы медиатеки для API и клиентских компонентов.
import type { MediaVariant } from "@/lib/media/url";
import type { MediaAsset } from "@/lib/schema";

/** Сериализуемый ассет медиатеки; структурно совместим с `PictureAsset` (`<Picture asset>`, `mediaUrl`). */
export type MediaDto = {
  id: string;
  path: string;
  originalName: string;
  alt: string;
  folder: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  blurDataUrl: string;
  variants: MediaVariant[];
  /** ISO 8601 */
  createdAt: string;
};

/** Ответ `GET /api/admin/media` */
export type MediaListResponse = {
  items: MediaDto[];
  total: number;
  page: number;
  pageSize: number;
};

export function toMediaDto(row: MediaAsset): MediaDto {
  return {
    id: row.id,
    path: row.path,
    originalName: row.originalName,
    alt: row.alt,
    folder: row.folder,
    mime: row.mime,
    width: row.width,
    height: row.height,
    size: row.size,
    blurDataUrl: row.blurDataUrl,
    variants: row.variants,
    createdAt: row.createdAt.toISOString(),
  };
}

export const MEDIA_PAGE_SIZE_DEFAULT = 24;
export const MEDIA_PAGE_SIZE_MAX = 60;

/** Те же ограничения, что и на сервере (`src/lib/media/validate.ts`) — для ранней проверки в браузере. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;
/** Для `accept` у input/dropzone */
export const ACCEPTED_IMAGE_ACCEPT: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
};

/** Известные папки (метки) медиатеки с подписями; в БД могут встречаться и другие. */
export const MEDIA_FOLDER_LABELS: Record<string, string> = {
  general: "Общее",
  tournaments: "Турниры",
  promotions: "Акции",
  galleries: "Галереи",
  menu: "Меню",
  sets: "Банкетные сеты",
  blog: "Блог",
  authors: "Авторы",
  rubrics: "Рубрики",
  seo: "SEO",
  legacy: "Импорт со старого сайта",
};

export function folderLabel(folder: string): string {
  return MEDIA_FOLDER_LABELS[folder] ?? folder;
}

/** «1,4 МБ», «820 КБ» */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("ru-RU")} КБ`;
}
