import { Suspense } from "react";
import { z } from "zod";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/session";
import { ItemForm } from "../../_components/item-form";
import { flattenCategoryTree, listCategoryTree, listPriceGroups } from "../../_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Новая позиция меню" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function NewMenuItemPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <NewItemContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewItemContent({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff();
  const params = await searchParams;
  const rawCat = typeof params.cat === "string" ? params.cat : undefined;
  const categoryId = rawCat && z.uuid().safeParse(rawCat).success ? rawCat : null;

  const [tree, priceGroups] = await Promise.all([listCategoryTree(), listPriceGroups()]);
  const categories = flattenCategoryTree(tree);
  const backHref = categoryId ? `/admin/menu?cat=${categoryId}` : "/admin/menu";

  return (
    <div>
      <PageHeader
        title="Новая позиция"
        backHref={backHref}
        breadcrumbs={[{ label: "Меню", href: backHref }, { label: "Новая позиция" }]}
      />
      {categories.length === 0 ? (
        <p className="text-muted-foreground text-sm">Сначала создайте категорию меню.</p>
      ) : (
        <ItemForm
          key={categoryId ?? "default"}
          item={null}
          defaultCategoryId={categoryId}
          categories={categories}
          priceGroups={priceGroups}
        />
      )}
    </div>
  );
}
