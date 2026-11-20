import { desc } from "drizzle-orm";
import { buildLeadsWhere, firstParam } from "@/app/(admin)/admin/leads/_lib/filters";
import {
  CALLBACK_WINDOW_LABELS,
  formatCsvDate,
  formatIsoDate,
  LEAD_STATUS_LABELS,
  LEAD_TYPE_LABELS,
} from "@/app/(admin)/admin/leads/_lib/labels";
import { audit } from "@/lib/admin/audit";
import { getToday } from "@/lib/dates";
import { db } from "@/lib/db";
import { type Lead, type NotifyChannelStatus, leads } from "@/lib/schema";
import { requireAdminAction, type AuthSession } from "@/lib/session";

/** Верхняя граница выгрузки: защищает память сервера; больше заявок за раз не бывает */
const MAX_EXPORT_ROWS = 20_000;
const SEPARATOR = ";";
const LINE_BREAK = "\r\n";
const BOM = "﻿";
/** Символы, с которых Excel/LibreOffice начинают формулу (CSV/formula injection) */
const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

const HEADER = [
  "Номер",
  "Дата",
  "Тип",
  "Блок",
  "Форма",
  "Имя",
  "Телефон",
  "Окно звонка",
  "Желаемая дата",
  "Желаемое время",
  "Гостей",
  "Сумма",
  "Статус",
  "Комментарий",
  "Страница",
  "Уведомления",
];

/** Значение в кавычках, `"` → `""`; формулы обезвреживаются префиксом `'` */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  // Числа (номер, гости, сумма) формулой не бывают; отрицательные числа не портим
  if (typeof value === "string" && FORMULA_PREFIX_RE.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function channelLabel(name: string, status: NotifyChannelStatus | undefined): string {
  if (!status) return `${name}: —`;
  return `${name}: ${status.ok ? "ok" : "error"}`;
}

function toCsvRow(lead: Lead): string {
  const cells = [
    lead.number,
    formatCsvDate(lead.createdAt),
    LEAD_TYPE_LABELS[lead.type],
    lead.sourceBlock,
    lead.formTitle,
    lead.anonymizedAt ? "обезличено" : lead.name,
    lead.phone,
    lead.callbackWindow ? CALLBACK_WINDOW_LABELS[lead.callbackWindow] : null,
    lead.preferredDate ? formatIsoDate(lead.preferredDate) : null,
    lead.preferredTime,
    lead.guests,
    lead.quoteTotal,
    LEAD_STATUS_LABELS[lead.status],
    lead.comment,
    lead.pageUrl,
    [
      channelLabel("email", lead.notifyStatus.email),
      channelLabel("telegram", lead.notifyStatus.telegram),
    ].join(", "),
  ];
  return cells.map(csvCell).join(SEPARATOR);
}

/** CSV-выгрузка заявок с фильтрами списка (`status`, `type`, `q`, `from`, `to`). */
export async function GET(req: Request): Promise<Response> {
  let session: AuthSession;
  try {
    session = await requireAdminAction();
  } catch {
    // redirect из route handler не делаем — только 401
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await db
    .select()
    .from(leads)
    .where(buildLeadsWhere(params))
    .orderBy(desc(leads.createdAt), desc(leads.number))
    .limit(MAX_EXPORT_ROWS);

  // Разделитель «;», BOM и CRLF — чтобы Excel (ru) открывал файл без мастера импорта
  const csv = [HEADER.map(csvCell).join(SEPARATOR), ...rows.map(toCsvRow)].join(LINE_BREAK);

  // Аудит вне транзакции: выгрузка ничего не меняет. Строку поиска `q` (имя/телефон — ПДн)
  // в журнал не пишем: только факт её наличия.
  await audit(session.user.id, "leads.export", "leads", "csv", {
    count: rows.length,
    params: {
      status: firstParam(params, "status") ?? null,
      type: firstParam(params, "type") ?? null,
      from: firstParam(params, "from") ?? null,
      to: firstParam(params, "to") ?? null,
      hasQuery: Boolean(firstParam(params, "q")?.trim()),
    },
  });

  return new Response(BOM + csv + LINE_BREAK, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${getToday()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
