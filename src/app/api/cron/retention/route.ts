import { connection } from "next/server";
import { and, isNull, lt } from "drizzle-orm";
import { isValidCronRequest } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/queries/settings";
import { leads } from "@/lib/schema";

// `export const dynamic` не используется: с cacheComponents (Next 16) route segment config
// `dynamic` запрещён. POST-обработчики и так не пререндерятся; `connection()` — страховка.

/**
 * Обезличивание заявок старше `leadRetentionMonths` (Dokploy Schedules, ежедневно).
 * Номер, тип, блок, сумма и снимок расчёта остаются для статистики. Идемпотентно:
 * уже обезличенные заявки (`anonymizedAt` не null) не трогаются.
 */
export async function POST(req: Request): Promise<Response> {
  await connection();
  // `Authorization: Bearer ${CRON_SECRET}`; секрет не задан — всегда 401
  if (!isValidCronRequest(req)) return new Response("Unauthorized", { status: 401 });

  const months = (await getSettings()).leadRetentionMonths;
  if (!Number.isInteger(months) || months < 1) {
    return Response.json({ ok: true, skipped: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const anonymizedAt = new Date();
  const res = await db
    .update(leads)
    .set({ name: null, phone: null, comment: null, ipHash: null, userAgent: "", anonymizedAt })
    .where(and(lt(leads.createdAt, cutoff), isNull(leads.anonymizedAt)))
    .returning({ id: leads.id });

  // eslint-disable-next-line no-console -- информационный лог ежедневного cron (Dokploy)
  console.info(`[retention] anonymized ${res.length} leads older than ${months} months`);
  return Response.json(
    { ok: true, anonymized: res.length },
    { headers: { "Cache-Control": "no-store" } }
  );
}
