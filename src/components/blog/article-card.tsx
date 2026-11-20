import Link from "next/link";
import { CalendarDays, Clock, Newspaper } from "lucide-react";
import { Picture } from "@/components/media/picture";
import { formatArticleDate, readingTimeLabel } from "@/lib/content/format";
import type { ArticleCardView } from "@/lib/queries/blog";
import { cn } from "@/lib/utils";

type ArticleCardProps = {
  article: ArticleCardView;
  /** Крупная карточка (блок «Рекомендуем») */
  featured?: boolean;
  /** Обложка первой карточки над сгибом — eager */
  priority?: boolean;
  className?: string;
};

/** Карточка статьи: обложка 16:9, рубрика, заголовок, анонс, дата и время чтения. */
export function ArticleCard({
  article,
  featured = false,
  priority = false,
  className,
}: ArticleCardProps) {
  return (
    <article
      className={cn(
        "bg-card text-card-foreground card-interactive group overflow-hidden rounded-lg border shadow-sm",
        className
      )}
    >
      <Link href={`/blog/${article.slug}`} className="flex h-full flex-col">
        <div className="bg-muted relative aspect-video overflow-hidden">
          {article.cover ? (
            <Picture
              asset={article.cover}
              alt=""
              priority={priority}
              sizes={
                featured
                  ? "(min-width: 1024px) 50vw, 100vw"
                  : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              }
              pictureClassName="block h-full w-full"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="text-primary/40 flex h-full w-full items-center justify-center">
              <Newspaper className="h-12 w-12" aria-hidden="true" />
            </span>
          )}
          {article.rubric && (
            <span className="bg-badge text-badge-foreground absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold">
              {article.rubric.name}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4 md:p-5">
          <h3
            className={cn(
              "group-hover:text-primary line-clamp-3 font-semibold transition-colors",
              featured ? "text-xl md:text-2xl" : "text-lg"
            )}
          >
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="text-subtle line-clamp-2 text-sm leading-6">{article.excerpt}</p>
          )}
          <div className="text-subtle mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
            {article.publishedAt && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {readingTimeLabel(article.readingMinutes)}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
