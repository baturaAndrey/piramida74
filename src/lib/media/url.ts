// Изоморфный модуль: используется и на сервере, и в клиентских компонентах — никаких `node:*`.

export type MediaFormat = "avif" | "webp";

export type MediaVariant = { w: number; format: MediaFormat; file: string };

/** Структурный тип: подходит и для строки БД, и для сериализованного объекта из 'use cache'. */
export type PictureAsset = {
  path: string;
  width: number;
  height: number;
  blurDataUrl: string;
  alt: string;
  variants: MediaVariant[];
};

type UrlAsset = Pick<PictureAsset, "path" | "variants">;

function variantsOf(asset: UrlAsset, fmt: MediaFormat): MediaVariant[] {
  return asset.variants.filter((v) => v.format === fmt).sort((a, b) => a.w - b.w);
}

function variantUrl(asset: UrlAsset, w: number, fmt: MediaFormat): string {
  return `/media/${asset.path}-${w}.${fmt}`;
}

/**
 * URL варианта: без `w` — самый широкий; с `w` — ближайший с шириной ≥ `w`, иначе самый широкий.
 * Пустая строка, если вариантов нужного формата нет.
 */
export function mediaUrl(asset: UrlAsset, w?: number, fmt: MediaFormat = "webp"): string {
  const variants = variantsOf(asset, fmt);
  const widest = variants.at(-1);
  if (!widest) return "";
  const chosen = w === undefined ? widest : (variants.find((v) => v.w >= w) ?? widest);
  return variantUrl(asset, chosen.w, fmt);
}

/** `srcset` для формата: "/media/…-640.avif 640w, /media/…-1280.avif 1280w". */
export function mediaSrcSet(asset: UrlAsset, fmt: MediaFormat): string {
  return variantsOf(asset, fmt)
    .map((v) => `${variantUrl(asset, v.w, fmt)} ${v.w}w`)
    .join(", ");
}
