import { Suspense } from "react";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/session";
import { SetForm } from "../_components/set-form";
import { listVariantOptions } from "../_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Новый банкетный сет" };

export default function NewBanquetSetPage() {
  return (
    <div>
      <PageHeader
        title="Новый сет"
        backHref="/admin/banquet-sets"
        breadcrumbs={[
          { label: "Банкетные сеты", href: "/admin/banquet-sets" },
          { label: "Новый сет" },
        ]}
      />
      <Suspense fallback={<AdminPageSkeleton />}>
        <NewSetContent />
      </Suspense>
    </div>
  );
}

async function NewSetContent() {
  await requireAdmin();
  const variantOptions = await listVariantOptions();
  return <SetForm set={null} variantOptions={variantOptions} />;
}
