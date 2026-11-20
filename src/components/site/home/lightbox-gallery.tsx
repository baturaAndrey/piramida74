"use client";

import { lazy, Suspense, useState } from "react";
import { Picture } from "@/components/media/picture";
import { mediaUrl } from "@/lib/media/url";
import type { PublicMedia } from "@/lib/queries/types";
import { cn } from "@/lib/utils";
import type { SlideImage } from "yet-another-react-lightbox";

/* Сам лайтбокс (JS + CSS) — отдельный чанк, грузится при первом открытии фото */
const loadLightboxViewer = () => import("./lightbox-viewer");
const LightboxViewer = lazy(loadLightboxViewer);

/** Предзагрузка чанка при наведении/фокусе на фото */
function prefetchLightbox() {
  // Ошибку сети здесь глушим: при открытии `React.lazy` запросит модуль ещё раз
  loadLightboxViewer().catch(() => {});
}

export type LightboxGalleryItem = { asset: PublicMedia; alt: string };

type GalleryVariant = "services" | "bar";

type LightboxGalleryProps = {
  items: LightboxGalleryItem[];
  variant: GalleryVariant;
  className?: string;
};

/** Размеры сетки: крупное первое фото + ряд миниатюр */
const LAYOUT: Record<
  GalleryVariant,
  {
    thumbs: number;
    main: string;
    mainSizes: string;
    grid: string;
    thumb: string;
    thumbSizes: string;
  }
> = {
  services: {
    thumbs: 4,
    main: "mb-1.5 aspect-[2/1] lg:mb-5 lg:aspect-[770/572]",
    mainSizes: "(min-width:1024px) 40vw, 86vw",
    grid: "grid-cols-4 gap-[clamp(6px,1vw,20px)]",
    thumb: "aspect-[177/149]",
    thumbSizes: "(min-width:1024px) 10vw, 22vw",
  },
  bar: {
    thumbs: 5,
    main: "mb-2 h-[clamp(221px,31.25vw,600px)] lg:mb-4",
    mainSizes: "(min-width:768px) 81vw, 86vw",
    grid: "grid-cols-5 gap-2 lg:gap-4",
    thumb: "h-[clamp(53px,7.8vw,150px)]",
    thumbSizes: "(min-width:768px) 16vw, 18vw",
  },
};

/** Ширины вариантов для лайтбокса (srcset); 640 для полноэкранного просмотра не нужен */
const LIGHTBOX_WIDTHS = [1280, 1920] as const;

function toSlide({ asset, alt }: LightboxGalleryItem): SlideImage {
  return {
    src: mediaUrl(asset, 1920, "webp"),
    alt,
    width: asset.width,
    height: asset.height,
    srcSet: LIGHTBOX_WIDTHS.map((w) => ({
      src: mediaUrl(asset, w, "webp"),
      width: w,
      height: Math.round((w * asset.height) / asset.width),
    })),
  };
}

const TILE_CLASS =
  "bg-muted block w-full cursor-zoom-in overflow-hidden rounded-[12px] [&_img]:transition-transform [&_img]:duration-300 hover:[&_img]:scale-[1.03]";

/**
 * Сетка фото (первое крупно, ниже до 4/5 миниатюр) и полноэкранный просмотр
 * `yet-another-react-lightbox` (Esc, клик вне фото, фокус-ловушка — встроены).
 * Лайтбокс монтируется при первом открытии и дальше остаётся смонтированным (анимация закрытия).
 */
export function LightboxGallery({ items, variant, className }: LightboxGalleryProps) {
  const [index, setIndex] = useState(-1);
  const [viewerMounted, setViewerMounted] = useState(false);
  const [main, ...rest] = items;
  if (!main) return null;

  const layout = LAYOUT[variant];
  const thumbs = rest.slice(0, layout.thumbs);
  // В лайтбоксе — только видимые в сетке фото, чтобы номера совпадали с подписями кнопок
  const slides = [main, ...thumbs].map(toSlide);
  const openAt = (i: number) => {
    setViewerMounted(true);
    setIndex(i);
  };

  return (
    <div className={className}>
      <button
        type="button"
        aria-label="Открыть фото 1"
        onClick={() => openAt(0)}
        onPointerEnter={prefetchLightbox}
        onFocus={prefetchLightbox}
        className={cn(TILE_CLASS, layout.main)}
      >
        <Picture
          asset={main.asset}
          sizes={layout.mainSizes}
          alt={main.alt}
          pictureClassName="block h-full"
          className="h-full w-full object-cover"
        />
      </button>
      {thumbs.length > 0 ? (
        <div className={cn("grid", layout.grid)}>
          {thumbs.map((item, i) => (
            <button
              key={item.asset.id}
              type="button"
              aria-label={`Открыть фото ${i + 2}`}
              onClick={() => openAt(i + 1)}
              onPointerEnter={prefetchLightbox}
              onFocus={prefetchLightbox}
              className={cn(TILE_CLASS, layout.thumb)}
            >
              <Picture
                asset={item.asset}
                sizes={layout.thumbSizes}
                alt={item.alt}
                pictureClassName="block h-full"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
      {viewerMounted ? (
        <Suspense fallback={null}>
          <LightboxViewer
            open={index >= 0}
            index={Math.max(index, 0)}
            slides={slides}
            onClose={() => setIndex(-1)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
