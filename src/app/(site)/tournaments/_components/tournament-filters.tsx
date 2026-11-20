import Link from "next/link";
import type { Discipline } from "@/lib/schema/enums";
import { cn } from "@/lib/utils";
import { DISCIPLINE_LABELS } from "../_lib/labels";
import type { TournamentFilters as Filters } from "../_lib/group";

type TournamentFiltersProps = {
  filters: Filters;
  /** Год по умолчанию (из `opDate`) — не пишется в URL */
  defaultYear: number;
  disciplines: Discipline[];
  categories: string[];
};

const CHIP =
  "inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function chipClass(active: boolean) {
  return cn(
    CHIP,
    active
      ? "bg-primary border-primary text-white"
      : "bg-white text-[#8E8E8E] hover:text-foreground"
  );
}

/** URL страницы с заданными параметрами; `null` — параметр убрать */
export function tournamentsHref(
  filters: Filters,
  defaultYear: number,
  patch: Partial<Record<"year" | "discipline" | "category" | "past", string | null>>
): string {
  const params = new URLSearchParams();
  const current: Record<string, string | null> = {
    year: filters.year === defaultYear ? null : String(filters.year),
    discipline: filters.discipline,
    category: filters.category,
    past: filters.past ? "1" : null,
  };
  for (const [key, value] of Object.entries({ ...current, ...patch })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/tournaments?${query}` : "/tournaments";
}

/** Чипы-ссылки фильтров: работают без JS, сохраняют остальные параметры */
export function TournamentFilters({
  filters,
  defaultYear,
  disciplines,
  categories,
}: TournamentFiltersProps) {
  const href = (patch: Parameters<typeof tournamentsHref>[2]) =>
    tournamentsHref(filters, defaultYear, patch);
  const hasActive = filters.discipline !== null || filters.category !== null;
  const activeCategory = filters.category?.toLocaleLowerCase("ru-RU") ?? null;

  return (
    <div className="space-y-3">
      {disciplines.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Дисциплина">
          <span className="mr-1 text-sm font-semibold">Дисциплина:</span>
          <Link
            href={href({ discipline: null })}
            scroll={false}
            aria-current={filters.discipline === null ? "true" : undefined}
            className={chipClass(filters.discipline === null)}
          >
            Все
          </Link>
          {disciplines.map((d) => (
            <Link
              key={d}
              href={href({ discipline: d })}
              scroll={false}
              aria-current={filters.discipline === d ? "true" : undefined}
              className={chipClass(filters.discipline === d)}
            >
              {DISCIPLINE_LABELS[d]}
            </Link>
          ))}
        </div>
      ) : null}

      {categories.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Категория">
          <span className="mr-1 text-sm font-semibold">Категория:</span>
          <Link
            href={href({ category: null })}
            scroll={false}
            aria-current={filters.category === null ? "true" : undefined}
            className={chipClass(filters.category === null)}
          >
            Все
          </Link>
          {categories.map((c) => {
            const active = activeCategory === c.toLocaleLowerCase("ru-RU");
            return (
              <Link
                key={c}
                href={href({ category: c })}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={chipClass(active)}
              >
                {c}
              </Link>
            );
          })}
        </div>
      ) : null}

      {hasActive ? (
        <Link
          href={href({ discipline: null, category: null })}
          scroll={false}
          className="text-primary hover:text-primary-dark inline-block rounded-sm text-sm font-semibold underline-offset-4 transition-colors hover:underline"
        >
          Сбросить
        </Link>
      ) : null}
    </div>
  );
}
