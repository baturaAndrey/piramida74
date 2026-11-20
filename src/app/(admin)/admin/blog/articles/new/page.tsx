import { ArticleForm } from "@/components/admin/blog/article-form";
import { PageHeader } from "@/components/admin/page-header";
import { listAuthorOptions, listRubricOptions, listTagOptions } from "@/lib/blog-admin/queries";
import { requireAdmin } from "@/lib/session";
import type { ArticleInput } from "@/lib/validation/blog";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Новая статья" };

const EMPTY_ARTICLE: ArticleInput = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  coverMediaId: null,
  authorId: null,
  rubricId: null,
  tagIds: [],
  isFeatured: false,
  showToc: true,
  status: "draft",
  publishAt: "",
  seoTitle: "",
  seoDescription: "",
  noindex: false,
};

export default async function NewArticlePage() {
  await requireAdmin();
  const [rubrics, authors, tags] = await Promise.all([
    listRubricOptions(),
    listAuthorOptions(),
    listTagOptions(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Новая статья"
        backHref="/admin/blog/articles"
        breadcrumbs={[{ label: "Статьи", href: "/admin/blog/articles" }, { label: "Новая статья" }]}
      />
      <ArticleForm
        defaultValues={EMPTY_ARTICLE}
        initialCover={null}
        rubrics={rubrics}
        authors={authors}
        tags={tags}
      />
    </div>
  );
}
