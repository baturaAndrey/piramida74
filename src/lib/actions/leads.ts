"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { calculateQuote, type Quote } from "@/lib/calculator";
import { minToClock } from "@/lib/dates";
import { db } from "@/lib/db";
import { getClientEnv } from "@/lib/env";
import { sendEmail } from "@/lib/notify/email";
import {
  type LeadForNotify,
  type LeadQuoteForNotify,
  leadEmail,
  leadTelegram,
} from "@/lib/notify/lead-templates";
import { sendTelegram } from "@/lib/notify/telegram";
import { normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp, UNKNOWN_IP } from "@/lib/request-ip";
import {
  legalDocuments,
  type LeadNotifyStatus,
  leads,
  type NewLead,
  type NotifyChannelStatus,
  promotions,
  siteSettings,
  tournaments,
} from "@/lib/schema";
import { loadCatalogForQuote } from "./leads-catalog";
import { leadInputSchema, quoteInputSchema, type SubmitLeadResult } from "./leads-schema";

// Единственный экспорт файла — submitLead ('use server' допускает только async-функции).

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = { limit: 5, windowMs: RATE_LIMIT_WINDOW_MS } as const;
// Без IP все клиенты попадают в один общий бакет — лимит 5 заблокировал бы заявки всего сайта.
// Повышенный лимит лишь страхует от флуда, пока не исправлена конфигурация прокси.
const UNKNOWN_IP_RATE_LIMIT = { limit: 100, windowMs: RATE_LIMIT_WINDOW_MS } as const;
let unknownIpWarned = false;

/** Лимит для IP; при неизвестном IP — однократное предупреждение в production и общий мягкий лимит. */
function rateLimitFor(ip: string) {
  if (ip !== UNKNOWN_IP) return RATE_LIMIT;
  if (!unknownIpWarned && process.env.NODE_ENV === "production") {
    unknownIpWarned = true;
    console.warn(
      "[submitLead] IP клиента не определён (нет x-real-ip / x-forwarded-for) — " +
        "все заявки делят один бакет rate limit; проверьте настройки прокси"
    );
  }
  return UNKNOWN_IP_RATE_LIMIT;
}
const USER_AGENT_MAX = 300;
const SECONDS_PER_MINUTE = 60;
const NUMERIC_FIELDS = new Set(["guests"]);
const PII_SETTING_KEY = "telegramIncludePii";

const GENERIC_ERROR = "Не удалось отправить заявку. Позвоните нам или попробуйте позже.";
const QUOTE_ERROR = {
  ok: false,
  error: "Не удалось прочитать расчёт",
  fieldErrors: { quote: ["Некорректный расчёт"] },
} as const satisfies SubmitLeadResult;

/** Принимает заявку с любой формы сайта. Вход — объект `LeadInput` или `FormData`. */
export async function submitLead(raw: unknown): Promise<SubmitLeadResult> {
  const input = raw instanceof FormData ? formDataToObject(raw) : raw;
  const parsed = leadInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Проверьте введённые данные",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const data = parsed.data;

  // Honeypot: боту отвечаем «успехом», ничего не сохраняем и не уведомляем
  if (data.website) return { ok: true, number: 0 };

  try {
    const h = await headers();
    const ip = getClientIp(h);
    const ipHash = hashIp(ip);
    const rl = rateLimit(`lead:${ipHash}`, rateLimitFor(ip));
    if (!rl.ok) {
      const minutes = Math.ceil(rl.retryAfter / SECONDS_PER_MINUTE);
      return { ok: false, error: `Слишком много заявок. Попробуйте через ${minutes} мин.` };
    }

    const consentDocumentId = await getCurrentConsentDocumentId();
    if (!consentDocumentId) {
      console.error("[submitLead] нет опубликованного документа согласия — заявки не принимаются");
      return { ok: false, error: "Заявки временно не принимаются" };
    }

    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false, error: "Проверьте введённые данные" }; // схема уже проверила, страховка типов

    const values: NewLead = {
      type: data.type,
      status: "new",
      sourceBlock: data.sourceBlock,
      formTitle: data.formTitle,
      pageUrl: data.pagePath ? siteUrl() + data.pagePath : "",
      name: data.name || null,
      phone,
      callbackWindow: data.callbackWindow ?? null,
      preferredDate: data.preferredDate ?? null,
      preferredTime: data.preferredTime ?? null,
      guests: data.guests ?? null,
      comment: data.comment || null,
      consentDocumentId,
      consentAt: new Date(),
      ipHash,
      userAgent: h.get("user-agent")?.slice(0, USER_AGENT_MAX) ?? "",
      notifyStatus: {},
    };

    // Неизвестный id акции/турнира не должен ронять заявку на FK — такую ссылку просто не сохраняем
    const [promotionTitle, tournamentTitle] = await Promise.all([
      data.promotionId ? findPromotionTitle(data.promotionId) : null,
      data.tournamentId ? findTournamentTitle(data.tournamentId) : null,
    ]);
    if (data.promotionId && promotionTitle !== null) values.promotionId = data.promotionId;
    if (data.tournamentId && tournamentTitle !== null) values.tournamentId = data.tournamentId;

    let quoteForNotify: LeadQuoteForNotify | null = null;
    if (data.type === "calculator") {
      // Только серверный пересчёт по свежему каталогу: суммы с клиента игнорируются
      let json: unknown;
      try {
        json = JSON.parse(data.quote ?? "");
      } catch {
        return QUOTE_ERROR;
      }
      const qi = quoteInputSchema.safeParse(json);
      if (!qi.success) return QUOTE_ERROR;

      const catalog = await loadCatalogForQuote();
      const quote = calculateQuote(qi.data, catalog);
      values.quoteSnapshot = { input: qi.data, quote, calculatedAt: new Date().toISOString() };
      values.quoteTotal = quote.total;
      values.preferredDate = qi.data.opDate;
      values.preferredTime = minToClock(qi.data.startMin);
      values.guests = qi.data.guests;

      const hallName = catalog.halls.find((hall) => hall.id === qi.data.hallId)?.name ?? null;
      quoteForNotify = toNotifyQuote(quote, hallName, qi.data.tables);
    }

    const [lead] = await db.insert(leads).values(values).returning();
    if (!lead) throw new Error("insert returned no rows");

    const notifyLead: LeadForNotify = {
      id: lead.id,
      number: lead.number,
      type: lead.type,
      sourceBlock: lead.sourceBlock,
      formTitle: lead.formTitle,
      pageUrl: lead.pageUrl,
      name: lead.name,
      phone: lead.phone,
      callbackWindow: lead.callbackWindow,
      preferredDate: lead.preferredDate,
      preferredTime: lead.preferredTime,
      guests: lead.guests,
      comment: lead.comment,
      promotionTitle,
      tournamentTitle,
      quote: quoteForNotify,
    };
    // Уведомления — после ответа клиенту; их сбой никогда не отменяет уже сохранённую заявку
    after(() => notifyLeadSafely(notifyLead));

    return { ok: true, number: lead.number };
  } catch (err) {
    console.error("[submitLead] failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/** FormData → объект для zod: пустые строки и файлы отбрасываются, consent и числовые поля приводятся. */
function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== "string" || value === "") continue;
    if (key === "consent") out[key] = value === "on" || value === "true";
    else if (NUMERIC_FIELDS.has(key)) out[key] = Number(value);
    else out[key] = value;
  }
  return out;
}

