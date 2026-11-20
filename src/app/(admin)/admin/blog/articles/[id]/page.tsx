import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { z } from "zod";
import { ArticleForm } from "@/components/admin/blog/article-form";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import {
  effectiveStatus,
  formatAdminDateTime,
  getArticleForEdit,
  listAuthorOptions,
  listRubricOptions,
  listTagOptions,
} from "@/lib/blog-admin/queries";
import { toLocalInputValue } from "@/lib/content/local-datetime";
import { requireAdmin } from "@/lib/session";
import type { ArticleInput } from "@/lib/validation/blog";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Статья" };

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [found, rubrics, authors, tags] = await Promise.all([
    getArticleForEdit(id),
    listRubricOptions(),
    listAuthorOptions(),
    listTagOptions(),
  ]);
  if (!found) notFound();
  const a = found.article;
  const status = effectiveStatus(a, new Date());
  const isLive = status === "published" || status === "published_scheduled";

  const defaultValues: ArticleInput = {
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    body: a.body,
    coverMediaId: a.coverMediaId,
    authorId: a.authorId,
    rubricId: a.rubricId,
    tagIds: found.tagIds,
    isFeatured: a.isFeatured,
    showToc: a.showToc,
    // Наступившая отложенная публикация уже на сайте — в форме это «Опубликована»
    status: status === "published_scheduled" ? "published" : a.status,
    publishAt: a.publishedAt ? toLocalInputValue(a.publishedAt) : "",
    seoTitle: a.seoTitle ?? "",
    seoDescription: a.seoDescription ?? "",
    noindex: a.noindex,
  };

  const description =
    status === "scheduled" && a.publishedAt
      ? `Запланирована на ${formatAdminDateTime(a.publishedAt)}`
      : isLive && a.publishedAt
        ? `Опубликована ${formatAdminDateTime(a.publishedAt)}`
        : "Черновик";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={a.title}
        description={description}
        backHref="/admin/blog/articles"
        breadcrumbs={[
          { label: "Статьи", href: "/admin/blog/articles" },
          { label: "Редактирование" },
        ]}
        {...(isLive
          ? {
              actions: (
                <Button asChild variant="outline" size="sm">
                  <a href={`/blog/${a.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Открыть на сайте
                  </a>
                </Button>
              ),
            }
          : {})}
      />
      {/* key: после сохранения форма получает свежие значения с сервера */}
      <ArticleForm
        key={a.updatedAt.toISOString()}
        defaultValues={defaultValues}
        initialCover={found.cover}
        rubrics={rubrics}
        authors={authors}
        tags={tags}
        isLive={isLive}
      />
    </div>
  );
}
