// Zod-схемы банкетных сетов: общие для клиентской формы (zodResolver) и Server Actions.
import { z } from "zod";
import { optionalText } from "../menu/_schema";

const MAX_PRICE = 1_000_000;
const MAX_GUESTS = 1000;
export const MAX_QTY = 99;
export const SET_DESCRIPTION_MAX = 1000;

const qty = z
  .number({ error: "Укажите количество" })
  .int("Целое число")
  .min(1, "Не меньше 1")
  .max(MAX_QTY, `Не больше ${MAX_QTY}`);

const guests = z
  .number({ error: "Укажите число гостей" })
  .int("Целое число")
  .min(1, "Не меньше 1")
  .max(MAX_GUESTS, `Не больше ${MAX_GUESTS}`)
  .nullable();

/** Строка состава: либо вариант позиции меню, либо произвольный текст */
export const setItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("menu"),
    menuItemVariantId: z.uuid({ error: "Выберите позицию меню" }),
    customLabel: z.null(),
    qty,
  }),
  z.object({
    kind: z.literal("custom"),
    menuItemVariantId: z.null(),
    customLabel: z
      .string({ error: "Введите текст" })
      .trim()
      .min(1, "Введите текст")
      .max(160, "Не длиннее 160 символов"),
    qty,
  }),
]);
export type SetItemInput = z.input<typeof setItemSchema>;

export const SET_PRICING_MODES = ["per_person", "fixed"] as const;

export const setSchema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(1, "Введите название").max(120, "Не длиннее 120 символов"),
    description: optionalText(SET_DESCRIPTION_MAX),
    coverMediaId: z.uuid().nullable(),
    pricingMode: z.enum(SET_PRICING_MODES),
    price: z
      .number({ error: "Укажите цену" })
      .int("Цена — целое число рублей")
      .min(0, "Цена не может быть отрицательной")
      .max(MAX_PRICE, "Слишком большая цена"),
    minGuests: guests,
    maxGuests: guests,
    isActive: z.boolean(),
    items: z.array(setItemSchema).max(100, "Не больше 100 строк"),
  })
  .refine((v) => v.minGuests == null || v.maxGuests == null || v.maxGuests >= v.minGuests, {
    message: "Максимум гостей не может быть меньше минимума",
    path: ["maxGuests"],
  });
export type SetInput = z.input<typeof setSchema>;
export type SetOutput = z.output<typeof setSchema>;

export const idSchema = z.object({ id: z.uuid() });
export const toggleSchema = z.object({ id: z.uuid(), isActive: z.boolean() });
export const reorderSchema = z.object({ ids: z.array(z.uuid()).max(1000) });
