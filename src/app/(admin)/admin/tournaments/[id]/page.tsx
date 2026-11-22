import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { formatEventDate } from "@/lib/dates";
import { requireStaff } from "@/lib/session";
import { DeleteTournamentButton, TournamentForm } from "../_components/tournament-form";
import { getTournament, listSeriesOptions } from "../_queries";
import type { TournamentInput } from "../_schema";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Турнир" };

export default async function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [found, seriesOptions] = await Promise.all([getTournament(id), listSeriesOptions()]);
  if (!found) notFound();
  const t = found.tournament;

  const defaultValues: TournamentInput = {
    id: t.id,
    title: t.title,
    slug: t.slug,
    seriesId: t.seriesId,
    stageNumber: t.stageNumber,
    discipline: t.discipline,
    level: t.level,
    categories: t.categories,
    startDate: t.startDate,
    endDate: t.endDate,
    entryFee: t.entryFee,
    prizeFund: t.prizeFund,
    description: t.description,
    coverMediaId: t.coverMediaId,
    registrationOpen: t.registrationOpen,
    isPublished: t.isPublished,
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.title}
        description={`${formatEventDate(t.startDate, t.endDate)} ${t.startDate.slice(0, 4)}`}
        backHref="/admin/tournaments"
        breadcrumbs={[
          { label: "Турниры", href: "/admin/tournaments" },
          { label: "Редактирование" },
        ]}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/tournaments/new?from=${t.id}`}>
                <Copy className="h-4 w-4" aria-hidden />
                Дублировать
              </Link>
            </Button>
            <DeleteTournamentButton id={t.id} title={t.title} />
          </>
        }
      />
      {/* key: после сохранения и повторного открытия форма получает свежие значения */}
      <TournamentForm
        key={t.updatedAt.toISOString()}
        defaultValues={defaultValues}
        initialCover={found.cover}
        seriesOptions={seriesOptions}
      />
    </div>
  );
}
