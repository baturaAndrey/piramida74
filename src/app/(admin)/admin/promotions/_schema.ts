// Без 'use server': схемы общие для формы (клиент) и Server Actions.
import { z } from "zod";
import { OP_DAY_END_MIN, PROMOTION_TARGETS } from "./_lib/labels";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9-]*$/;

export const TITLE_MAX = 120;
export const SHORT_TEXT_MAX = 220;
export const DESCRIPTION_MAX = 4000;
export const AUDIENCE_NOTE_MAX = 120;

const WINDOW_ERROR =
  "Время окончания должно быть позже начала (операционные сутки: с 09:00 до 09:00)";

const windowMinute = z
  .number({ error: "Укажите время" })
  .int()
  .min(0)
  .max(OP_DAY_END_MIN)
  .nullable();

const optionalDate = z.string().regex(ISO_DATE_RE, "Укажите дату").nullable();

export const promotionSchema = z
  .object({
    /** Есть → обновление, нет → создание */
    id: z.uuid().optional(),
    title: z
      .string()
      .trim()
      .min(3, "Минимум 3 символа")
      .max(TITLE_MAX, `Не длиннее ${TITLE_MAX} символов`),
    /** Пустой — сгенерировать из названия на сервере */
    slug: z
      .string()
      .trim()
      .max(120, "Не длиннее 120 символов")
      .regex(SLUG_RE, "Только латиница в нижнем регистре, цифры и дефис"),
    shortText: z
      .string()
      .trim()
      .min(1, "Коротко опишите акцию")
      .max(SHORT_TEXT_MAX, `Не длиннее ${SHORT_TEXT_MAX} символов`),
    description: z.string().trim().max(DESCRIPTION_MAX, `Не длиннее ${DESCRIPTION_MAX} символов`),
    coverMediaId: z.uuid().nullable(),
    // В БД: null или 1..100
    discountPercent: z
      .number({ error: "Введите число" })
      .int("Только целое число")
      .min(1, "От 1 до 100 (пусто — без скидки)")
      .max(100, "От 1 до 100")
      .nullable(),
    /** 0 = Вс … 6 = Сб; null — каждый день */
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).nullable(),
    /** Минуты от 09:00 операционных суток */
    startMin: windowMinute,
    endMin: windowMinute,
    target: z.enum(PROMOTION_TARGETS),
    targetMenuCategoryId: z.uuid().nullable(),
    audienceNote: z
      .string()
      .trim()
      .max(AUDIENCE_NOTE_MAX, `Не длиннее ${AUDIENCE_NOTE_MAX} символов`)
      .nullable(),
    validFrom: optionalDate,
    validTo: optionalDate,
    showInCarousel: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const hasStart = v.startMin !== null;
    const hasEnd = v.endMin !== null;
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: "custom",
        path: [hasStart ? "endMin" : "startMin"],
        message: "Укажите время начала и окончания",
      });
    } else if (v.startMin !== null && v.endMin !== null && v.endMin <= v.startMin) {
      ctx.addIssue({ code: "custom", path: ["endMin"], message: WINDOW_ERROR });
    }
    if (v.target === "menu_category" && !v.targetMenuCategoryId) {
      ctx.addIssue({
        code: "custom",
        path: ["targetMenuCategoryId"],
        message: "Выберите категорию меню",
      });
    }
    if (v.validFrom && v.validTo && v.validTo < v.validFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "Дата окончания раньше начала",
      });
    }
  });

export type PromotionInput = z.input<typeof promotionSchema>;
export type PromotionValues = z.output<typeof promotionSchema>;

export const idSchema = z.object({ id: z.uuid() });
export const toggleSchema = z.object({ id: z.uuid(), value: z.boolean() });
export const reorderSchema = z.object({ ids: z.array(z.uuid()).max(500) });
