// Изоморфный модуль: ключи и подписи галерей для страницы, редактора и actions.

/** Галереи, которые создаёт seed и на которые опирается код сайта; удалять их нельзя. */
export const SYSTEM_GALLERY_KEYS = [
  "hero",
  "service_russian",
  "service_pool",
  "service_vip",
  "service_training",
  "bar",
  "about",
  "cta",
] as const;

export type SystemGalleryKey = (typeof SYSTEM_GALLERY_KEYS)[number];

export const SYSTEM_GALLERY_LABELS: Record<SystemGalleryKey, string> = {
  hero: "Первый экран (hero)",
  service_russian: "Услуги — Русский бильярд",
  service_pool: "Услуги — Американский бильярд",
  service_vip: "Услуги — VIP-комнаты",
  service_training: "Услуги — Обучение",
  bar: "Бар и кухня",
  about: "О клубе (фон)",
  cta: "Блок «Оставьте заявку» (фон/фото)",
};

const SERVICE_HINT = "5 фото, первое показывается крупно (≈ 3:2)";

/** Подсказки по количеству и размерам фото для системных галерей. */
export const SYSTEM_GALLERY_HINTS: Record<SystemGalleryKey, string> = {
  hero: "1920×1080 и больше, первое фото — главное",
  service_russian: SERVICE_HINT,
  service_pool: SERVICE_HINT,
  service_vip: SERVICE_HINT,
  service_training: SERVICE_HINT,
  bar: "6 фото, первое крупно (≈ 21:9)",
  about: "1 фото 1920×1080, тёмное",
  cta: "1–2 фото (фон и фото человека); пусто — сайт покажет стандартные изображения",
};

/** Ключ галереи: латиница в нижнем регистре, цифры и `_` (2–64) — общий для форм и zod. */
export const GALLERY_KEY_RE = /^[a-z0-9_]{2,64}$/;
export const GALLERY_KEY_MESSAGE = "Только латиница в нижнем регистре, цифры и _ (2–64)";

export function isSystemGalleryKey(key: string): key is SystemGalleryKey {
  return (SYSTEM_GALLERY_KEYS as readonly string[]).includes(key);
}

/** Подпись для системного ключа, иначе — сохранённое название или сам ключ. */
export function galleryLabel(key: string, title?: string | null): string {
  if (isSystemGalleryKey(key)) return SYSTEM_GALLERY_LABELS[key];
  return title?.trim() || key;
}

export function galleryHint(key: string): string | null {
  return isSystemGalleryKey(key) ? SYSTEM_GALLERY_HINTS[key] : null;
}
