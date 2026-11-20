import { z } from "zod";

export const SERVICE_TITLE_MAX = 80;
export const SERVICE_SUBTITLE_MAX = 600;
export const SERVICE_BULLETS_MAX = 8;
export const SERVICE_BULLET_MAX = 120;
export const SERVICE_PRICE_NOTE_MAX = 80;
export const SERVICE_CTA_BLOCK_MAX = 60;
/** Верхняя граница цены — защита от опечаток (лишние нули) */
export const SERVICE_PRICE_MAX = 1_000_000;

export const SERVICE_CTA_TYPES = ["booking", "callback"] as const;
export type ServiceCtaType = (typeof SERVICE_CTA_TYPES)[number];

export const SERVICE_CTA_LABELS: Record<ServiceCtaType, string> = {
  booking: "Забронировать",
  callback: "Оставить заявку",
};

const maxMsg = (n: number) => `Не длиннее ${n} символов`;

/** Ключ галереи — тот же формат, что и в разделе «Галереи» */
const galleryKeySchema = z.string().regex(/^[a-z0-9_]{2,64}$/, "Некорректный ключ галереи");

/** Схема Server Action `saveService` */
export const serviceSchema = z.object({
  id: z.uuid(),
  title: z
    .string()
    .trim()
    .min(1, "Укажите заголовок")
    .max(SERVICE_TITLE_MAX, maxMsg(SERVICE_TITLE_MAX)),
  subtitle: z.string().trim().max(SERVICE_SUBTITLE_MAX, maxMsg(SERVICE_SUBTITLE_MAX)),
  bullets: z
    .array(
      z.string().trim().min(1, "Пустой пункт").max(SERVICE_BULLET_MAX, maxMsg(SERVICE_BULLET_MAX))
    )
    .max(SERVICE_BULLETS_MAX, `Не больше ${SERVICE_BULLETS_MAX} пунктов`),
  priceFrom: z.number().int().min(0).max(SERVICE_PRICE_MAX).nullable(),
  priceNote: z.string().trim().max(SERVICE_PRICE_NOTE_MAX, maxMsg(SERVICE_PRICE_NOTE_MAX)),
  ctaType: z.enum(SERVICE_CTA_TYPES).default("booking"),
  // Значение уходит в leads.sourceBlock; в БД (seed) это русские подписи («Русский бильярд»),
  // поэтому допускаем любой текст, а не только латиницу
  ctaBlock: z
    .string()
    .trim()
    .min(1, "Укажите метку блока")
    .max(SERVICE_CTA_BLOCK_MAX, maxMsg(SERVICE_CTA_BLOCK_MAX)),
  galleryKey: galleryKeySchema.nullable(),
});

export type ServiceInput = z.input<typeof serviceSchema>;

/** Схема формы: цена — строка из Input, пункты — объекты для `useFieldArray`. */
export const serviceFormSchema = z.object({
  title: serviceSchema.shape.title,
  subtitle: serviceSchema.shape.subtitle,
  bullets: z
    .array(
      z.object({
        value: z
          .string()
          .trim()
          .min(1, "Пустой пункт — удалите его или заполните")
          .max(SERVICE_BULLET_MAX, maxMsg(SERVICE_BULLET_MAX)),
      })
    )
    .max(SERVICE_BULLETS_MAX, `Не больше ${SERVICE_BULLETS_MAX} пунктов`),
  priceFrom: z
    .string()
    .trim()
    .regex(/^\d*$/, "Целое число без пробелов или пусто")
    .refine((v) => v === "" || Number(v) <= SERVICE_PRICE_MAX, "Слишком большая цена"),
  priceNote: serviceSchema.shape.priceNote,
  ctaType: z.enum(SERVICE_CTA_TYPES),
  ctaBlock: serviceSchema.shape.ctaBlock,
  /** "" — без галереи (Radix Select не допускает пустое значение — см. NO_GALLERY в форме) */
  galleryKey: z.string(),
});

export type ServiceFormInput = z.input<typeof serviceFormSchema>;
export type ServiceFormValues = z.output<typeof serviceFormSchema>;