function siteUrl(): string {
  return getClientEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
}

/** Текущая версия согласия: последний по publishedAt опубликованный документ (null = черновик). Без кэша. */
async function getCurrentConsentDocumentId(): Promise<string | null> {
  const [doc] = await db
    .select({ id: legalDocuments.id })
    .from(legalDocuments)
    .where(and(eq(legalDocuments.type, "consent"), isNotNull(legalDocuments.publishedAt)))
    .orderBy(desc(legalDocuments.publishedAt))
    .limit(1);
  return doc?.id ?? null;
}

async function findPromotionTitle(id: string): Promise<string | null> {
  const [row] = await db
    .select({ title: promotions.title })
    .from(promotions)
    .where(eq(promotions.id, id))
    .limit(1);
  return row?.title ?? null;
}

async function findTournamentTitle(id: string): Promise<string | null> {
  const [row] = await db
    .select({ title: tournaments.title })
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);
  return row?.title ?? null;
}

function toNotifyQuote(quote: Quote, hallName: string | null, tables: number): LeadQuoteForNotify {
  return {
    lines: quote.lines,
    rentalTotal: quote.rentalTotal,
    foodTotal: quote.foodTotal,
    total: quote.total,
    perGuest: quote.perGuest,
    warnings: quote.warnings,
    hallName,
    tables,
  };
}

/** Флаг ПДн в Telegram читается напрямую из site_settings (значение jsonb; нет строки → false). */
async function readTelegramIncludePii(): Promise<boolean> {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, PII_SETTING_KEY))
    .limit(1);
  return row?.value === true;
}

function channelStatus(
  result: PromiseSettledResult<{ ok: boolean; error?: string }>
): NotifyChannelStatus {
  const at = new Date().toISOString();
  if (result.status === "rejected") {
    const error = result.reason instanceof Error ? result.reason.message : "unknown error";
    return { ok: false, error, at };
  }
  const { ok, error } = result.value;
  return error === undefined ? { ok, at } : { ok, error, at };
}

/** Отправка email + Telegram и запись результата в leads.notifyStatus. Никогда не бросает. */
async function notifyLeadSafely(lead: LeadForNotify): Promise<void> {
  try {
    const includePii = await readTelegramIncludePii().catch((err: unknown) => {
      console.error(
        "[submitLead] telegramIncludePii read failed:",
        err instanceof Error ? err.message : err
      );
      return false;
    });
    // async-обёртки: синхронная ошибка шаблона тоже станет rejected-результатом своего канала
    const [email, telegram] = await Promise.allSettled([
      (async () => sendEmail(leadEmail(lead)))(),
      (async () => sendTelegram(leadTelegram(lead, { includePii })))(),
    ]);
    const notifyStatus: LeadNotifyStatus = {
      email: channelStatus(email),
      telegram: channelStatus(telegram),
    };
    await db.update(leads).set({ notifyStatus }).where(eq(leads.id, lead.id));
  } catch (err) {
    console.error("[submitLead] notify failed:", err instanceof Error ? err.message : err);
  }
}
