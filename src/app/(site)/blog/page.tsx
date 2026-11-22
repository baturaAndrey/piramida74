import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Newspaper } from "lucide-react";
import { ArticleCard } from "@/components/blog/article-card";
import { BlogFilters } from "@/components/blog/blog-filters";
import { BlogListSkeleton } from "@/components/blog/blog-skeletons";
import { breadcrumbLd, Breadcrumbs, type BreadcrumbItem } from "@/components/blog/breadcrumbs";
import { LoadMore, pageHref } from "@/components/blog/load-more";
import { RubricTile } from "@/components/blog/rubric-tile";
import { Container } from "@/components/site/container";
import { SectionTitle } from "@/components/site/section-title";
import { roundedNowIso } from "@/lib/content/blog-now";
import {
  parseFacetParam,
  parsePageParam,
  type PageSearchParams,
} from "@/lib/content/search-params";
import {
  getFeaturedArticles,
  getPublishedArticles,
  getRubricsWithCounts,
  getTagsWithCounts,
} from "@/lib/queries/blog";
import { jsonLdScript } from "@/lib/seo/jsonld";
import type { Metadata } from "next";

const PAGE_TITLE = "Блог";
const PAGE_DESCRIPTION =
  "Статьи, советы и новости бильярдного клуба «Пирамида»: правила и техника игры, турниры, тренировки и жизнь клуба.";
const RSS_ALTERNATE = { "application/rss+xml": "/blog/rss.xml" };

const BREADCRUMBS: BreadcrumbItem[] = [{ label: "Главная", href: "/" }, { label: PAGE_TITLE }];

type BlogPageProps = { searchParams: Promise<PageSearchParams> };

/** Активные фильтры и страница из URL */
function readParams(sp: PageSearchParams) {
  const rubricSlugs = parseFacetParam(sp.rubric);
  const tagSlugs = parseFacetParam(sp.tag);
  return {
    rubricSlugs,
    tagSlugs,
    page: parsePageParam(sp.page),
    hasFilter: rubricSlugs.length > 0 || tagSlugs.length > 0,
  };
}

/** Фильтры и страницы > 1 не индексируются (follow сохраняется); фильтры — canonical на хаб. */
export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const { page, hasFilter } = readParams(await searchParams);
  const pageNumber = page ?? 1;
  const canonical = !hasFilter && pageNumber > 1 ? pageHref("/blog", pageNumber) : "/blog";
  return {
    title: pageNumber > 1 ? `${PAGE_TITLE} — страница ${pageNumber}` : PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    alternates: { canonical, types: RSS_ALTERNATE },
    ...(hasFilter || pageNumber > 1 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default function BlogPage({ searchParams }: BlogPageProps) {
  return (
    <Container className="flex flex-col gap-8 py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd(BREADCRUMBS)) }}
      />
      <header className="flex flex-col gap-4">
        <Breadcrumbs items={BREADCRUMBS} />
        <SectionTitle as="h1">{PAGE_TITLE}</SectionTitle>
        <p className="text-body-lg text-subtle max-w-3xl">{PAGE_DESCRIPTION}</p>
      </header>

      <Suspense fallback={<BlogListSkeleton />}>
        <BlogContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function BlogContent({ searchParams }: BlogPageProps) {
  const sp = await searchParams;
  await connection();
  const now = roundedNowIso();

  const { rubricSlugs, tagSlugs, page, hasFilter } = readParams(sp);
  if (page === null) notFound();
  // «Рекомендуем» и плитки рубрик — только на первой странице без фильтров
  const showBrowse = !hasFilter && page === 1;

  const [articlesPage, rubrics, tags, featured] = await Promise.all([
    getPublishedArticles({ rubricSlugs, tagSlugs, page, now }),
    getRubricsWithCounts(now),
    getTagsWithCounts(now),
    showBrowse ? getFeaturedArticles(3, now) : Promise.resolve([]),
  ]);

  const { items, total, pageSize } = articlesPage;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > totalPages) notFound();

  const featuredIds = new Set(featured.map((a) => a.id));
  // Избранные уже показаны выше — в общей сетке первой страницы не повторяем
  const gridItems = showBrowse ? items.filter((a) => !featuredIds.has(a.id)) : items;
  const rubricTiles = rubrics.filter((r) => r.image !== null);

  const filterParams = new URLSearchParams();
  if (rubricSlugs.length > 0) filterParams.set("rubric", rubricSlugs.join(","));
  if (tagSlugs.length > 0) filterParams.set("tag", tagSlugs.join(","));
  const nextHref = page < totalPages ? pageHref("/blog", page + 1, filterParams) : null;
  const prevHref = page > 1 ? pageHref("/blog", page - 1, filterParams) : null;

  return (
    <div className="flex flex-col gap-12">
      {/* useSearchParams внутри → собственная граница Suspense */}
      <Suspense fallback={<div className="h-9" />}>
        <BlogFilters
          rubrics={rubrics.map(({ slug, name, count }) => ({ slug, name, count }))}
          tags={tags.map(({ slug, name, count }) => ({ slug, name, count }))}
        />
      </Suspense>

      {showBrowse && featured.length > 0 && (
        <section aria-labelledby="blog-featured" className="flex flex-col gap-6">
          <h2 id="blog-featured" className="text-2xl font-semibold md:text-3xl">
            Рекомендуем
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((article, i) => (
              <ArticleCard
                key={article.id}
                article={article}
                featured
                priority={i === 0}
                {...(i === 0 ? { className: "md:col-span-2 lg:col-span-2" } : {})}
              />
            ))}
          </div>
        </section>
      )}

      {showBrowse && rubricTiles.length > 0 && (
        <section aria-labelledby="blog-rubrics" className="flex flex-col gap-6">
          <h2 id="blog-rubrics" className="text-2xl font-semibold md:text-3xl">
            Рубрики
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {rubricTiles.map((r) =>
              r.image ? (
                <RubricTile
                  key={r.id}
                  slug={r.slug}
                  name={r.name}
                  image={r.image}
                  count={r.count}
                />
              ) : null
            )}
          </div>
        </section>
      )}

      {gridItems.length > 0 ? (
        <section aria-label="Статьи" className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gridItems.map((article, i) => (
              <ArticleCard key={article.id} article={article} priority={!showBrowse && i === 0} />
            ))}
          </div>
          <LoadMore nextHref={nextHref} prevHref={prevHref} />
        </section>
      ) : items.length === 0 ? (
        <div className="text-subtle flex flex-col items-center gap-3 py-16 text-center">
          <Newspaper className="h-16 w-16 opacity-40" aria-hidden="true" />
          <p className="text-body-lg">
            {hasFilter
              ? "По выбранным фильтрам статей пока нет. Попробуйте сбросить фильтр."
              : "Статьи скоро появятся."}
          </p>
        </div>
      ) : (
        <LoadMore nextHref={nextHref} prevHref={prevHref} />
      )}
    </div>
  );
}
