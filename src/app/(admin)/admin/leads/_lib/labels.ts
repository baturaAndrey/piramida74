// Изоморфный модуль: подписи и форматтеры раздела «Заявки» (без серверных импортов —
// поэтому подписи окна звонка не берутся из notify/lead-templates, он тянет env и telegram).
import { z } from "zod";
import type { QuoteLineKind } from "@/lib/calculator";
import { TZ } from "@/lib/dates";
import type { CallbackWindow, LeadStatus, LeadType } from "@/lib/schema/enums";

export const LEAD_TYPES = [
  "callback",
  "booking",
  "promo",
  "calculator",
  "tournament",
] as const satisfies readonly LeadType[];

export const LEAD_STATUSES = [
  "new",
  "in_progress",
  "done",
  "spam",
] as const satisfies readonly LeadStatus[];

/** Короткие подписи типов для фильтра, бейджей и CSV (в уведомлениях — длинные из notify) */
/** Параметры фильтра списка; переносятся в ссылки экспорта и пагинации */
export const LEADS_FILTER_KEYS = ["status", "type", "q", "from", "to"] as const;
export type LeadsFilterKey = (typeof LEADS_FILTER_KEYS)[number];
export type LeadsFilterValues = Record<LeadsFilterKey, string>;

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  callback: "Обратный звонок",
  booking: "Бронь",
  promo: "Акция",
  calculator: "Калькулятор",
  tournament: "Турнир",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Готово",
  spam: "Спам",
};

/** Подписи статусов в фильтре (множественное число) */
export const LEAD_STATUS_FILTER_LABELS: Record<LeadStatus, string> = {
  new: "Новые",
  in_progress: "В работе",
  done: "Готово",
  spam: "Спам",
};

/** Совпадают с CALLBACK_WINDOW_LABELS в notify/lead-templates */
export const CALLBACK_WINDOW_LABELS: Record<CallbackWindow, string> = {
  now: "Сейчас",
  hour: "В течение часа",
  day: "В течение дня",
  week: "На этой неделе",
};

/** Ошибка sendEmail/sendTelegram, когда канал не настроен (нет SMTP / бота) */
const NOTIFY_NOT_CONFIGURED = "not_configured";

/** Канал не настроен — это пропуск уведомления, а не сбой отправки */
export function isNotifySkipped(status: { ok: boolean; error?: string } | undefined): boolean {
  return status?.ok === false && status.error === NOTIFY_NOT_CONFIGURED;
}

/** «12 400 ₽» (неразрывные пробелы) */
export function formatRub(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${digits} ₽`;
}

/** Классы для `<Badge variant="outline">`: new синий, in_progress жёлтый, done зелёный, spam серый */
export const LEAD_STATUS_BADGE_CLASSES: Record<LeadStatus, string> = {
  new: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  in_progress:
    "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300",
  done: "border-green-200 bg-green-50 text-green-600 dark:border-green-900 dark:bg-green-950 dark:text-green-400",
  spam: "border-border bg-muted text-muted-foreground",
};

export const QUOTE_LINE_KIND_LABELS: Record<QuoteLineKind, string> = {
  rental: "Аренда",
  item: "Позиция",
  set: "Сет",
  extra: "Услуга",
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

export function isLeadType(value: unknown): value is LeadType {
  return typeof value === "string" && (LEAD_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Форматирование дат и сумм (всегда в зоне клуба)
// ---------------------------------------------------------------------------

const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
] as const;

const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type DateParts = { year: string; month: string; day: string; hour: string; minute: string };

function tzParts(date: Date): DateParts {
  const o: Record<string, string> = {};
  for (const part of partsFormat.formatToParts(date)) {
    if (part.type !== "literal") o[part.type] = part.value;
  }
  // Некоторые сборки ICU выводят полночь как «24» даже с h23
  const hour = o.hour === "24" ? "00" : (o.hour ?? "00");
  return {
    year: o.year ?? "1970",
    month: o.month ?? "01",
    day: o.day ?? "01",
    hour,
    minute: o.minute ?? "00",
  };
}

/** «20 ноя, 14:05» — для списка заявок */
export function formatLeadListDate(date: Date): string {
  const p = tzParts(date);
  const month = MONTHS_SHORT[Number(p.month) - 1] ?? "";
  return `${Number(p.day)} ${month}, ${p.hour}:${p.minute}`;
}

/** «20.11.2026 14:05» — для CSV */
export function formatCsvDate(date: Date): string {
  const p = tzParts(date);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** Полная дата для карточки (правило задачи: dateStyle medium + timeStyle short) */
export const fullDateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  dateStyle: "medium",
  timeStyle: "short",
});

/** «2026-12-05» → «05.12.2026»; некорректное значение возвращается как есть */
export function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : iso;
}

// ---------------------------------------------------------------------------
// Снимок расчёта калькулятора (`leads.quoteSnapshot` = { input, quote, calculatedAt })
// ---------------------------------------------------------------------------

const finite = z.number().finite();

const quoteLineSchema = z.object({
  kind: z.enum(["rental", "extra", "set", "item"]),
  label: z.string(),
  qty: finite,
  unitPrice: finite,
  total: finite,
});

// Снимок пишется сервером, но мог быть создан старой версией калькулятора — разбираем мягко
const quoteSchema = z.object({
  lines: z.array(quoteLineSchema),
  rentalTotal: finite,
  foodTotal: finite,
  total: finite,
  perGuest: finite,
  warnings: z.array(z.string()).catch([]),
  promoHints: z.array(z.string()).catch([]),
});

const quoteInputSchema = z
  .object({
    opDate: z.string(),
    startMin: finite,
    durationMin: finite,
    guests: finite,
    hallId: z.string(),
    tables: finite,
    pensioner: z.boolean(),
  })
  .partial();

export type SnapshotQuote = z.infer<typeof quoteSchema>;
export type SnapshotInput = z.infer<typeof quoteInputSchema>;

export type QuoteSnapshot = {
  quote: SnapshotQuote | null;
  input: SnapshotInput | null;
  /** Название зала, если сохранено в снимке (текущий калькулятор его не пишет) */
  hallName: string | null;
  calculatedAt: string | null;
};

/** null — снимка нет или он не похож на расчёт */
export function parseQuoteSnapshot(raw: unknown): QuoteSnapshot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const quote = quoteSchema.safeParse(record.quote);
  const input = quoteInputSchema.safeParse(record.input);
  if (!quote.success && !input.success) return null;
  return {
    quote: quote.success ? quote.data : null,
    input: input.success ? input.data : null,
    hallName: typeof record.hallName === "string" ? record.hallName : null,
    calculatedAt: typeof record.calculatedAt === "string" ? record.calculatedAt : null,
  };
}

/** Query-строка без пустых значений (без «?»); page > 1 добавляется в конец */
export function buildLeadsQuery(values: Partial<LeadsFilterValues>, page?: number): string {
  const search = new URLSearchParams();
  for (const key of LEADS_FILTER_KEYS) {
    const value = values[key]?.trim();
    if (value) search.set(key, value);
  }
  if (page && page > 1) search.set("page", String(page));
  return search.toString();
}
