import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { z } from "zod";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TZ } from "@/lib/dates";
import { getClientEnv } from "@/lib/env";
import { getSettings } from "@/lib/queries/settings";
import { requireStaff } from "@/lib/session";
import { LegalForm, LegalMarkdown } from "../_components/legal-form";
import { getLegalDocumentById } from "../_queries";
import {
  fillLegalPlaceholders,
  LEGAL_TYPE_LABELS,
  legalPlaceholderValues,
  type LegalPreviewSettings,
} from "../_schema";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Версия документа" };

type Params = Promise<{ id: string }>;

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  dateStyle: "medium",
  timeStyle: "short",
});

async function LegalDocumentContent({ params }: { params: Params }) {
  await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [doc, settings] = await Promise.all([getLegalDocumentById(id), getSettings()]);
  if (!doc) notFound();

  const previewSettings: LegalPreviewSettings = {
    operator: settings.operator,
    phone: settings.phone,
    leadRetentionMonths: settings.leadRetentionMonths,
  };
  const siteUrl = getClientEnv().NEXT_PUBLIC_SITE_URL;
  const typeLabel = LEGAL_TYPE_LABELS[doc.type];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`Версия ${doc.version}`}
        // description рендерится внутри <p>: только текст, без блочных Badge
        description={
          doc.publishedAt
            ? `${typeLabel} · опубликована ${dateTimeFormat.format(doc.publishedAt)}`
            : `${typeLabel} · черновик`
        }
        backHref="/admin/legal"
        breadcrumbs={[
          { label: "Юр. документы", href: "/admin/legal" },
          { label: typeLabel },
          { label: doc.version },
        ]}
      />

      {doc.publishedAt ? (
        <div className="space-y-4">
          <div
            role="status"
            className="bg-muted text-muted-foreground flex items-start gap-2 rounded-lg border p-4 text-sm"
          >
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Опубликованная версия неизменяема: на неё ссылаются согласия в заявках. Чтобы изменить
              текст, создайте новую версию. SHA-256:{" "}
              <code className="font-mono text-xs break-all">{doc.sha256}</code>
            </p>
          </div>
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <h2 className="text-lg font-semibold">{doc.title}</h2>
              <Tabs defaultValue="document">
                <TabsList>
                  <TabsTrigger value="document">Документ</TabsTrigger>
                  <TabsTrigger value="source">Исходный текст</TabsTrigger>
                </TabsList>
                <TabsContent value="document">
                  <p className="text-muted-foreground mb-4 text-xs">
                    Плейсхолдеры подставлены из текущих «Настроек».
                  </p>
                  <LegalMarkdown
                    markdown={fillLegalPlaceholders(
                      doc.body,
                      legalPlaceholderValues(previewSettings, siteUrl)
                    )}
                  />
                </TabsContent>
                <TabsContent value="source">
                  <pre className="bg-muted max-h-[70vh] overflow-auto rounded-md p-4 font-mono text-xs leading-5 break-words whitespace-pre-wrap">
                    {doc.body}
                  </pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <LegalForm
              id={doc.id}
              type={doc.type}
              defaultValues={{ title: doc.title, body: doc.body }}
              settings={previewSettings}
              siteUrl={siteUrl}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function LegalDocumentPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <LegalDocumentContent params={params} />
    </Suspense>
  );
}
