import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/admin/page-header";
import type { MediaDto } from "@/lib/admin/media-dto";
import { requireAdmin } from "@/lib/session";
import { TournamentForm } from "../_components/tournament-form";
import { nextStageTitle } from "../_lib/labels";
import { getTournament, listSeriesOptions } from "../_queries";
import type { TournamentInput } from "../_schema";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Новый турнир" };

type SearchParams = Record<string, string | string[] | undefined>;

const EMPTY_TOURNAMENT: TournamentInput = {
  title: "",
  slug: "",
  seriesId: null,
  stageNumber: null,
  discipline: null,
  level: "club",
  categories: [],
  startDate: "",
  endDate: "",
  entryFee: null,
  prizeFund: null,
  description: null,
  coverMediaId: null,
  registrationOpen: false,
  isPublished: true,
};

const MAX_STAGE_NUMBER = 99;

export default async function NewTournamentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { from } = await searchParams;
  const fromId = typeof from === "string" ? from : undefined;
  if (fromId && !z.uuid().safeParse(fromId).success) notFound();

  const [source, seriesOptions] = await Promise.all([
    fromId ? getTournament(fromId) : Promise.resolve(null),
    listSeriesOptions(),
  ]);
  if (fromId && !source) notFound();

  let defaultValues = EMPTY_TOURNAMENT;
  let initialCover: MediaDto | null = null;
  if (source) {
    const t = source.tournament;
    // Дубль: следующий тур, даты пустые (без них форма не сохранится), снят с публикации
    defaultValues = {
      ...EMPTY_TOURNAMENT,
      title: nextStageTitle(t.title),
      seriesId: t.seriesId,
      stageNumber: t.stageNumber ? Math.min(t.stageNumber + 1, MAX_STAGE_NUMBER) : null,
      discipline: t.discipline,
      level: t.level,
      categories: t.categories,
      entryFee: t.entryFee,
      prizeFund: t.prizeFund,
      description: t.description,
      coverMediaId: t.coverMediaId,
      registrationOpen: false,
      isPublished: false,
    };
    initialCover = source.cover;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={source ? "Дублирование турнира" : "Новый турнир"}
        backHref="/admin/tournaments"
        breadcrumbs={[
          { label: "Турниры", href: "/admin/tournaments" },
          { label: source ? "Дублирование" : "Новый турнир" },
        ]}
      />
      {/* key: «Новый» и «Дублировать» — разные экземпляры формы (состояние страниц сохраняется) */}
      <TournamentForm
        key={fromId ?? "new"}
        defaultValues={defaultValues}
        initialCover={initialCover}
        seriesOptions={seriesOptions}
        duplicateOf={source?.tournament.title}
      />
    </div>
  );
}
