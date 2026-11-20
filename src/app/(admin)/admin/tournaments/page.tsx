import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/session";
import { TournamentsTable } from "./_components/tournaments-table";
import { parseWhen } from "./_lib/labels";
import { listTournaments, listTournamentYears } from "./_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Турниры" };

type SearchParams = Record<string, string | string[] | undefined>;

const MAX_QUERY_LENGTH = 100;
const YEAR_RE = /^\d{4}$/;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const when = parseWhen(single(params.when));
  const rawYear = single(params.year);
  // Для «Предстоящих» год не применяется
  const year = when !== "upcoming" && rawYear && YEAR_RE.test(rawYear) ? Number(rawYear) : null;
  const q = (single(params.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  const [rows, years] = await Promise.all([
    listTournaments({ when, year: year ?? undefined, q: q || undefined }),
    listTournamentYears(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Турниры"
        description="Календарь турниров клуба. Изменения сразу появляются на сайте."
      />
      <TournamentsTable rows={rows} years={years} when={when} year={year} q={q} />
    </div>
  );
}
