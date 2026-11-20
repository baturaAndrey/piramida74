import { Suspense } from "react";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/session";
import { BulkPriceForm } from "../_components/bulk-price-form";
import { MenuNav } from "../_components/menu-nav";
import { flattenCategoryTree, listCategoryTree } from "../_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Массовое изменение цен" };

export default function BulkPricePage() {
  return (
    <div>
      <PageHeader
        title="Меню"
        description="Массовое изменение цен: сначала предпросмотр, затем применение."
      />
      <MenuNav />
      <Suspense fallback={<AdminPageSkeleton />}>
        <BulkPriceContent />
      </Suspense>
    </div>
  );
}

async function BulkPriceContent() {
  await requireAdmin();
  const tree = await listCategoryTree();
  return <BulkPriceForm categories={flattenCategoryTree(tree)} />;
}
