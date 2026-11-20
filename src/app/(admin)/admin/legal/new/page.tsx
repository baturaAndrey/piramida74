import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getClientEnv } from "@/lib/env";
import { getSettings } from "@/lib/queries/settings";
import { requireAdmin } from "@/lib/session";
import { LegalForm } from "../_components/legal-form";
import { getCurrentLegalSource } from "../_queries";
import { LEGAL_DEFAULT_TITLES, LEGAL_TYPE_LABELS, legalTypeSchema } from "../_schema";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Новая версия документа" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function NewLegalContent({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const parsedType = legalTypeSchema.safeParse((await searchParams).type);
  if (!parsedType.success) redirect("/admin/legal");
  const type = parsedType.data;

  const [settings, current] = await Promise.all([getSettings(), getCurrentLegalSource(type)]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Новая версия"
        description={
          current
            ? `${LEGAL_TYPE_LABELS[type]}. Текст заполнен из текущей версии — измените его и сохраните черновик.`
            : LEGAL_TYPE_LABELS[type]
        }
        backHref="/admin/legal"
        breadcrumbs={[
          { label: "Юр. документы", href: "/admin/legal" },
          { label: LEGAL_TYPE_LABELS[type] },
          { label: "Новая версия" },
        ]}
      />
      <Card>
        <CardContent className="p-4 sm:p-6">
          <LegalForm
            type={type}
            defaultValues={{
              title: current?.title.trim() || LEGAL_DEFAULT_TITLES[type],
              body: current?.body ?? "",
            }}
            settings={{
              operator: settings.operator,
              phone: settings.phone,
              leadRetentionMonths: settings.leadRetentionMonths,
            }}
            siteUrl={getClientEnv().NEXT_PUBLIC_SITE_URL}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewLegalDocumentPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <NewLegalContent searchParams={searchParams} />
    </Suspense>
  );
}
