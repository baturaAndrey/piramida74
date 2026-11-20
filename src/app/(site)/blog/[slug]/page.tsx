import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { Newspaper } from "lucide-react";
import { ArticleCard } from "@/components/blog/article-card";
import { ArticleView } from "@/components/blog/article-view";
import { ArticleSkeleton } from "@/components/blog/blog-skeletons";
import { breadcrumbLd, Breadcrumbs, type BreadcrumbItem } from "@/components/blog/breadcrumbs";
import { LoadMore, pageHref } from "@/components/blog/load-more";
import { Container } from "@/components/site/container";
import { SectionTitle } from "@/components/site/section-title";
import { roundedNowIso } from "@/lib/content/blog-now";
import { stripMarkdown, truncateText } from "@/lib/content/markdown";
import { parsePageParam, type PageSearchParams } from "@/lib/content/search-params";
import { absoluteUrl } from "@/lib/content/site-url";
import { mediaUrl } from "@/lib/media/url";
import {
  findRedirect,
  getArticleBySlug,
  getPublishedArticles,
  getRecentArticles,
  getRelatedArticles,
  getRubricBySlug,
  type ArticleDetailView,
  type RubricView,
} from "@/lib/queries/blog";
import { articleJsonLd, jsonLdScript, type ArticleJsonLdInput } from "@/lib/seo/jsonld";
import type { Metadata } from "next";

/**
 * `/blog/<slug>` — статья **или** рубрика (статья важнее). Нет ни той, ни другой —
 * 301/308 по таблице `redirects`, иначе 404. Всё чтение — после `connection()`
 * внутри `<Suspense>`; `generateStaticParams` намеренно нет (сборка без БД).
 */

const CLUB_NAME = "Бильярдный клуб «Пирамида»";
const DESCRIPTION_LENGTH = 160;
/** Ширина варианта обложки для JSON-LD */
const JSONLD_IMAGE_WIDTH = 1280;

type SlugPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PageSearchParams>;
};

function articleDescription(article: ArticleDetailView): string {
  return (
    article.seoDescription ??
    article.excerpt ??
    truncateText(stripMarkdown(article.body), DESCRIPTION_LENGTH)
  );
}

export async function generateMetadata({ params, searchParams }: SlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  await connection();
  const now = roundedNowIso();

  const article = await getArticleBySlug(slug, now);
  if (article) {
    const title = article.seoTitle ?? article.title;
    const description = articleDescription(article);
    const canonical = `/blog/${article.slug}`;
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: "article",
        title,
        description,
        url: canonical,
        ...(article.publishedAt ? { publishedTime: article.publishedAt } : {}),
        modifiedTime: article.updatedAt,
        ...(article.author ? { authors: [absoluteUrl(`/authors/${article.author.slug}`)] } : {}),
        ...(article.rubric ? { section: article.rubric.name } : {}),
        tags: article.tags.map((t) => t.name),
      },
      ...(article.noindex ? { robots: { index: false, follow: true } } : {}),
    };
  }

  const rubric = await getRubricBySlug(slug);
  if (rubric) {
    const page = parsePageParam(sp.page) ?? 1;
    return {
      title: page > 1 ? `${rubric.name} — страница ${page}` : rubric.name,
      description:
        rubric.description ?? `Статьи в рубрике «${rubric.name}» — блог клуба «Пирамида»`,
      alternates: { canonical: pageHref(`/blog/${rubric.slug}`, page) },
    };
  }

  return { title: "Страница не найдена", robots: { index: false, follow: false } };
}

export default function BlogSlugPage({ params, searchParams }: SlugPageProps) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <SlugContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SlugContent({ params, searchParams }: SlugPageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  await connection();
  const now = roundedNowIso();

  const article = await getArticleBySlug(slug, now);
  if (article) return <ArticlePage article={article} now={now} />;

  const rubric = await getRubricBySlug(slug);
  if (rubric) {
    const page = parsePageParam(sp.page);
    if (page === null) notFound();
    return <RubricPage rubric={rubric} now={now} page={page} />;
  }

  const target = await findRedirect(`/blog/${slug}`);
  if (target) permanentRedirect(target);
  notFound();
}

