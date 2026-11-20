import Link from "next/link";
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import { Banknote, ExternalLink, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEventDate, getOpDate, TZ } from "@/lib/dates";
import { db } from "@/lib/db";
import { LEAD_TYPE_LABELS } from "@/lib/notify/lead-templates";
import { leads, tournaments } from "@/lib/schema";
import { requireAdmin } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Сводка" };

const RECENT_LEADS_LIMIT = 10;
const UPCOMING_TOURNAMENTS_LIMIT = 5;

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  dateStyle: "short",
  timeStyle: "short",
});

async function getDashboardData() {
  const opDate = getOpDate();
  const [newLeadsCount, recentLeads, upcomingTournaments] = await Promise.all([
    db.select({ value: count() }).from(leads).where(eq(leads.status, "new")),
    db
      .select({
        id: leads.id,
        number: leads.number,
        type: leads.type,
        name: leads.name,
        phone: leads.phone,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(eq(leads.status, "new"))
      .orderBy(desc(leads.createdAt))
      .limit(RECENT_LEADS_LIMIT),
    db
      .select({
        id: tournaments.id,
        title: tournaments.title,
        startDate: tournaments.startDate,
        endDate: tournaments.endDate,
      })
      .from(tournaments)
      .where(and(eq(tournaments.isPublished, true), gte(tournaments.endDate, opDate)))
      .orderBy(asc(tournaments.startDate), asc(tournaments.title))
      .limit(UPCOMING_TOURNAMENTS_LIMIT),
  ]);
  return {
    newLeadsTotal: newLeadsCount[0]?.value ?? 0,
    recentLeads,
    upcomingTournaments,
  };
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const { newLeadsTotal, recentLeads, upcomingTournaments } = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Сводка"
        description="Новые заявки и ближайшие турниры"
        actions={
          <>
            <Button asChild size="sm">
              <Link href="/admin/tournaments/new">
                <Plus className="h-4 w-4" aria-hidden />
                Добавить турнир
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/pricing">
                <Banknote className="h-4 w-4" aria-hidden />
                Редактировать цены
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden />
                Открыть сайт
              </a>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Новые заявки
              <Badge variant={newLeadsTotal > 0 ? "default" : "secondary"} className="tabular-nums">
                {newLeadsTotal}
              </Badge>
            </CardTitle>
            <CardDescription>Последние {RECENT_LEADS_LIMIT} необработанных заявок</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <p className="text-muted-foreground text-sm">Новых заявок нет</p>
            ) : (
              <ul className="divide-y">
                {recentLeads.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="hover:bg-accent focus-visible:ring-ring/50 -mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-2 transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium">
                          #{lead.number} · {LEAD_TYPE_LABELS[lead.type]}
                        </p>
                        <p className="text-muted-foreground truncate text-sm">
                          {[lead.name, lead.phone].filter(Boolean).join(", ") || "Без контактов"}
                        </p>
                      </div>
                      <time
                        dateTime={lead.createdAt.toISOString()}
                        className="text-muted-foreground shrink-0 text-xs tabular-nums"
                      >
                        {dateTimeFormat.format(lead.createdAt)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {newLeadsTotal > 0 ? (
              <Button asChild variant="link" className="mt-2 px-0">
                <Link href="/admin/leads">Все заявки</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ближайшие турниры</CardTitle>
            <CardDescription>Опубликованные, ещё не завершившиеся</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingTournaments.length === 0 ? (
              <p className="text-muted-foreground text-sm">Предстоящих турниров нет</p>
            ) : (
              <ul className="divide-y">
                {upcomingTournaments.map((tournament) => (
                  <li key={tournament.id}>
                    <Link
                      href={`/admin/tournaments/${tournament.id}`}
                      className="hover:bg-accent focus-visible:ring-ring/50 -mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-2 transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
                    >
                      <span className="min-w-0 text-sm font-medium">{tournament.title}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {formatEventDate(tournament.startDate, tournament.endDate)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="link" className="mt-2 px-0">
              <Link href="/admin/tournaments">Все турниры</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
