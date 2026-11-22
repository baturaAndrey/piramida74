import { Suspense } from "react";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/session";
import { MenuNav } from "../_components/menu-nav";
import { ModifiersManager } from "../_components/modifiers-manager";
import { flattenCategoryTree, listCategoryTree, listModifiers } from "../_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Добавки" };

export default function ModifiersPage() {
  return (
    <div>
      <PageHeader title="Меню" description="Платные добавки к позициям меню." />
      <MenuNav />
      <Suspense fallback={<AdminPageSkeleton />}>
        <ModifiersContent />
      </Suspense>
    </div>
  );
}

async function ModifiersContent() {
  await requireAdmin();
  const [modifiers, tree] = await Promise.all([listModifiers(), listCategoryTree()]);
  return <ModifiersManager modifiers={modifiers} categories={flattenCategoryTree(tree)} />;
}
