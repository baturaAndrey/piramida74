import Link from "next/link";
import { Plus } from "lucide-react";
import { ArticlesTable } from "@/components/admin/blog/articles-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { ARTICLES_PAGE_SIZE, listArticles, parseArticleFilter } from "@/lib/blog-admin/queries";
import { requireStaff } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Статьи" };

type SearchParams = Record<string, string | string[] | undefined>;

const MAX_QUERY_LENGTH = 100;
const MAX_PAGE = 10_000;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_PAGE ? n : 1;
}

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireStaff();
  const params = await searchParams;
  const filter = parseArticleFilter(single(params.status));
  const q = (single(params.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const page = parsePage(single(params.page));

  const { rows, total } = await listArticles({ filter, q: q || undefined, page, now: new Date() });
  const pageCount = Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Статьи"
        description="Блог клуба. Время публикации — по Екатеринбургу (UTC+5)."
        actions={
          <Button asChild>
            <Link href="/admin/blog/articles/new">
              <Plus className="h-4 w-4" aria-hidden />
              Новая статья
            </Link>
          </Button>
        }
      />
      <ArticlesTable
        rows={rows}
        filter={filter}
        q={q}
        page={page}
        pageCount={pageCount}
        total={total}
      />
    </div>
  );
}
