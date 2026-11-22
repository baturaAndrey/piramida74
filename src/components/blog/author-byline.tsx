import Link from "next/link";
import { UserRound } from "lucide-react";
import { Picture } from "@/components/media/picture";
import { formatArticleDate, readingTimeLabel } from "@/lib/content/format";
import type { AuthorView } from "@/lib/queries/blog";
import { cn } from "@/lib/utils";

type AuthorBylineProps = {
  author: Pick<AuthorView, "slug" | "name" | "photo"> | null;
  /** ISO */
  publishedAt: string | null;
  readingMinutes: number;
  className?: string;
};

/** Строка «Автор: Имя · дата · N мин чтения» с миниатюрой автора. */
export function AuthorByline({
  author,
  publishedAt,
  readingMinutes,
  className,
}: AuthorBylineProps) {
  const parts: React.ReactNode[] = [];
  if (publishedAt) {
    parts.push(
      <time key="date" dateTime={publishedAt}>
        {formatArticleDate(publishedAt)}
      </time>
    );
  }
  parts.push(<span key="reading">{readingTimeLabel(readingMinutes)}</span>);

  return (
    <div
      className={cn("text-subtle flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", className)}
    >
      {author && (
        <>
          <span className="bg-muted inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border">
            {author.photo ? (
              <Picture
                asset={author.photo}
                alt=""
                sizes="32px"
                pictureClassName="block h-full w-full"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
          <span>
            Автор:{" "}
            <Link
              href={`/authors/${author.slug}`}
              rel="author"
              className="text-foreground hover:text-primary font-medium transition-colors"
            >
              {author.name}
            </Link>
          </span>
        </>
      )}
      {/*
        Дата и время чтения — одной группой: на мобильном она всегда с новой строки и без
        ведущей «·» (иначе при переносе строка начиналась бы с разделителя), с `sm` — в строку с автором
      */}
      <span
        className={cn("inline-flex flex-wrap items-center gap-x-2", author && "w-full sm:w-auto")}
      >
        {parts.map((part, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            {author && i === 0 && (
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
            )}
            {i > 0 && <span aria-hidden="true">·</span>}
            {part}
          </span>
        ))}
      </span>
    </div>
  );
}
