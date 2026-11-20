import Link from "next/link";
import { Award, ExternalLink, UserRound } from "lucide-react";
import { RichText } from "@/components/blog/rich-text";
import { Picture } from "@/components/media/picture";
import { stripMarkdown } from "@/lib/content/markdown";
import type { AuthorView } from "@/lib/queries/blog";
import { cn } from "@/lib/utils";

type AuthorCardProps = {
  author: AuthorView;
  /** `compact` — блок «Об авторе» в статье; `full` — шапка страницы автора (H1, био целиком, ссылки) */
  variant?: "compact" | "full";
  className?: string;
};

/** Подпись ссылки профиля: хост без `www.` */
function profileLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Только абсолютные https-ссылки профилей */
function safeProfiles(sameAs: string[]): string[] {
  return sameAs.filter((url) => {
    try {
      return new URL(url).protocol === "https:";
    } catch {
      return false;
    }
  });
}

function AuthorPhoto({ author, size }: { author: AuthorView; size: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "bg-muted inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border",
        size === "lg" ? "size-28 md:size-36" : "size-16 md:size-20"
      )}
    >
      {author.photo ? (
        <Picture
          asset={author.photo}
          alt={author.name}
          sizes={size === "lg" ? "144px" : "80px"}
          priority={size === "lg"}
          pictureClassName="block h-full w-full"
          className="h-full w-full object-cover"
        />
      ) : (
        <UserRound className="text-subtle h-8 w-8" aria-hidden="true" />
      )}
    </span>
  );
}

/** Блок автора: фото, имя, роль в клубе, разряд, био. */
export function AuthorCard({ author, variant = "compact", className }: AuthorCardProps) {
  const href = `/authors/${author.slug}`;
  const full = variant === "full";
  const profiles = full ? safeProfiles(author.sameAs) : [];
  const bioText = !full && author.bio ? stripMarkdown(author.bio) : "";

  return (
    <section
      aria-label={full ? undefined : "Об авторе"}
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-5 rounded-lg border p-5 sm:flex-row sm:items-start md:p-6",
        className
      )}
    >
      <AuthorPhoto author={author} size={full ? "lg" : "md"} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {!full && (
          <p className="text-subtle text-xs font-semibold tracking-wide uppercase">Об авторе</p>
        )}
        {full ? (
          <h1 className="text-h2 font-semibold">{author.name}</h1>
        ) : (
          <Link
            href={href}
            rel="author"
            className="hover:text-primary text-lg font-semibold transition-colors"
          >
            {author.name}
          </Link>
        )}
        {author.roleInClub && (
          <p className="text-subtle text-sm md:text-base">{author.roleInClub}</p>
        )}
        {author.rank && (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium">
            <Award className="text-primary h-4 w-4" aria-hidden="true" />
            {author.rank}
          </p>
        )}

        {bioText && <p className="text-subtle line-clamp-4 text-sm leading-6">{bioText}</p>}
        {full && author.bio && <RichText source={author.bio} className="mt-2 gap-4" />}

        {profiles.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {profiles.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="hover:border-primary hover:text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors"
                >
                  {profileLabel(url)}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        )}

        {!full && (
          <Link
            href={href}
            className="text-primary hover:text-primary-dark mt-1 text-sm font-medium transition-colors"
          >
            Все статьи автора
          </Link>
        )}
      </div>
    </section>
  );
}
