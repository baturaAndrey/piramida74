import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Send, ShieldOff } from "lucide-react";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NotifyChannelStatus } from "@/lib/schema";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { LeadStatusSelect } from "../_components/lead-status-select";
import { QuoteSnapshotView } from "../_components/quote-snapshot-view";
import { ResendNotificationButton } from "../_components/resend-notification-button";
import {
  CALLBACK_WINDOW_LABELS,
  formatIsoDate,
  fullDateTimeFormat,
  isNotifySkipped,
  LEAD_STATUS_BADGE_CLASSES,
  LEAD_STATUS_LABELS,
  LEAD_TYPE_LABELS,
} from "../_lib/labels";
import { getLead, type LeadDetail } from "../_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Заявка" };

type PageProps = { params: Promise<{ id: string }> };

export default function AdminLeadPage({ params }: PageProps) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <LeadContent params={params} />
    </Suspense>
  );
}

/** Строка «подпись — значение»; пустые значения не выводятся */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

function ContactsCard({ lead }: { lead: LeadDetail }) {
  const preferred = [
    lead.preferredDate ? formatIsoDate(lead.preferredDate) : null,
    lead.preferredTime,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Контакты и запрос</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {lead.anonymizedAt ? (
          <div
            role="status"
            className="bg-muted text-muted-foreground flex items-start gap-3 rounded-lg border p-4 text-sm"
          >
            <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Персональные данные удалены {fullDateTimeFormat.format(lead.anonymizedAt)} по сроку
              хранения
            </p>
          </div>
        ) : null}

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Имя">
            {lead.name || <span className="text-muted-foreground">не указано</span>}
          </Field>
          <Field label="Телефон">
            {lead.phone ? (
              <a
                href={`tel:${lead.phone}`}
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                {lead.phone}
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Field>
          {lead.callbackWindow ? (
            <Field label="Когда перезвонить">{CALLBACK_WINDOW_LABELS[lead.callbackWindow]}</Field>
          ) : null}
          {preferred ? <Field label="Желаемые дата и время">{preferred}</Field> : null}
          {lead.guests !== null ? <Field label="Гостей">{lead.guests}</Field> : null}
          {lead.promotionId ? (
            <Field label="Акция">
              <Link
                href={`/admin/promotions/${lead.promotionId}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {lead.promotionTitle ?? "Открыть акцию"}
              </Link>
            </Field>
          ) : null}
          {lead.tournamentId ? (
            <Field label="Турнир">
              <Link
                href={`/admin/tournaments/${lead.tournamentId}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {lead.tournamentTitle ?? "Открыть турнир"}
              </Link>
            </Field>
          ) : null}
        </dl>

        {lead.comment ? (
          <Field label="Комментарий">
            <span className="whitespace-pre-wrap">{lead.comment}</span>
          </Field>
        ) : null}

        <dl className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
          <Field label="Форма">{lead.formTitle}</Field>
          <Field label="Блок">{lead.sourceBlock}</Field>
          {lead.pageUrl ? (
            <Field label="Страница">
              <a
                href={lead.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary break-all underline-offset-4 hover:underline"
              >
                {lead.pageUrl}
              </a>
            </Field>
          ) : null}
          <Field label="Согласие на обработку ПДн">
            {fullDateTimeFormat.format(lead.consentAt)}
            {lead.consentDocument ? (
              <>
                {", "}
                <Link
                  href={`/admin/legal/${lead.consentDocument.id}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  версия {lead.consentDocument.version}
                </Link>
              </>
            ) : null}
          </Field>
        </dl>

        {lead.userAgent ? (
          <p className="text-muted-foreground text-xs break-all">{lead.userAgent}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ChannelStatus({
  icon,
  label,
  status,
}: {
  icon: ReactNode;
  label: string;
  status: NotifyChannelStatus | undefined;
}) {
  const skipped = isNotifySkipped(status);
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 shrink-0",
          (!status || skipped) && "text-muted-foreground",
          status?.ok && "text-green-600 dark:text-green-400",
          status && !status.ok && !skipped && "text-red-600 dark:text-red-400"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 space-y-0.5 text-sm">
        <p className="font-medium">
          {label}:{" "}
          {!status ? (
            <span className="text-muted-foreground font-normal">не отправлялось</span>
          ) : status.ok ? (
            <span className="text-green-600 dark:text-green-400">отправлено</span>
          ) : skipped ? (
            <span className="text-muted-foreground font-normal">пропущено (не настроено)</span>
          ) : (
            <span className="text-red-600 dark:text-red-400">ошибка</span>
          )}
        </p>
        {status && !status.ok && !skipped && status.error ? (
          <p className="text-muted-foreground font-mono text-xs break-words">{status.error}</p>
        ) : null}
        {status ? (
          <p className="text-muted-foreground text-xs">
            {fullDateTimeFormat.format(new Date(status.at))}
          </p>
        ) : null}
      </div>
    </li>
  );
}

async function LeadContent({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Заявка #${lead.number}`}
        backHref="/admin/leads"
        breadcrumbs={[{ label: "Заявки", href: "/admin/leads" }, { label: `#${lead.number}` }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <time dateTime={lead.createdAt.toISOString()}>
              {fullDateTimeFormat.format(lead.createdAt)}
            </time>
            {/* span, а не <Badge> (div): описание PageHeader рендерится внутри <p> */}
            <span className={badgeVariants({ variant: "secondary" })}>
              {LEAD_TYPE_LABELS[lead.type]}
            </span>
            <span
              className={cn(
                badgeVariants({ variant: "outline" }),
                LEAD_STATUS_BADGE_CLASSES[lead.status]
              )}
            >
              {LEAD_STATUS_LABELS[lead.status]}
            </span>
          </span>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/leads">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Назад к списку
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ContactsCard lead={lead} />

          {lead.snapshot ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Расчёт</CardTitle>
                <CardDescription>Снимок расчёта калькулятора на момент заявки</CardDescription>
              </CardHeader>
              <CardContent>
                <QuoteSnapshotView snapshot={lead.snapshot} hallName={lead.hallName} />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Обработка</CardTitle>
            </CardHeader>
            <CardContent>
              {/* key: после router.refresh() селект берёт новое серверное значение */}
              <LeadStatusSelect key={lead.status} id={lead.id} status={lead.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Уведомления</CardTitle>
              <CardDescription>Email и Telegram администратору</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                <ChannelStatus
                  icon={<Mail className="h-4 w-4" aria-hidden />}
                  label="Email"
                  status={lead.notifyStatus.email}
                />
                <ChannelStatus
                  icon={<Send className="h-4 w-4" aria-hidden />}
                  label="Telegram"
                  status={lead.notifyStatus.telegram}
                />
              </ul>
              <ResendNotificationButton id={lead.id} anonymized={lead.anonymizedAt !== null} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
