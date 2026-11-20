import type { Metadata } from "next";

export const SITE_NAME = "Бильярдный клуб «Пирамида»";
export const DEFAULT_DESCRIPTION =
  "Бильярдный клуб «Пирамида» в Челябинске: русская пирамида, американский пул, VIP-комнаты, авторская кухня. Ежедневно 09:00–02:00.";

const DEFAULT_SITE_URL = "http://localhost:3000";

/** Базовый URL без завершающего слэша. NEXT_PUBLIC_* вшивается при сборке. */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

/** Абсолютный URL сайта для пути; уже абсолютные URL возвращаются как есть. */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface BuildMetadataInput {
  title: string | { absolute: string };
  description?: string;
  /** Путь страницы, например `/menu` */
  path: string;
  /** Путь или абсолютный URL изображения (желательно 1200×630) */
  image?: string;
  noindex?: boolean;
  type?: "website" | "article";
}

/**
 * Метаданные страницы: canonical, Open Graph и Twitter с абсолютными URL.
 * Без `image` OG-картинку берёт `opengraph-image` корневого сегмента (если есть).
 */
export function buildMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image,
  noindex,
  type = "website",
}: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const titleText = typeof title === "string" ? title : title.absolute;
  const imageUrl = image ? absoluteUrl(image) : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      locale: "ru_RU",
      title: titleText,
      description,
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: titleText,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}
