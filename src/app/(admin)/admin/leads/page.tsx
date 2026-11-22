import { Suspense } from "react";
import Link from "next/link";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/session";
import { LeadsFilters } from "./_components/leads-filters";
import { LeadsTable } from "./_components/leads-table";
import {
  getLeadsFilterValues,
  LEADS_PAGE_SIZE,
  parseLeadsPage,
  type LeadsSearchParams,
} from "./_lib/filters";
import { buildLeadsQuery, type LeadsFilterValues } from "./_lib/labels";
import { listLeads } from "./_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Заявки" };

type PageProps = { searchParams: Promise<LeadsSearchParams> };

export default function AdminLeadsPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <LeadsContent searchParams={searchParams} />
    </Suspense>
  );
}

function pageHref(values: LeadsFilterValues, page: number): string {
  const qs = buildLeadsQuery(values, page);
  return qs ? `/admin/leads?${qs}` : "/admin/leads";
}

async function LeadsContent({ searchParams }: PageProps) {
  await requireStaff();
  const params = await searchParams;
  const values = getLeadsFilterValues(params);
  const { rows, total, page, pageCount } = await listLeads(params, parseLeadsPage(params));
  const hasFilters = Object.values(values).some((value) => value !== "");

  const firstIndex = total === 0 ? 0 : (page - 1) * LEADS_PAGE_SIZE + 1;
  const lastIndex = (page - 1) * LEADS_PAGE_SIZE + rows.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Заявки" description="Заявки с сайта: звонки, брони, акции, расчёты" />

      <LeadsFilters values={values} />

      <LeadsTable
        rows={rows}
        emptyText={hasFilters ? "По фильтрам ничего не найдено" : "Заявок пока нет"}
      />

      <nav
        className="flex items-center justify-between gap-2 text-sm"
        aria-label="Страницы списка заявок"
      >
        <span className="text-muted-foreground tabular-nums">
          {total === 0 ? "Всего 0" : `${firstIndex}–${lastIndex} из ${total}`}
          {pageCount > 1 ? (
            <span className="hidden sm:inline">
              {" "}
              · страница {page} из {pageCount}
            </span>
          ) : null}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(values, page - 1)} scroll={false}>
                Назад
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Назад
            </Button>
          )}
          {page < pageCount ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(values, page + 1)} scroll={false}>
                Вперёд
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Вперёд
            </Button>
          )}
        </div>
      </nav>
    </div>
  );
}
