import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type LoadMoreProps = {
  /** Ссылка на следующую страницу (`?page=N+1`) или `null` на последней */
  nextHref: string | null;
  /** Ссылка на предыдущую страницу */
  prevHref?: string | null;
};

/**
 * Пагинация обычными ссылками: работает без JS и видна поисковикам.
 * `scroll={false}` — переход ощущается как подгрузка на месте.
 */
export function LoadMore({ nextHref, prevHref }: LoadMoreProps) {
  if (!nextHref && !prevHref) return null;

  return (
    <nav aria-label="Страницы" className="flex flex-wrap items-center justify-center gap-3">
      {prevHref && (
        <Button asChild variant="ghost" size="lg">
          <Link href={prevHref} rel="prev">
            <ArrowLeft aria-hidden="true" />
            Назад
          </Link>
        </Button>
      )}
      {nextHref && (
        <Button asChild variant="outline" size="lg">
          <Link href={nextHref} rel="next" scroll={false}>
            Показать ещё
          </Link>
        </Button>
      )}
    </nav>
  );
}

/** `base?page=N` (страница 1 — без параметра), с сохранением прочих параметров. */
export function pageHref(base: string, page: number, params?: URLSearchParams): string {
  const query = new URLSearchParams(params);
  if (page > 1) query.set("page", String(page));
  else query.delete("page");
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}
