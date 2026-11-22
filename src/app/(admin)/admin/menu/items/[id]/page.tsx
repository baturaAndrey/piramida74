import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/session";
import { ItemForm } from "../../_components/item-form";
import {
  flattenCategoryTree,
  getMenuItem,
  listCategoryTree,
  listPriceGroups,
} from "../../_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Позиция меню" };

type Params = Promise<{ id: string }>;

export default function EditMenuItemPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <EditItemContent params={params} />
    </Suspense>
  );
}

async function EditItemContent({ params }: { params: Params }) {
  await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [item, tree, priceGroups] = await Promise.all([
    getMenuItem(id),
    listCategoryTree(),
    listPriceGroups(),
  ]);
  if (!item) notFound();
  const categories = flattenCategoryTree(tree);
  const backHref = `/admin/menu?cat=${item.categoryId}`;

  return (
    <div>
      <PageHeader
        title={item.name}
        backHref={backHref}
        breadcrumbs={[{ label: "Меню", href: backHref }, { label: item.name }]}
      />
      {/* key по данным с сервера: после сохранения форма пересоздаётся с актуальными
          вариантами и их id, даже если маршрут был сохранён в <Activity> */}
      <ItemForm
        key={JSON.stringify(item)}
        item={item}
        defaultCategoryId={item.categoryId}
        categories={categories}
        priceGroups={priceGroups}
      />
    </div>
  );
}
