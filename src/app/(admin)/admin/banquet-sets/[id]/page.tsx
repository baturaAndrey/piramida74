import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/session";
import { SetForm } from "../_components/set-form";
import { getSet, listVariantOptions } from "../_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Банкетный сет" };

type Params = Promise<{ id: string }>;

export default function EditBanquetSetPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <EditSetContent params={params} />
    </Suspense>
  );
}

async function EditSetContent({ params }: { params: Params }) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [set, variantOptions] = await Promise.all([getSet(id), listVariantOptions()]);
  if (!set) notFound();

  return (
    <div>
      <PageHeader
        title={set.title}
        backHref="/admin/banquet-sets"
        breadcrumbs={[
          { label: "Банкетные сеты", href: "/admin/banquet-sets" },
          { label: set.title },
        ]}
      />
      {/* key по данным с сервера: после сохранения форма пересоздаётся с актуальным составом */}
      <SetForm key={JSON.stringify(set)} set={set} variantOptions={variantOptions} />
    </div>
  );
}
