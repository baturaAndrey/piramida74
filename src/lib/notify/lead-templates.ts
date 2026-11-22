import { getClientEnv } from "@/lib/env";
import { escapeHtml } from "./telegram";

// Модуль намеренно не импортирует @/lib/schema, @/lib/dates, @/lib/calculator:
// он должен собираться независимо, а данные получает плоским типом LeadForNotify.

export type LeadNotifyType = "callback" | "booking" | "promo" | "calculator" | "tournament";
export type LeadCallbackWindow = "now" | "hour" | "day" | "week";

export interface LeadQuoteForNotify {
  lines: {
    kind: "rental" | "extra" | "set" | "item";
    label: string;
    qty: number;
    unitPrice: number;
    total: number;
  }[];
  rentalTotal: number;
  foodTotal: number;
  total: number;
  perGuest: number;
  warnings: string[];
  hallName: string | null;
  tables: number | null;
}

/** Плоское представление заявки для уведомлений (собирается из строки leads, без импорта схемы) */
export interface LeadForNotify {
  id: string; // uuid — для ссылки в админку
  number: number; // «Заявка #N»
  type: LeadNotifyType;
  sourceBlock: string; // «Шапка сайта», «Первый экран»…
  formTitle: string;
  pageUrl: string;
  name: string | null;
  phone: string | null;
  callbackWindow: LeadCallbackWindow | null;
  preferredDate: string | null; // YYYY-MM-DD
  preferredTime: string | null; // HH:mm
  guests: number | null;
  comment: string | null;
  promotionTitle: string | null;
  tournamentTitle: string | null;
  quote: LeadQuoteForNotify | null; // из quoteSnapshot (type === "calculator")
}

export interface LeadEmail {
  subject: string;
  html: string;
  text: string;
}

/** Telegram-чат общий с Тюменью — город обязателен в каждом сообщении */
const CITY = "Челябинск";
const EMPTY = "—";
const NBSP = " ";
const QUOTE_DISCLAIMER = "Расчёт предварительный, итог подтверждает администратор";

/** Ограничения длины полей в Telegram, чтобы сообщение заведомо уложилось в 4096 символов и теги не разрезались */
const TG_COMMENT_MAX = 300;
const TG_FIELD_MAX = 200;

export const LEAD_TYPE_LABELS: Record<LeadNotifyType, string> = {
  callback: "Обратный звонок",
  booking: "Бронирование стола",
  promo: "Акция",
  calculator: "Расчёт калькулятора",
  tournament: "Заявка на турнир",
};

/** Короткие подписи для заголовка Telegram: «Новая заявка #12 (калькулятор, …)» */
const LEAD_TYPE_SHORT: Record<LeadNotifyType, string> = {
  callback: "обратный звонок",
  booking: "бронирование",
  promo: "акция",
  calculator: "калькулятор",
  tournament: "турнир",
};

export const CALLBACK_WINDOW_LABELS: Record<LeadCallbackWindow, string> = {
  now: "Сейчас",
  hour: "В течение часа",
  day: "В течение дня",
  week: "На этой неделе",
};

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

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

// ---------------------------------------------------------------------------
// Хелперы форматирования (собственные, без Intl и @/lib/dates)
// ---------------------------------------------------------------------------

