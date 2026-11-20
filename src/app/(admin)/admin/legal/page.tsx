import { Suspense } from "react";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/session";
import { LegalVersions } from "./_components/legal-versions";
import { getLegalVersions } from "./_queries";
import { LEGAL_DOC_TYPES } from "./_schema";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Юр. документы" };

async function LegalContent() {
  await requireAdmin();
  const versions = await getLegalVersions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Юридические документы"
        description="Версии политики и согласия на обработку персональных данных. Опубликованные версии неизменяемы — на них ссылаются согласия в заявках."
      />
      {LEGAL_DOC_TYPES.map((type) => (
        <LegalVersions key={type} type={type} versions={versions[type]} />
      ))}
    </div>
  );
}

export default function AdminLegalPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <LegalContent />
    </Suspense>
  );
}
