import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { LegalDocument, LegalDocumentSkeleton } from "@/components/legal/legal-document";
import { getCurrentLegalDocument } from "@/lib/queries/legal";
import { buildMetadata } from "@/lib/seo/metadata";

const TITLE = "Политика обработки персональных данных";

export const metadata = buildMetadata({
  title: TITLE,
  description: "Как клуб «Пирамида» обрабатывает и защищает персональные данные посетителей сайта.",
  path: "/politika",
});

export default function PolitikaPage() {
  return (
    <Suspense fallback={<LegalDocumentSkeleton />}>
      <PolitikaContent />
    </Suspense>
  );
}

async function PolitikaContent() {
  await connection();
  const doc = await getCurrentLegalDocument("policy");
  if (!doc) notFound();
  // doc.text уже содержит подставленные реквизиты (getCurrentLegalDocument) — выводится как есть.
  return (
    <LegalDocument
      title={doc.title || TITLE}
      version={doc.version}
      publishedAt={doc.publishedAt}
      markdown={doc.text}
    />
  );
}