/** 19140 → «19 140 ₽» (неразрывные пробелы, округление до рубля) */
export function formatRub(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}${digits}${NBSP}₽`;
}

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** «2026-12-05» → «5 дек»; некорректная строка возвращается как есть */
function formatDateShort(value: string): string {
  const d = parseIsoDate(value);
  return d ? `${d.day} ${MONTHS_SHORT[d.month - 1]}` : value;
}

/** «2026-12-05» → «5 декабря 2026»; некорректная строка возвращается как есть */
function formatDateLong(value: string): string {
  const d = parseIsoDate(value);
  return d ? `${d.day} ${MONTHS_GENITIVE[d.month - 1]} ${d.year}` : value;
}

/** 1 гость, 2 гостя, 5 гостей, 21 гость */
function pluralGuests(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} гость`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} гостя`;
  return `${n} гостей`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Экранированное значение или «—» для пустых */
function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY;
  const str = String(value).trim();
  return str === "" ? EMPTY : escapeHtml(str);
}

function plain(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY;
  const str = String(value).trim();
  return str === "" ? EMPTY : str;
}

/** Номер телефона для href="tel:…": только цифры и ведущий «+» */
function telHref(phone: string): string {
  const prefix = phone.trim().startsWith("+") ? "+" : "";
  return `tel:${prefix}${phone.replace(/\D/g, "")}`;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function formatWhen(
  date: string | null,
  time: string | null,
  formatDate: (v: string) => string
): string | null {
  const parts = [date ? formatDate(date) : null, time].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Не-ПДн сводка для заголовка: «калькулятор, 8 гостей, 5 дек 19:00» */
function summary(lead: LeadForNotify): string {
  const parts = [LEAD_TYPE_SHORT[lead.type]];
  if (lead.guests !== null && lead.guests > 0) parts.push(pluralGuests(lead.guests));
  const when = formatWhen(lead.preferredDate, lead.preferredTime, formatDateShort);
  if (when) parts.push(when);
  return parts.join(", ");
}

export function adminLeadUrl(lead: Pick<LeadForNotify, "id">): string {
  return `${getClientEnv().NEXT_PUBLIC_SITE_URL}/admin/leads/${lead.id}`;
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

/** HTML для Telegram. По умолчанию (includePii: false) без имени, телефона и комментария. */
export function leadTelegram(lead: LeadForNotify, opts: { includePii: boolean }): string {
  const lines: string[] = [];
  const row = (label: string, value: string) => lines.push(`<b>${label}:</b> ${value}`);
  const field = (value: string | null) => esc(value === null ? null : truncate(value, TG_FIELD_MAX));

  lines.push(`<b>Новая заявка #${lead.number}</b> (${escapeHtml(summary(lead))})`);
  row("Город", CITY);
  row("Форма", field(lead.formTitle));
  row("Блок", field(lead.sourceBlock));

  if (opts.includePii) {
    row("Имя", field(lead.name));
    row("Телефон", field(lead.phone));
    if (lead.comment) row("Комментарий", esc(truncate(lead.comment, TG_COMMENT_MAX)));
    if (lead.promotionTitle) row("Акция", field(lead.promotionTitle));
    if (lead.tournamentTitle) row("Турнир", field(lead.tournamentTitle));
  }

  if (lead.callbackWindow) row("Время звонка", CALLBACK_WINDOW_LABELS[lead.callbackWindow]);
  if (lead.quote) row("Сумма", formatRub(lead.quote.total));

  lines.push(`<a href="${escapeHtml(adminLeadUrl(lead))}">Открыть в админке</a>`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

interface EmailField {
  label: string;
  /** Уже экранированный HTML */
  html: string;
  text: string;
}

function collectEmailFields(lead: LeadForNotify): EmailField[] {
  const fields: EmailField[] = [];
  const add = (label: string, value: string | number | null) =>
    fields.push({ label, html: esc(value), text: plain(value) });

  add("Тип", LEAD_TYPE_LABELS[lead.type]);
  add("Город", CITY);
  add("Форма", lead.formTitle);
  add("Блок", lead.sourceBlock);

  const pageUrl = lead.pageUrl.trim();
  fields.push({
    label: "Страница",
    html:
      pageUrl && isHttpUrl(pageUrl)
        ? `<a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a>`
        : esc(pageUrl),
    text: plain(pageUrl),
  });

  add("Имя", lead.name);
  const phone = lead.phone?.trim() ?? "";
  fields.push({
    label: "Телефон",
    html: phone ? `<a href="${escapeHtml(telHref(phone))}">${escapeHtml(phone)}</a>` : EMPTY,
    text: plain(phone),
  });

  if (lead.callbackWindow) add("Время звонка", CALLBACK_WINDOW_LABELS[lead.callbackWindow]);
  if (lead.preferredDate) add("Дата", formatDateLong(lead.preferredDate));
  if (lead.preferredTime) add("Время", lead.preferredTime);
  if (lead.guests !== null) add("Гостей", lead.guests);
  if (lead.promotionTitle) add("Акция", lead.promotionTitle);
  if (lead.tournamentTitle) add("Турнир", lead.tournamentTitle);
  if (lead.quote?.hallName) add("Зал", lead.quote.hallName);
  if (lead.quote?.tables !== null && lead.quote?.tables !== undefined) {
    add("Столов", lead.quote.tables);
  }
  add("Комментарий", lead.comment);
  return fields;
}

const CELL = 'style="padding:4px 8px;border:1px solid #ddd"';
const CELL_RIGHT = 'style="padding:4px 8px;border:1px solid #ddd;text-align:right"';

function quoteHtml(quote: LeadQuoteForNotify): string {
  const rows = quote.lines
    .map(
      (line) =>
        `<tr><td ${CELL}>${esc(line.label)}</td><td ${CELL_RIGHT}>${esc(line.qty)}</td>` +
        `<td ${CELL_RIGHT}>${formatRub(line.unitPrice)}</td><td ${CELL_RIGHT}>${formatRub(line.total)}</td></tr>`
    )
    .join("");
  const totals = [
    ["Аренда", quote.rentalTotal],
    ["Меню", quote.foodTotal],
    ["Всего", quote.total],
    ["На гостя", quote.perGuest],
  ] as const;
  const warnings =
    quote.warnings.length > 0
      ? `<ul>${quote.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`
      : "";
  return [
    "<h3>Расчёт</h3>",
    '<table style="border-collapse:collapse">',
    `<thead><tr><th ${CELL}>Позиция</th><th ${CELL}>Кол-во</th><th ${CELL}>Цена</th><th ${CELL}>Сумма</th></tr></thead>`,
    `<tbody>${rows}</tbody>`,
    "</table>",
    `<p>${totals.map(([label, value]) => `<b>${label}:</b> ${formatRub(value)}`).join("<br>")}</p>`,
    warnings,
    `<p><i>${QUOTE_DISCLAIMER}</i></p>`,
  ].join("");
}

function quoteText(quote: LeadQuoteForNotify): string {
  const lines = ["", "Расчёт:"];
  for (const line of quote.lines) {
    lines.push(
      `- ${line.label}: ${line.qty} × ${formatRub(line.unitPrice)} = ${formatRub(line.total)}`
    );
  }
  lines.push(
    "",
    `Аренда: ${formatRub(quote.rentalTotal)}`,
    `Меню: ${formatRub(quote.foodTotal)}`,
    `Всего: ${formatRub(quote.total)}`,
    `На гостя: ${formatRub(quote.perGuest)}`
  );
  if (quote.warnings.length > 0) {
    lines.push("", "Предупреждения:", ...quote.warnings.map((w) => `- ${w}`));
  }
  lines.push("", QUOTE_DISCLAIMER);
  return lines.join("\n");
}

/** Полное письмо о заявке (с ПДн) для ящика клуба. */
export function leadEmail(lead: LeadForNotify): LeadEmail {
  const typeLabel = LEAD_TYPE_LABELS[lead.type];
  const title = `Заявка #${lead.number} — ${typeLabel}`;
  const subject = `${title} (${CITY})`;
  const adminUrl = adminLeadUrl(lead);
  const fields = collectEmailFields(lead);

  const html = [
    "<!DOCTYPE html>",
    '<html lang="ru"><body style="font-family:Arial,sans-serif;font-size:14px;color:#111">',
    `<h2>${escapeHtml(title)}</h2>`,
    '<table style="border-collapse:collapse">',
    fields
      .map(
        (f) =>
          `<tr><td style="padding:4px 12px 4px 0;vertical-align:top;color:#555">${f.label}</td>` +
          `<td style="padding:4px 0;white-space:pre-wrap">${f.html}</td></tr>`
      )
      .join(""),
    "</table>",
    lead.quote ? quoteHtml(lead.quote) : "",
    `<p><a href="${escapeHtml(adminUrl)}">Открыть заявку в админке</a></p>`,
    "</body></html>",
  ].join("");

  const text = [
    title,
    "",
    ...fields.map((f) => `${f.label}: ${f.text}`),
    lead.quote ? quoteText(lead.quote) : "",
    "",
    `Открыть заявку в админке: ${adminUrl}`,
  ].join("\n");

  return { subject, html, text };
}
