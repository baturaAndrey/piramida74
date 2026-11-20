import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Eye } from "lucide-react";
import { z } from "zod";
import { ArticleView } from "@/components/blog/article-view";
import { ArticleSkeleton } from "@/components/blog/blog-skeletons";
import type { BreadcrumbItem } from "@/components/blog/breadcrumbs";
import { verifyPreviewToken } from "@/lib/content/preview-token";
import type { PageSearchParams } from "@/lib/content/search-params";
import { absoluteUrl } from "@/lib/content/site-url";
import { getArticleForPreview } from "@/lib/queries/blog";
import type { Metadata } from "next";

/**
 * Предпросмотр статьи (в том числе черновика) по подписанной ссылке
 * `/blog/preview/<id>?t=<token>` (24 ч, HMAC, привязка к id). Без валидного
 * токена — 404. Токен нигде не логируется; страница не индексируется,
 * `no-referrer` не даёт ссылке с токеном утечь во внешние сайты.
 */

export const metadata: Metadata = {
  title: "Предпросмотр статьи",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const idSchema = z.uuid();

type PreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
};

export default function BlogPreviewPage({ params, searchParams }: PreviewPageProps) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <PreviewContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PreviewContent({ params, searchParams }: PreviewPageProps) {
  const { id } = await params;
  const { t } = await searchParams;
  await connection();

  const token = typeof t === "string" ? t : undefined;
  if (!idSchema.safeParse(id).success || !verifyPreviewToken(id, token)) notFound();

  const article = await getArticleForPreview(id);
  if (!article) notFound();

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Главная", href: "/" },
    { label: "Блог", href: "/blog" },
    { label: article.title },
  ];

  return (
    <>
      <div
        role="status"
        className="bg-badge text-badge-foreground sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-semibold shadow-sm"
      >
        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
        Предпросмотр. Статья не опубликована
      </div>
      <ArticleView
        article={article}
        breadcrumbs={breadcrumbs}
        shareUrl={absoluteUrl(`/blog/${article.slug}`)}
      />
    </>
  );
}
