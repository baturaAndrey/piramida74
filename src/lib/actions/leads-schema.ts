import { z } from "zod";
import { isPhoneComplete, isValidPhone } from "@/lib/phone";

// Схемы вынесены из `leads.ts`: файл с 'use server' может экспортировать только async-функции.

export const LEAD_TYPES = ["callback", "booking", "promo", "calculator", "tournament"] as const;
export const CALLBACK_WINDOWS = ["now", "hour", "day", "week"] as const;

export type LeadType = (typeof LEAD_TYPES)[number];
export type CallbackWindow = (typeof CALLBACK_WINDOWS)[number];

const NAME_MIN_LENGTH = 2;
const PHONE_ERROR = "Введите номер телефона полностью";
const NAME_ERROR = "Введите имя";
const CONSENT_ERROR = "Необходимо согласие на обработку данных";

/** nanoid-коды и составные коды уровней сетки `${item.code}-${tier.code}` */
const code = z.string().regex(/^[a-z0-9-]{1,20}$/);

/** Зеркало QuoteInput из src/lib/calculator/types.ts (контракт задачи 05); количества — только целые */
export const quoteInputSchema = z.object({
  opDate: z.iso.date(),
  startMin: z.number().int().min(0).max(1440),
  durationMin: z.number().int().min(30).max(720),
  guests: z.number().int().min(1).max(200),
  hallId: z.uuid(),
  tables: z.number().int().min(1).max(50),
  pensioner: z.boolean(),
  extras: z.array(z.object({ id: z.uuid(), qty: z.number().int().min(1).max(50) })).max(20),
  sets: z.array(z.object({ code, qty: z.number().int().min(1).max(200) })).max(20),
  items: z.array(z.object({ code, qty: z.number().int().min(1).max(200) })).max(100),
});

/**
 * Объектные проверки по умолчанию пропускаются, если в объекте уже есть ошибки (например, нет согласия).
 * `when` запускает их, пока корректны поля, от которых они зависят, — пользователь видит все ошибки сразу.
 */
const fieldsAreValid =
  (...fields: string[]) =>
  (payload: z.core.ParsePayload): boolean =>
    !payload.issues.some((issue) => fields.includes(String(issue.path?.[0])));

const hasValidType = fieldsAreValid("type");

/** Имя обязательно (мин. 2 символа) для всех типов, кроме обратного звонка */
function nameRule(data: { type: LeadType; name?: string | undefined }): boolean {
  return data.type === "callback" || (data.name ?? "").length >= NAME_MIN_LENGTH;
}

const NAME_RULE_PARAMS = {
  path: ["name"],
  message: NAME_ERROR,
  when: fieldsAreValid("type", "name"),
};

export const leadInputSchema = z
  .object({
    type: z.enum(LEAD_TYPES),
    sourceBlock: z.string().trim().min(1).max(120), // как data-hidden-id старого сайта: «Шапка сайта», «Первый экран»…
    formTitle: z.string().trim().min(1).max(120), // «Перезвоните мне», «Забронировать»…
    pagePath: z.string().max(300).startsWith("/").optional(), // location.pathname + search с клиента
    name: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(32).refine(isValidPhone, PHONE_ERROR),
    callbackWindow: z.enum(CALLBACK_WINDOWS).optional(),
    preferredDate: z.iso.date().optional(),
    preferredTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    guests: z.number().int().min(1).max(200).optional(),
    comment: z.string().trim().max(1000).optional(),
    promotionId: z.uuid().optional(),
    tournamentId: z.uuid().optional(),
    quote: z.string().max(20000).optional(), // калькулятор: JSON.stringify(QuoteInput) из hidden-поля LeadForm
    consent: z.literal(true, { error: CONSENT_ERROR }),
    website: z.string().max(200).optional(), // honeypot
  })
  .refine(nameRule, NAME_RULE_PARAMS)
  .refine((data) => data.type !== "calculator" || Boolean(data.quote), {
    path: ["quote"],
    message: "Некорректный расчёт",
    when: hasValidType,
  });

export type LeadInput = z.input<typeof leadInputSchema>;
export type SubmitLeadResult =
  | { ok: true; number: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Клиентская схема только видимых полей LeadForm (полную проверку делает submitLead).
 * `type` хранится в значениях формы, но не рендерится — нужен для правила имени.
 * `consent` — boolean (чекбокс изначально не отмечен), а не literal(true), чтобы defaultValues типизировались.
 */
export const leadFormFieldsSchema = z
  .object({
    type: z.enum(LEAD_TYPES),
    name: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(32).refine(isPhoneComplete, PHONE_ERROR),
    callbackWindow: z.enum(CALLBACK_WINDOWS).optional(),
    consent: z.boolean().refine((v) => v, { message: CONSENT_ERROR }),
    website: z.string().max(200).optional(),
  })
  .refine(nameRule, NAME_RULE_PARAMS);

export type LeadFormFieldsInput = z.input<typeof leadFormFieldsSchema>;
export type LeadFormFields = z.output<typeof leadFormFieldsSchema>;