// ── Статья ──────────────────────────────────────────────────────────────────

async function ArticlePage({ article, now }: { article: ArticleDetailView; now: string }) {
  const [related, recent] = await Promise.all([
    getRelatedArticles(
      {
        id: article.id,
        rubricSlug: article.rubric?.slug ?? null,
        tagSlugs: article.tags.map((t) => t.slug),
      },
      now
    ),
    getRecentArticles(4, now, article.slug),
  ]);

  const url = absoluteUrl(`/blog/${article.slug}`);
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Главная", href: "/" },
    { label: "Блог", href: "/blog" },
    ...(article.rubric
      ? [{ label: article.rubric.name, href: `/blog/${article.rubric.slug}` }]
      : []),
    { label: article.title },
  ];

  const author: ArticleJsonLdInput["author"] = article.author
    ? {
        name: article.author.name,
        url: absoluteUrl(`/authors/${article.author.slug}`),
        ...(article.author.roleInClub ? { jobTitle: article.author.roleInClub } : {}),
        ...(article.author.sameAs.length > 0 ? { sameAs: article.author.sameAs } : {}),
      }
    : undefined;
  const coverUrl = article.cover ? mediaUrl(article.cover, JSONLD_IMAGE_WIDTH) : "";

  const articleLd = articleJsonLd({
    headline: article.title,
    url,
    description: articleDescription(article),
    ...(coverUrl ? { image: absoluteUrl(coverUrl) } : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    dateModified: article.updatedAt,
    ...(author ? { author } : {}),
    publisher: { name: CLUB_NAME, url: absoluteUrl("/"), logo: absoluteUrl("/images/logo.png") },
  });
  // Без автора — организация (articleJsonLd умеет только Person, поэтому дописываем здесь)
  const articleLdWithAuthor = author
    ? articleLd
    : { ...articleLd, author: { "@type": "Organization", name: CLUB_NAME, url: absoluteUrl("/") } };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(articleLdWithAuthor) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd(breadcrumbs)) }}
      />
      <ArticleView
        article={article}
        breadcrumbs={breadcrumbs}
        shareUrl={url}
        related={related}
        recent={recent}
      />
    </>
  );
}

// ── Рубрика ─────────────────────────────────────────────────────────────────

async function RubricPage({
  rubric,
  now,
  page,
}: {
  rubric: RubricView;
  now: string;
  page: number;
}) {
  const { items, total, pageSize } = await getPublishedArticles({
    rubricSlugs: [rubric.slug],
    page,
    now,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > totalPages) notFound();

  const base = `/blog/${rubric.slug}`;
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Главная", href: "/" },
    { label: "Блог", href: "/blog" },
    { label: rubric.name },
  ];

  return (
    <Container className="flex flex-col gap-8 py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd(breadcrumbs)) }}
      />
      <header className="flex flex-col gap-4">
        <Breadcrumbs items={breadcrumbs} />
        <SectionTitle as="h1">{rubric.name}</SectionTitle>
        {rubric.description && (
          <p className="text-body-lg text-subtle max-w-3xl">{rubric.description}</p>
        )}
      </header>

      {items.length > 0 ? (
        <section aria-label="Статьи рубрики" className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((article, i) => (
              <ArticleCard key={article.id} article={article} priority={i === 0} />
            ))}
          </div>
          <LoadMore
            nextHref={page < totalPages ? pageHref(base, page + 1) : null}
            prevHref={page > 1 ? pageHref(base, page - 1) : null}
          />
        </section>
      ) : (
        <div className="text-subtle flex flex-col items-center gap-3 py-16 text-center">
          <Newspaper className="h-16 w-16 opacity-40" aria-hidden="true" />
          <p className="text-body-lg">В этой рубрике пока нет статей.</p>
        </div>
      )}
    </Container>
  );
}
