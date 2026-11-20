import { Suspense } from "react";
import { z } from "zod";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/session";
import { CategoryTree } from "./_components/category-tree";
import { ItemsList } from "./_components/items-list";
import { MenuNav } from "./_components/menu-nav";
import {
  flattenCategoryTree,
  listCategoryItems,
  listCategoryTree,
  listPriceGroups,
} from "./_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Меню" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AdminMenuPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div>
      <PageHeader
        title="Меню"
        description="Категории, позиции и цены бара и кухни. Изменения сразу видны на /menu и в калькуляторе."
      />
      <MenuNav />
      <Suspense fallback={<AdminPageSkeleton />}>
        <MenuContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function MenuContent({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const rawCat = typeof params.cat === "string" ? params.cat : undefined;
  const requestedId = z.uuid().safeParse(rawCat).success ? rawCat : undefined;

  const [tree, priceGroups] = await Promise.all([listCategoryTree(), listPriceGroups()]);
  const options = flattenCategoryTree(tree);
  const selected = options.find((option) => option.id === requestedId) ?? options[0] ?? null;
  const items = selected ? await listCategoryItems(selected.id) : [];

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <aside className="order-last md:order-first md:w-80 md:shrink-0">
        <CategoryTree
          tree={tree}
          selectedId={selected?.id ?? null}
          priceGroups={priceGroups.map((group) => ({ id: group.id, name: group.name }))}
        />
      </aside>
      <section className="min-w-0 flex-1" aria-label="Позиции категории">
        {selected ? (
          <ItemsList
            key={selected.id}
            category={{
              id: selected.id,
              title: selected.title,
              priceGroupName: selected.priceGroupName,
            }}
            items={items}
            categoryOptions={options}
          />
        ) : (
          <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            Создайте первую категорию, чтобы добавлять позиции
          </div>
        )}
      </section>
    </div>
  );
}
