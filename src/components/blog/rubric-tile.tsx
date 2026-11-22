import Link from "next/link";
import { Picture } from "@/components/media/picture";
import type { BlogMedia } from "@/lib/queries/blog";
import { cn } from "@/lib/utils";

type RubricTileProps = {
  slug: string;
  name: string;
  image: BlogMedia;
  count?: number;
  className?: string;
};

/** Плитка рубрики с изображением → страница рубрики `/blog/<slug>`. */
export function RubricTile({ slug, name, image, count, className }: RubricTileProps) {
  return (
    <Link
      href={`/blog/${slug}`}
      className={cn(
        "card-interactive group bg-muted relative block aspect-[4/3] overflow-hidden rounded-lg border",
        className
      )}
    >
      <Picture
        asset={image}
        alt=""
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        pictureClassName="block h-full w-full"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <span
        aria-hidden="true"
        className="from-foreground/80 via-foreground/20 absolute inset-0 bg-gradient-to-t to-transparent"
      />
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 md:p-4">
        <span className="text-base leading-tight font-semibold text-white md:text-lg">{name}</span>
        {count !== undefined && (
          <span className="bg-badge text-badge-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
            {count}
          </span>
        )}
      </span>
    </Link>
  );
}
