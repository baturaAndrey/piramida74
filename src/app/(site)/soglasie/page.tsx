import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { LegalDocument, LegalDocumentSkeleton } from "@/components/legal/legal-document";
import { getCurrentLegalDocument } from "@/lib/queries/legal";
import { buildMetadata } from "@/lib/seo/metadata";

const TITLE = "Согласие на обработку персональных данных";

export const metadata = buildMetadata({
  title: TITLE,
  description:
    "Согласие посетителя сайта клуба «Пирамида» на обработку персональных данных при отправке заявки.",
  path: "/soglasie",
});

export default function SoglasiePage() {
  return (
    <Suspense fallback={<LegalDocumentSkeleton />}>
      <SoglasieContent />
    </Suspense>
  );
}

async function SoglasieContent() {
  await connection();
  const doc = await getCurrentLegalDocument("consent");
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
