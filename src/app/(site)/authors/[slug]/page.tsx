import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Newspaper } from "lucide-react";
import { ArticleCard } from "@/components/blog/article-card";
import { AuthorCard } from "@/components/blog/author-card";
import { ArticleSkeleton } from "@/components/blog/blog-skeletons";
import { breadcrumbLd, Breadcrumbs, type BreadcrumbItem } from "@/components/blog/breadcrumbs";
import { LoadMore, pageHref } from "@/components/blog/load-more";
import { Container } from "@/components/site/container";
import { roundedNowIso } from "@/lib/content/blog-now";
import { stripMarkdown, truncateText } from "@/lib/content/markdown";
import { parsePageParam, type PageSearchParams } from "@/lib/content/search-params";
import { absoluteUrl } from "@/lib/content/site-url";
import { mediaUrl } from "@/lib/media/url";
import { getAuthorBySlug, getPublishedArticles, type AuthorView } from "@/lib/queries/blog";
import { jsonLdScript, personJsonLd } from "@/lib/seo/jsonld";
import type { Metadata } from "next";

/** Страница автора-тренера: профиль, статьи с пагинацией, JSON-LD `Person`. */

const DESCRIPTION_LENGTH = 160;
const PHOTO_JSONLD_WIDTH = 640;

type AuthorPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PageSearchParams>;
};

function authorTitle(author: AuthorView): string {
  return author.roleInClub ? `${author.name} — ${author.roleInClub}` : author.name;
}

export async function generateMetadata({
  params,
  searchParams,
}: AuthorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  await connection();
  const author = await getAuthorBySlug(slug);
  if (!author) return { title: "Страница не найдена", robots: { index: false, follow: false } };

  const page = parsePageParam(sp.page) ?? 1;
  const bio = author.bio ? truncateText(stripMarkdown(author.bio), DESCRIPTION_LENGTH) : "";
  return {
    title: authorTitle(author),
    description: bio || `Статьи автора ${author.name} в блоге клуба «Пирамида»`,
    alternates: { canonical: pageHref(`/authors/${author.slug}`, page) },
    openGraph: { type: "profile", title: author.name },
  };
}

export default function AuthorPage({ params, searchParams }: AuthorPageProps) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <AuthorContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AuthorContent({ params, searchParams }: AuthorPageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  await connection();
  const now = roundedNowIso();

  const page = parsePageParam(sp.page);
  if (page === null) notFound();
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const { items, total, pageSize } = await getPublishedArticles({
    authorSlug: author.slug,
    page,
    now,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > totalPages) notFound();

  const base = `/authors/${author.slug}`;
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Главная", href: "/" },
    { label: "Блог", href: "/blog" },
    { label: author.name },
  ];
  const photoUrl = author.photo ? mediaUrl(author.photo, PHOTO_JSONLD_WIDTH) : "";
  const personLd = personJsonLd({
    name: author.name,
    url: absoluteUrl(base),
    ...(photoUrl ? { image: absoluteUrl(photoUrl) } : {}),
    ...(author.roleInClub ? { jobTitle: author.roleInClub } : {}),
    ...(author.sameAs.length > 0 ? { sameAs: author.sameAs } : {}),
  });

  return (
    <Container className="flex flex-col gap-10 py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(personLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd(breadcrumbs)) }}
      />
      <Breadcrumbs items={breadcrumbs} />
      <AuthorCard author={author} variant="full" />

      <section aria-labelledby="author-articles" className="flex flex-col gap-6">
        <h2 id="author-articles" className="text-2xl font-semibold md:text-3xl">
          Статьи автора
        </h2>
        {items.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
            <LoadMore
              nextHref={page < totalPages ? pageHref(base, page + 1) : null}
              prevHref={page > 1 ? pageHref(base, page - 1) : null}
            />
          </>
        ) : (
          <div className="text-subtle flex flex-col items-center gap-3 py-12 text-center">
            <Newspaper className="h-16 w-16 opacity-40" aria-hidden="true" />
            <p className="text-body-lg">У автора пока нет опубликованных статей.</p>
          </div>
        )}
      </section>
    </Container>
  );
}
