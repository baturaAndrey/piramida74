import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { absoluteUrl } from "@/lib/content/site-url";
import { breadcrumbJsonLd, type BreadcrumbItemInput } from "@/lib/seo/jsonld";
import { cn } from "@/lib/utils";

/** Пункт хлебных крошек; последний — текущая страница (без ссылки). */
export type BreadcrumbItem = BreadcrumbItemInput;

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Хлебные крошки" className={cn("text-sm", className)}>
      <ol className="text-subtle flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-primary transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn("truncate", isLast && "text-foreground font-medium")}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** BreadcrumbList JSON-LD из тех же пунктов (ссылки — абсолютные). */
export function breadcrumbLd(items: BreadcrumbItem[]) {
  return breadcrumbJsonLd(
    items.map((b) =>
      b.href !== undefined ? { label: b.label, href: absoluteUrl(b.href) } : { label: b.label }
    )
  );
}
