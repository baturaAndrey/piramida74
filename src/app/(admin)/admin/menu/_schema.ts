// Zod-схемы раздела «Меню»: общие для клиентских форм (zodResolver) и Server Actions.
import { z } from "zod";
import { UNIT_VALUES } from "./_lib/labels";

export const MAX_PRICE = 1_000_000;
const MAX_AMOUNT = 100_000;

/**
 * Необязательный текст: пробелы обрезаются, пустая строка превращается в null.
 * Вход тоже допускает null — выход схемы можно снова передать в Server Action.
 */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .nullable()
    .transform((value) => (value ? value : null));

const price = z
  .number({ error: "Укажите цену" })
  .int("Цена — целое число рублей")
  .min(0, "Цена не может быть отрицательной")
  .max(MAX_PRICE, "Слишком большая цена");

const unit = z.enum(UNIT_VALUES).nullable();
const amount = z
  .number({ error: "Укажите количество" })
  .positive("Количество должно быть больше нуля")
  .max(MAX_AMOUNT, "Слишком большое количество")
  .nullable();

export const idSchema = z.object({ id: z.uuid() });
export const toggleSchema = z.object({ id: z.uuid(), isActive: z.boolean() });
export const reorderIdsSchema = z.object({ ids: z.array(z.uuid()).max(1000) });

/* ---------- Категории ---------- */

export const categorySchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Введите название").max(120, "Не длиннее 120 символов"),
  /** Пусто — сгенерировать из названия */
  slug: z
    .string()
    .trim()
    .max(120, "Не длиннее 120 символов")
    .regex(/^[a-z0-9-]*$/, "Только латиница, цифры и дефис"),
  parentId: z.uuid().nullable(),
  funFactTitle: optionalText(120),
  funFactText: optionalText(400),
  priceGroupId: z.uuid().nullable(),
  isActive: z.boolean(),
});
export type CategoryInput = z.input<typeof categorySchema>;
export type CategoryOutput = z.output<typeof categorySchema>;

export const reorderCategoriesSchema = z.object({
  parentId: z.uuid().nullable(),
  ids: z.array(z.uuid()).max(1000),
});

/* ---------- Позиции ---------- */

export const variantSchema = z
  .object({
    id: z.uuid().optional(),
    /** Только для отображения; сервер код не принимает */
    code: z.string().optional(),
    label: z
      .string()
      .trim()
      .max(60, "Не длиннее 60 символов")
      .nullable()
      .transform((value) => (value ? value : null)),
    amount,
    unit,
    price,
  })
  .refine((v) => (v.amount == null) === (v.unit == null), {
    message: "Укажите и количество, и единицу",
    path: ["unit"],
  });
export type VariantInput = z.input<typeof variantSchema>;

export const PRICING_MODES = ["variants", "group"] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

export const itemSchema = z
  .object({
    id: z.uuid().optional(),
    categoryId: z.uuid({ error: "Выберите категорию" }),
    name: z.string().trim().min(1, "Введите название").max(160, "Не длиннее 160 символов"),
    description: optionalText(400),
    choiceNote: optionalText(120),
    originCountry: optionalText(60),
    isTakeawayDiscount: z.boolean(),
    imageMediaId: z.uuid().nullable(),
    isActive: z.boolean(),
    pricingMode: z.enum(PRICING_MODES),
    priceGroupId: z.uuid().nullable(),
    variants: z.array(variantSchema).max(50, "Не больше 50 вариантов"),
  })
  .superRefine((v, ctx) => {
    if (v.pricingMode === "group") {
      // priceGroupId = null допустим (наследуется сетка категории); наличие сетки у категории проверяет action по БД
      if (v.variants.length) {
        ctx.addIssue({
          code: "custom",
          path: ["variants"],
          message: "У позиции с общей сеткой не бывает своих вариантов",
        });
      }
    } else {
      if (v.priceGroupId) {
        ctx.addIssue({
          code: "custom",
          path: ["priceGroupId"],
          message: "Нельзя одновременно сетку и варианты",
        });
      }
      if (v.variants.length < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["variants"],
          message: "Добавьте хотя бы один вариант цены",
        });
      }
    }
  });
export type ItemInput = z.input<typeof itemSchema>;
export type ItemOutput = z.output<typeof itemSchema>;

export const quickPriceSchema = z.object({ variantId: z.uuid(), price });

export const reorderItemsSchema = z.object({
  categoryId: z.uuid(),
  ids: z.array(z.uuid()).max(1000),
});

/* ---------- Сетки цен ---------- */

export const tierSchema = z
  .object({
    id: z.uuid().optional(),
    /** Игнорируется сервером: код генерируется только при создании уровня */
    code: z.string().optional(),
    label: z
      .string({ error: "Введите подпись" })
      .trim()
      .min(1, "Введите подпись")
      .max(60, "Не длиннее 60 символов"),
    amount,
    unit,
    price,
  })
  .refine((v) => (v.amount == null) === (v.unit == null), {
    message: "Укажите и количество, и единицу",
    path: ["unit"],
  });
export type TierInput = z.input<typeof tierSchema>;

export const priceGroupSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Введите название").max(120, "Не длиннее 120 символов"),
  description: optionalText(400),
  tiers: z.array(tierSchema).min(1, "Добавьте хотя бы один уровень").max(50),
});
export type PriceGroupInput = z.input<typeof priceGroupSchema>;
export type PriceGroupOutput = z.output<typeof priceGroupSchema>;

/* ---------- Добавки ---------- */

export const modifierSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Введите название").max(120, "Не длиннее 120 символов"),
  price,
  categoryId: z.uuid().nullable(),
  isActive: z.boolean(),
});
export type ModifierInput = z.input<typeof modifierSchema>;
export type ModifierOutput = z.output<typeof modifierSchema>;

/* ---------- Массовое изменение цен ---------- */

export const BULK_PERCENT_MIN = -90;
export const BULK_PERCENT_MAX = 300;
export const BULK_AMOUNT_LIMIT = 10_000;
/** Защита от случайного изменения всего прайса разом */
export const BULK_MAX_ROWS = 2000;

const bulkModeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("percent"),
    value: z
      .number({ error: "Укажите процент" })
      .min(BULK_PERCENT_MIN, `Не меньше ${BULK_PERCENT_MIN}%`)
      .max(BULK_PERCENT_MAX, `Не больше +${BULK_PERCENT_MAX}%`)
      .multipleOf(0.5, "Шаг — 0,5%")
      .refine((v) => v !== 0, "Изменение не может быть нулевым"),
  }),
  z.object({
    kind: z.literal("amount"),
    value: z
      .number({ error: "Укажите сумму" })
      .int("Сумма — целое число рублей")
      .min(-BULK_AMOUNT_LIMIT, `Не меньше −${BULK_AMOUNT_LIMIT} ₽`)
      .max(BULK_AMOUNT_LIMIT, `Не больше +${BULK_AMOUNT_LIMIT} ₽`)
      .refine((v) => v !== 0, "Изменение не может быть нулевым"),
  }),
]);

export const bulkPriceSchema = z.object({
  /** null — всё меню */
  categoryId: z.uuid().nullable(),
  includeSubcategories: z.boolean(),
  mode: bulkModeSchema,
  round: z.boolean(),
  includePriceGroups: z.boolean(),
});
export type BulkPriceInput = z.input<typeof bulkPriceSchema>;
export type BulkPriceOutput = z.output<typeof bulkPriceSchema>;
