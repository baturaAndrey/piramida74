// Модуль запускается и под Next, и под tsx (скрипты) — без `server-only` и `next/*`.
import sharp, { type Metadata, type Sharp, type SharpOptions } from "sharp";
import { MediaValidationError } from "./validate";

export type MediaFormat = "avif" | "webp";

export type ProcessedVariant = { w: number; format: MediaFormat; buffer: Buffer };

export type ProcessedImage = {
  /** Размеры источника после применения EXIF-ориентации */
  width: number;
  height: number;
  blurDataUrl: string;
  variants: ProcessedVariant[];
};

/** Ступени ширины адаптивных вариантов */
export const VARIANT_WIDTHS = [640, 1280, 1920] as const;
const MAX_VARIANT_WIDTH = 1920;
/** Защита от «пиксельных бомб» */
const MAX_INPUT_PIXELS = 80_000_000;
const BLUR_WIDTH = 16;
/** EXIF-ориентации 5–8 поворачивают изображение на 90°/270° — ширина и высота меняются местами */
const FIRST_TRANSPOSED_ORIENTATION = 5;

const SHARP_INPUT_OPTIONS: SharpOptions = {
  failOn: "error",
  limitInputPixels: MAX_INPUT_PIXELS,
};

const ENCODERS: Record<MediaFormat, (img: Sharp) => Sharp> = {
  avif: (img) => img.avif({ quality: 55, effort: 4 }),
  webp: (img) => img.webp({ quality: 75 }),
};
const FORMATS: MediaFormat[] = ["avif", "webp"];

/**
 * Ширины вариантов: стандартные ступени не шире источника + сам источник как верхняя ступень,
 * если он уже 1920 px (500 → [500], 800 → [640, 800], 3000 → [640, 1280, 1920]).
 */
export function variantWidths(srcWidth: number): number[] {
  const widths: number[] = VARIANT_WIDTHS.filter((w) => w <= srcWidth);
  if (srcWidth < MAX_VARIANT_WIDTH && !widths.includes(srcWidth)) widths.push(srcWidth);
  return widths;
}

async function readOrientedSize(buf: Buffer): Promise<{ width: number; height: number }> {
  let meta: Metadata;
  try {
    meta = await sharp(buf, SHARP_INPUT_OPTIONS).metadata();
  } catch {
    throw new MediaValidationError("Не удалось прочитать изображение", "BAD_IMAGE");
  }
  if (!meta.width || !meta.height) {
    throw new MediaValidationError("Не удалось прочитать изображение", "BAD_IMAGE");
  }
  const transposed = (meta.orientation ?? 1) >= FIRST_TRANSPOSED_ORIENTATION;
  return transposed
    ? { width: meta.height, height: meta.width }
    : { width: meta.width, height: meta.height };
}

/**
 * Готовит варианты avif/webp и blur-заглушку. `.rotate()` применяет EXIF-ориентацию;
 * метаданные (EXIF/GPS) sharp по умолчанию не переносит в выходные файлы.
 * Анимированные изображения сводятся к первому кадру (поведение sharp по умолчанию).
 */
export async function processImage(buf: Buffer): Promise<ProcessedImage> {
  const { width, height } = await readOrientedSize(buf);

  const variants: ProcessedVariant[] = [];
  try {
    // По ширинам последовательно (AVIF тяжёлый для CPU), форматы одной ширины — параллельно
    for (const w of variantWidths(width)) {
      const encoded = await Promise.all(
        FORMATS.map(async (format) => {
          const pipeline = sharp(buf, SHARP_INPUT_OPTIONS)
            .rotate()
            .resize({ width: w, withoutEnlargement: true });
          const buffer = await ENCODERS[format](pipeline).toBuffer();
          return { w, format, buffer };
        })
      );
      variants.push(...encoded);
    }
  } catch (error) {
    // Детали libvips — только в лог: сообщение ошибки показывается пользователю
    console.warn("[media] ошибка обработки изображения:", error);
    throw new MediaValidationError("Не удалось обработать изображение", "BAD_IMAGE");
  }

  const blur = await sharp(buf, SHARP_INPUT_OPTIONS)
    .rotate()
    .resize(BLUR_WIDTH)
    .webp({ quality: 40 })
    .toBuffer();

  return {
    width,
    height,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    variants,
  };
}
