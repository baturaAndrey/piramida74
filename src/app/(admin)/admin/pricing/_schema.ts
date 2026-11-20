import { z } from "zod";

/** Верхняя граница цены — защита от опечаток (лишний ноль) */
const MAX_PRICE = 1_000_000;
const MAX_REORDER_IDS = 500;

/** Пустая строка из `<input type="date">` → null */
const optionalIsoDate = z
  .union([z.literal(""), z.iso.date("Неверная дата")])
  .nullable()
  .transform((v) => (v ? v : null));

/** Пустая строка из текстового поля → null */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .nullable()
    .transform((v) => (v ? v : null));

const price = z
  .number({ error: "Укажите цену" })
  .int("Цена — целое число рублей")
  .min(0, "Цена не может быть отрицательной")
  .max(MAX_PRICE, "Слишком большая цена");

export const idSchema = z.object({ id: z.uuid() });

export const toggleSchema = z.object({ id: z.uuid(), isActive: z.boolean() });

export const reorderSchema = z.object({ ids: z.array(z.uuid()).max(MAX_REORDER_IDS) });

/* ───────────────────────── Залы ───────────────────────── */

export const hallSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Укажите название").max(120, "Не длиннее 120 символов"),
  kind: z.enum(["common", "vip"]),
  tablesCount: z
    .number({ error: "Укажите число столов" })
    .int()
    .min(1, "Минимум 1 стол")
    .max(100, "Слишком много столов"),
  seatsPerTable: z
    .number({ error: "Укажите число мест" })
    .int()
    .min(1, "От 1 до 12 мест")
    .max(12, "От 1 до 12 мест"),
  description: optionalText(1000),
  isActive: z.boolean(),
});

export type HallInput = z.input<typeof hallSchema>;
export type HallValues = z.output<typeof hallSchema>;

/* ───────────────────────── Тарифы ───────────────────────── */

export const tariffSchema = z
  .object({
    id: z.uuid().optional(),
    hallId: z.uuid("Выберите зал"),
    daysOfWeek: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Выберите хотя бы один день")
      .refine((a) => new Set(a).size === a.length, "Дни не должны повторяться"),
    startMin: z.number().int().min(0).max(1410).multipleOf(30),
    endMin: z.number().int().min(30).max(1440).multipleOf(30),
    price,
    // per_session в тарифах не используется
    priceUnit: z.enum(["per_hour", "fixed"]),
    audience: z.enum(["all", "pensioner"]),
    label: z.string().trim().max(120, "Не длиннее 120 символов"),
    validFrom: optionalIsoDate,
    validTo: optionalIsoDate,
    isActive: z.boolean(),
  })
  .refine((v) => v.endMin > v.startMin, {
    path: ["endMin"],
    message: "Конец должен быть позже начала",
  })
  .refine((v) => !v.validFrom || !v.validTo || v.validTo >= v.validFrom, {
    path: ["validTo"],
    message: "Период задан неверно",
  });

export type TariffInput = z.input<typeof tariffSchema>;
export type TariffValues = z.output<typeof tariffSchema>;

/* ───────────────────────── Доп. услуги ───────────────────────── */

export const extraSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Укажите название").max(120, "Не длиннее 120 символов"),
  description: optionalText(500),
  price,
  // fixed для доп. услуг запрещён: калькулятор понимает только per_hour и per_session
  priceUnit: z.enum(["per_hour", "per_session"]),
  isActive: z.boolean(),
});

export type ExtraInput = z.input<typeof extraSchema>;
export type ExtraValues = z.output<typeof extraSchema>;

/* ───────────────────────── Штрафы ───────────────────────── */

export const penaltyKindSchema = z.enum(["dishware", "property"]);

export const penaltySchema = z.object({
  id: z.uuid().optional(),
  kind: penaltyKindSchema,
  name: z.string().trim().min(1, "Укажите название").max(200, "Не длиннее 200 символов"),
  price,
  priceIsMinimum: z.boolean(),
  isActive: z.boolean(),
});

export type PenaltyInput = z.input<typeof penaltySchema>;

export const reorderPenaltiesSchema = z.object({
  kind: penaltyKindSchema,
  ids: z.array(z.uuid()).max(MAX_REORDER_IDS),
});
