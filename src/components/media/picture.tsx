import { preload } from "react-dom";
import { mediaSrcSet, mediaUrl, type PictureAsset } from "@/lib/media/url";

/** Ширина варианта для fallback-`src` (браузеры без поддержки srcset/picture) */
const FALLBACK_WIDTH = 1280;

type PictureProps = {
  asset: PictureAsset | null | undefined;
  /** Например "(min-width: 1024px) 50vw, 100vw" */
  sizes: string;
  /** По умолчанию `asset.alt`; пустая строка — декоративное изображение */
  alt?: string | undefined;
  /** eager + fetchPriority="high" + preload (LCP, hero) */
  priority?: boolean;
  /** Классы `<img>` */
  className?: string;
  /** Классы `<picture>` */
  pictureClassName?: string;
};

/** Адаптивное изображение из медиатеки: avif/webp `srcset` и blur-заглушка на фоне. Без хуков. */
export function Picture({
  asset,
  sizes,
  alt,
  priority = false,
  className,
  pictureClassName,
}: PictureProps) {
  if (!asset) return null;

  const avifSrcSet = mediaSrcSet(asset, "avif");
  const webpSrcSet = mediaSrcSet(asset, "webp");
  const src = mediaUrl(asset, FALLBACK_WIDTH, "webp") || mediaUrl(asset, FALLBACK_WIDTH, "avif");
  // Ассет без вариантов (повреждённая строка) — не рендерим битую картинку
  if (!src) return null;

  if (priority && avifSrcSet) {
    preload(mediaUrl(asset, FALLBACK_WIDTH, "avif"), {
      as: "image",
      imageSrcSet: avifSrcSet,
      imageSizes: sizes,
      fetchPriority: "high",
      type: "image/avif",
    });
  }

  return (
    <picture className={pictureClassName}>
      {avifSrcSet ? <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} /> : null}
      {webpSrcSet ? <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} /> : null}
      <img
        src={src}
        width={asset.width}
        height={asset.height}
        alt={alt ?? asset.alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        style={{ backgroundImage: `url("${asset.blurDataUrl}")`, backgroundSize: "cover" }}
        className={className}
      />
    </picture>
  );
}
