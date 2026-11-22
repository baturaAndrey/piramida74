import type { PublicTournament } from "@/lib/queries/tournaments";
import type { Discipline } from "@/lib/schema/enums";
import { DISCIPLINES, isDiscipline } from "./labels";

/** Разрешённый диапазон `?year=` — защита от мусорных значений в URL */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export type TournamentFilters = {
  year: number;
  discipline: Discipline | null;
  category: string | null;
  past: boolean;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Разбор `searchParams`; некорректные значения игнорируются (год — из `opDate`) */
export function parseFilters(params: RawSearchParams, opDate: string): TournamentFilters {
  const defaultYear = Number(opDate.slice(0, 4));
  const rawYear = first(params.year);
  const year = rawYear && /^\d{4}$/.test(rawYear) ? Number(rawYear) : defaultYear;
  const discipline = first(params.discipline);
  const category = first(params.category)?.trim();
  return {
    year: year >= MIN_YEAR && year <= MAX_YEAR ? year : defaultYear,
    discipline: isDiscipline(discipline) ? discipline : null,
    category: category ? category.slice(0, 100) : null,
    past: first(params.past) === "1",
  };
}

const lower = (s: string) => s.toLocaleLowerCase("ru-RU");

/** Фильтр по дисциплине (равенство) и категории (регистронезависимое равенство элемента) */
export function applyFilters(
  list: readonly PublicTournament[],
  filters: Pick<TournamentFilters, "discipline" | "category">
): PublicTournament[] {
  const category = filters.category ? lower(filters.category) : null;
  return list.filter(
    (t) =>
      (!filters.discipline || t.discipline === filters.discipline) &&
      (!category || t.categories.some((c) => lower(c) === category))
  );
}

/** Значения для чипов фильтров — из неотфильтрованного списка года */
export function filterOptions(list: readonly PublicTournament[]): {
  disciplines: Discipline[];
  categories: string[];
} {
  const present = new Set(list.map((t) => t.discipline).filter((d): d is Discipline => !!d));
  // Категории без учёта регистра: первое встретившееся написание
  const categories = new Map<string, string>();
  for (const t of list) {
    for (const c of t.categories) {
      const value = c.trim();
      if (value && !categories.has(lower(value))) categories.set(lower(value), value);
    }
  }
  return {
    disciplines: DISCIPLINES.filter((d) => present.has(d)),
    categories: [...categories.values()],
  };
}

/** Предстоящие и идущие: `endDate >= opDate`; прошедшие — в порядке убывания даты */
export function splitByDate(
  list: readonly PublicTournament[],
  opDate: string
): { upcoming: PublicTournament[]; past: PublicTournament[] } {
  const upcoming = list.filter((t) => t.endDate >= opDate);
  const past = list
    .filter((t) => t.endDate < opDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.endDate.localeCompare(a.endDate));
  return { upcoming, past };
}

const monthFormatter = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** «март 2026 г.» → «Март 2026» */
function monthTitle(isoDate: string): string {
  const raw = monthFormatter.format(new Date(`${isoDate}T00:00:00Z`)).replace(/\s*г\.?$/u, "");
  return raw.charAt(0).toLocaleUpperCase("ru-RU") + raw.slice(1);
}

export type MonthGroup = { monthKey: string; title: string; items: PublicTournament[] };

/** Группировка по месяцу начала (список уже отсортирован по `startDate`) */
export function groupByMonth(list: readonly PublicTournament[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const t of list) {
    const monthKey = t.startDate.slice(0, 7);
    const last = groups.at(-1);
    if (last && last.monthKey === monthKey) last.items.push(t);
    else groups.push({ monthKey, title: monthTitle(t.startDate), items: [t] });
  }
  return groups;
}
