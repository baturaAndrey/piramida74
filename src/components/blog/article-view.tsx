import Link from "next/link";
import { ArticleBody } from "@/components/blog/article-body";
import { ArticleCard } from "@/components/blog/article-card";
import { AuthorByline } from "@/components/blog/author-byline";
import { AuthorCard } from "@/components/blog/author-card";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/blog/breadcrumbs";
import { ShareButtons } from "@/components/blog/share-buttons";
import { TableOfContents } from "@/components/blog/toc";
import { Picture } from "@/components/media/picture";
import { Container } from "@/components/site/container";
import { extractHeadings } from "@/lib/content/markdown";
import type { ArticleCardView, ArticleDetailView } from "@/lib/queries/blog";

type ArticleViewProps = {
  article: ArticleDetailView;
  breadcrumbs: BreadcrumbItem[];
  /** Абсолютный URL статьи для «Поделиться» */
  shareUrl: string;
  /** Похожие статьи (`getRelatedArticles` вызывается снаружи) */
  related?: ArticleCardView[];
  /** Последние статьи */
  recent?: ArticleCardView[];
};

function CardsSection({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: ArticleCardView[];
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6">
      <h2 id={id} className="text-2xl font-semibold md:text-3xl">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </section>
  );
}

/**
 * Вёрстка статьи — общая для публичной страницы и предпросмотра черновика:
 * крошки, H1, автор/дата, обложка, оглавление, тело, «Поделиться», «Об авторе»,
 * «Похожие статьи» и «Последние статьи». Синхронный, без обращений к БД.
 */
export function ArticleView({
  article,
  breadcrumbs,
  shareUrl,
  related = [],
  recent = [],
}: ArticleViewProps) {
  const headings = extractHeadings(article.body);
  const showToc = article.showToc && headings.length > 0;

  return (
    <Container className="flex flex-col gap-12 py-8 md:py-12">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <Breadcrumbs items={breadcrumbs} />
          <h1 className="text-3xl leading-tight font-bold text-balance md:text-4xl lg:text-5xl">
            {article.title}
          </h1>
          {article.excerpt && <p className="text-body-lg text-subtle">{article.excerpt}</p>}
          <AuthorByline
            author={article.author}
            publishedAt={article.publishedAt}
            readingMinutes={article.readingMinutes}
          />
        </header>

        {article.cover && (
          <div className="bg-muted overflow-hidden rounded-lg border">
            <Picture
              asset={article.cover}
              priority
              sizes="(min-width: 768px) 768px, 86vw"
              pictureClassName="block"
              className="aspect-video h-auto w-full object-cover"
            />
          </div>
        )}

        {showToc && <TableOfContents headings={headings} />}

        {article.body.trim().length > 0 ? (
          <ArticleBody body={article.body} withToc={showToc} />
        ) : (
          <p className="text-subtle">Текст статьи скоро появится.</p>
        )}

        {article.tags.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Теги">
            {article.tags.map((tag) => (
              <li key={tag.slug}>
                <Link
                  href={`/blog?tag=${encodeURIComponent(tag.slug)}`}
                  className="bg-accent text-accent-foreground hover:bg-primary/15 rounded-full px-3 py-1 text-sm transition-colors"
                >
                  #{tag.name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <ShareButtons url={shareUrl} title={article.title} className="border-t pt-6" />

        {article.author && <AuthorCard author={article.author} />}
      </article>

      <CardsSection id="related-articles" title="Похожие статьи" items={related} />
      <CardsSection id="recent-articles" title="Последние статьи" items={recent} />
    </Container>
  );
}
