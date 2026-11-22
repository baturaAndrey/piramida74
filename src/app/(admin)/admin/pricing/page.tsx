import { Suspense } from "react";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/session";
import { PricingTabs } from "./_components/pricing-tabs";
import { DEFAULT_PRICING_TAB, isPricingTab } from "./_lib/labels";
import { getPricingAdminData } from "./_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Цены" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AdminPricingPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Цены"
        description="Залы, тарифы аренды, дополнительные услуги и штрафы. Изменения сразу видны на сайте и в калькуляторе."
      />
      <Suspense fallback={<AdminPageSkeleton />}>
        <PricingContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PricingContent({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff();
  const [params, data] = await Promise.all([searchParams, getPricingAdminData()]);
  const tab = isPricingTab(params.tab) ? params.tab : DEFAULT_PRICING_TAB;
  return <PricingTabs initialTab={tab} data={data} />;
}
