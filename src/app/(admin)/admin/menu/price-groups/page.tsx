import { Suspense } from "react";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/session";
import { MenuNav } from "../_components/menu-nav";
import { PriceGroupsManager } from "../_components/price-groups-manager";
import { listPriceGroups } from "../_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Сетки цен" };

export default function PriceGroupsPage() {
  return (
    <div>
      <PageHeader
        title="Меню"
        description="Общие сетки цен для чаёв, лимонадов и других разделов."
      />
      <MenuNav />
      <Suspense fallback={<AdminPageSkeleton />}>
        <PriceGroupsContent />
      </Suspense>
    </div>
  );
}

async function PriceGroupsContent() {
  await requireStaff();
  const groups = await listPriceGroups();
  return <PriceGroupsManager groups={groups} />;
}
