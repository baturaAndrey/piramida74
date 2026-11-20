"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";

const DEFAULT_PREVIEW_SRC = "/images/home/map-preview.webp";

type MapFacadeProps = {
  /** Значение `um` конструктора Яндекс Карт без префикса `constructor:`; пустое — только превью */
  umParam: string;
  previewSrc?: string;
  /** Подпись заглушки (адрес), если превью недоступно */
  title: string;
};

/**
 * Click-to-load карта: до клика — статичное серое превью и кнопка, запросы на yandex.ru
 * не отправляются (производительность и 152-ФЗ). После клика — iframe конструктора.
 */
export function MapFacade({ umParam, previewSrc = DEFAULT_PREVIEW_SRC, title }: MapFacadeProps) {
  const [loaded, setLoaded] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canLoad = umParam.length > 0;

  // Кнопка исчезает после клика — переносим фокус на карту, чтобы он не потерялся
  useEffect(() => {
    if (loaded) iframeRef.current?.focus();
  }, [loaded]);

  if (loaded && canLoad) {
    return (
      <iframe
        ref={iframeRef}
        src={`https://yandex.ru/map-widget/v1/?um=constructor%3A${encodeURIComponent(umParam)}&source=constructor`}
        title="Карта проезда: бильярдный клуб «Пирамида»"
        loading="lazy"
        className="h-full w-full border-0 grayscale transition-[filter] duration-300 hover:grayscale-0 [@media(hover:none)]:grayscale-0"
        allowFullScreen
      />
    );
  }

  return (
    <div className="bg-muted relative h-full w-full">
      {previewFailed ? (
        <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 pb-24 text-center text-sm">
          <MapPin className="size-8" aria-hidden="true" />
          <span>{title}</span>
        </div>
      ) : (
        <Image
          src={previewSrc}
          alt=""
          fill
          sizes="(min-width:1024px) 1200px, 100vw"
          loading="lazy"
          className="object-cover grayscale"
          onError={() => setPreviewFailed(true)}
        />
      )}
      {canLoad ? (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="bg-primary hover:bg-primary-dark inline-flex h-14 items-center gap-2 rounded-[12px] px-8 text-base font-bold text-white shadow-lg transition-colors"
          >
            <MapPin className="size-5" aria-hidden="true" />
            Показать карту
          </button>
        </div>
      ) : null}
    </div>
  );
}
