import { z } from "zod";
import type { SiteSettings } from "@/lib/settings-defaults";

/** Все ключи SiteSettings, кроме флага ПДн в Telegram (он меняется отдельным Switch с подтверждением) */
export type SettingsValues = Omit<SiteSettings, "telegramIncludePii">;

export const HERO_BADGES_MIN = 1;
export const HERO_BADGES_MAX = 10;
export const HERO_BADGE_MAX = 40;
export const ABOUT_POINTS_COUNT = 4;
export const ABOUT_POINT_TITLE_MAX = 40;
export const ABOUT_POINT_TEXT_MAX = 160;
export const RETENTION_MIN = 1;
export const RETENTION_MAX = 120;
export const SEO_DESCRIPTION_MAX = 300;

const maxMsg = (n: number) => `Не длиннее ${n} символов`;
const text = (max: number) => z.string().trim().max(max, maxMsg(max));
const requiredText = (max: number) => text(max).min(1, "Заполните поле");
/** NaN (пустой Input type=number) zod 4 отклоняет как «не число» — сообщение из `error` */
const number = (message: string) => z.number({ error: message });

const httpsUrlOrEmpty = z.union([
  z.literal(""),
  z.url({ protocol: /^https$/, error: "Ссылка должна начинаться с https://" }).max(300),
]);

/**
 * Схема формы и Server Action `saveSettings`: ровно ключи SiteSettings без `telegramIncludePii`.
 * `satisfies` гарантирует, что вход и выход схемы совпадают с типом настроек.
 */
export const settingsSchema = z.object({
  phone: requiredText(40),
  phoneHref: z
    .string()
    .trim()
    .regex(/^tel:\+\d{11,15}$/, "Формат: tel:+79000685000"),
  email: z.email("Некорректный email"),
  address: requiredText(200),
  addressNote: text(200),
  hours: requiredText(100),
  telegramUrl: httpsUrlOrEmpty,
  vkUrl: httpsUrlOrEmpty,
  geo: z.object({
    lat: number("Укажите широту").min(-90, "От −90 до 90").max(90, "От −90 до 90"),
    lon: number("Укажите долготу").min(-180, "От −180 до 180").max(180, "От −180 до 180"),
  }),
  mapOrgId: z
    .string()
    .trim()
    .regex(/^\d{0,30}$/, "Только цифры"),
  mapConstructorId: z
    .string()
    .trim()
    .regex(/^(constructor:[A-Za-z0-9_-]+)?$/, "Формат: constructor:… (или пусто)"),
  heroTitle: requiredText(200),
  heroSubtitle: text(300),
  heroBadgePhrases: z
    .array(requiredText(HERO_BADGE_MAX))
    .min(HERO_BADGES_MIN, "Нужна хотя бы одна фраза")
    .max(HERO_BADGES_MAX, `Не больше ${HERO_BADGES_MAX} фраз`),
  aboutTitle: requiredText(300),
  aboutPoints: z
    .array(
      z.object({
        title: requiredText(ABOUT_POINT_TITLE_MAX),
        text: requiredText(ABOUT_POINT_TEXT_MAX),
      })
    )
    .length(ABOUT_POINTS_COUNT, `Нужно ровно ${ABOUT_POINTS_COUNT} пункта`),
  seoDefaults: z.object({
    title: requiredText(70),
    // Спека: до 200; дефолт из seed — 248 символов, поэтому 300, иначе форму нельзя сохранить
    description: requiredText(SEO_DESCRIPTION_MAX),
    ogImageMediaId: z.uuid().nullable(),
  }),
  operator: z.object({
    name: text(200),
    inn: z
      .string()
      .trim()
      .regex(/^(\d{10}|\d{12})?$/, "ИНН — 10 или 12 цифр"),
    ogrn: z
      .string()
      .trim()
      .regex(/^(\d{13}|\d{15})?$/, "ОГРН — 13 или 15 цифр (ОГРНИП)"),
    address: text(300),
    email: z.union([z.literal(""), z.email("Некорректный email")]),
  }),
  leadRetentionMonths: number("Укажите срок")
    .int("Целое число")
    .min(RETENTION_MIN, "От 1 до 120")
    .max(RETENTION_MAX, "От 1 до 120"),
}) satisfies z.ZodType<SettingsValues, SettingsValues>;

export const telegramPiiSchema = z
  .object({ enabled: z.boolean(), confirmed: z.boolean() })
  .refine((v) => !v.enabled || v.confirmed, {
    message: "Подтвердите согласие на трансграничную передачу",
    path: ["confirmed"],
  });
