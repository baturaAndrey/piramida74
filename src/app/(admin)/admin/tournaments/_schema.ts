// Без 'use server': схемы общие для формы (клиент) и Server Actions.
import { z } from "zod";
import {
  DISCIPLINES,
  LEVELS,
  MAX_CATEGORIES,
  MAX_CATEGORY_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from "./_lib/labels";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9-]*$/;

const isoDate = z.string().regex(ISO_DATE_RE, "Укажите дату");
const money = z
  .number({ error: "Введите число" })
  .int("Только целое число рублей")
  .min(0, "Не меньше 0")
  .nullable();

export const tournamentSchema = z
  .object({
    /** Есть → обновление, нет → создание */
    id: z.uuid().optional(),
    title: z.string().trim().min(3, "Минимум 3 символа").max(200, "Не длиннее 200 символов"),
    /** Пустой — сгенерировать из названия на сервере */
    slug: z
      .string()
      .trim()
      .max(120, "Не длиннее 120 символов")
      .regex(SLUG_RE, "Только латиница в нижнем регистре, цифры и дефис"),
    seriesId: z.uuid().nullable(),
    stageNumber: z
      .number({ error: "Введите число" })
      .int("Только целое число")
      .min(1, "От 1 до 99")
      .max(99, "От 1 до 99")
      .nullable(),
    discipline: z.enum(DISCIPLINES).nullable(),
    level: z.enum(LEVELS),
    categories: z
      .array(z.string().trim().min(1).max(MAX_CATEGORY_LENGTH))
      .max(MAX_CATEGORIES, `Не больше ${MAX_CATEGORIES} категорий`),
    startDate: isoDate,
    endDate: isoDate,
    entryFee: money,
    prizeFund: money,
    description: z
      .string()
      .trim()
      .max(MAX_DESCRIPTION_LENGTH, `Не длиннее ${MAX_DESCRIPTION_LENGTH} символов`)
      .nullable(),
    coverMediaId: z.uuid().nullable(),
    registrationOpen: z.boolean(),
    isPublished: z.boolean(),
  })
  // Строки YYYY-MM-DD сравниваются лексикографически так же, как даты
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "Дата окончания раньше начала",
  });

export type TournamentInput = z.input<typeof tournamentSchema>;
export type TournamentValues = z.output<typeof tournamentSchema>;

export const idSchema = z.object({ id: z.uuid() });

export const togglePublishSchema = z.object({ id: z.uuid(), value: z.boolean() });

export const SERIES_NAME_MAX = 100;
export const SERIES_DESCRIPTION_MAX = 300;

export const seriesSchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Укажите название")
    .max(SERIES_NAME_MAX, `Не длиннее ${SERIES_NAME_MAX} символов`),
  description: z
    .string()
    .trim()
    .max(SERIES_DESCRIPTION_MAX, `Не длиннее ${SERIES_DESCRIPTION_MAX} символов`)
    .nullable(),
});

export type SeriesInput = z.input<typeof seriesSchema>;

export const reorderSchema = z.object({ ids: z.array(z.uuid()).max(500) });
