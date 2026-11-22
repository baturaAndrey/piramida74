"use server";

import { unstable_rethrow } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ActionError, type ActionResult, adminAction } from "@/lib/admin/action";
import { audit } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { channelStatus } from "@/lib/notify/channel-status";
import { sendEmail } from "@/lib/notify/email";
import {
  type LeadForNotify,
  type LeadQuoteForNotify,
  leadEmail,
  leadTelegram,
} from "@/lib/notify/lead-templates";
import { sendTelegram } from "@/lib/notify/telegram";
import { getSettings } from "@/lib/queries/settings";
import { leads, type LeadNotifyStatus } from "@/lib/schema";
import { requireAdminAction } from "@/lib/session";
import { LEAD_STATUSES } from "./_lib/labels";
import { getLead, type LeadDetail } from "./_queries";

// Заявки не попадают в публичный кэш — tags: [], клиент сам делает router.refresh().

export const setLeadStatus = adminAction(
  z.object({ id: z.uuid(), status: z.enum(LEAD_STATUSES) }),
  async (input, ctx) => {
    const [current] = await ctx.tx
      .select({ status: leads.status })
      .from(leads)
      .where(eq(leads.id, input.id))
      .limit(1)
      .for("update");
    if (!current) throw new ActionError("Заявка не найдена");
    if (current.status === input.status) return { status: input.status };

    await ctx.tx.update(leads).set({ status: input.status }).where(eq(leads.id, input.id));
    await audit(
      ctx.userId,
      "lead.status",
      "lead",
      input.id,
      { from: current.status, to: input.status },
      ctx.tx
    );
    return { status: input.status };
  },
  { tags: [] }
);

const resendSchema = z.object({ id: z.uuid() });

const ERR_UNAUTHORIZED = "Нет доступа";
const ERR_VALIDATION = "Проверьте введённые данные";
const ERR_NOT_FOUND = "Заявка не найдена";
const ERR_ANONYMIZED = "Персональные данные заявки удалены — уведомление не отправить";
const ERR_INTERNAL = "Внутренняя ошибка. Попробуйте ещё раз.";

/**
 * Повторная отправка email + Telegram; результат пишется в leads.notifyStatus и возвращается клиенту.
 *
 * Не через `adminAction`: тот держит транзакцию открытой на всё время handler'а, а SMTP/Telegram
 * могут отвечать секундами. Поэтому: проверка роли → чтение заявки → отправка вне транзакции →
 * короткая транзакция только для notifyStatus + аудита. Публичного кэша заявки не касаются —
 * `updateTag` не нужен, клиент сам делает `router.refresh()`.
 */
export async function resendLeadNotification(
  input: z.input<typeof resendSchema>
): Promise<ActionResult<LeadNotifyStatus>> {
  let userId: string;
  try {
    userId = (await requireAdminAction()).user.id;
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: ERR_UNAUTHORIZED };
  }

  const parsed = resendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERR_VALIDATION };
  const { id } = parsed.data;

  try {
    const lead = await getLead(id);
    if (!lead) return { ok: false, error: ERR_NOT_FOUND };
    if (lead.anonymizedAt) return { ok: false, error: ERR_ANONYMIZED };

    const settings = await getSettings();
    const notifyLead = toLeadForNotify(lead);
    // async-обёртки: синхронная ошибка шаблона тоже станет rejected-результатом своего канала
    const [email, telegram] = await Promise.allSettled([
      (async () => sendEmail(leadEmail(notifyLead)))(),
      (async () =>
        sendTelegram(leadTelegram(notifyLead, { includePii: settings.telegramIncludePii })))(),
    ]);
    const notifyStatus: LeadNotifyStatus = {
      email: channelStatus(email),
      telegram: channelStatus(telegram),
    };

    // Заявку могли удалить, пока шла отправка: тогда статус писать некуда, но уведомление уже ушло
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(leads)
        .set({ notifyStatus })
        .where(eq(leads.id, id))
        .returning({ id: leads.id });
      if (!row) return false;
      await audit(userId, "lead.resend", "lead", id, notifyStatus, tx);
      return true;
    });
    if (!updated) return { ok: false, error: ERR_NOT_FOUND };

    return { ok: true, data: notifyStatus };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[resendLeadNotification]", error);
    return { ok: false, error: ERR_INTERNAL };
  }
}

/** Строка заявки → плоский LeadForNotify (как в submitLead; расчёт — из quoteSnapshot) */
function toLeadForNotify(lead: LeadDetail): LeadForNotify {
  let quote: LeadQuoteForNotify | null = null;
  const snapshotQuote = lead.snapshot?.quote;
  if (snapshotQuote) {
    // Повторяет toNotifyQuote из src/lib/actions/leads.ts
    quote = {
      lines: snapshotQuote.lines,
      rentalTotal: snapshotQuote.rentalTotal,
      foodTotal: snapshotQuote.foodTotal,
      total: snapshotQuote.total,
      perGuest: snapshotQuote.perGuest,
      warnings: snapshotQuote.warnings,
      hallName: lead.hallName,
      tables: lead.snapshot?.input?.tables ?? null,
    };
  }
  return {
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
    promotionTitle: lead.promotionTitle,
    tournamentTitle: lead.tournamentTitle,
    quote,
  };
}
