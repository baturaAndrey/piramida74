import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/session";
import { listSeriesWithCounts } from "../_queries";
import { SeriesManager } from "./_components/series-manager";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Серии турниров" };

export default async function TournamentSeriesPage() {
  await requireAdmin();
  const series = await listSeriesWithCounts();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Серии турниров"
        description="Серии объединяют этапы одного цикла. Порядок меняется перетаскиванием."
        backHref="/admin/tournaments"
        breadcrumbs={[{ label: "Турниры", href: "/admin/tournaments" }, { label: "Серии" }]}
      />
      <SeriesManager series={series} />
    </div>
  );
}
