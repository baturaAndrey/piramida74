/** Значение `searchParams` страницы App Router */
export type SearchParamValue = string | string[] | undefined;
export type PageSearchParams = Record<string, SearchParamValue>;

/** Верхняя граница номера страницы (защита от `?page=1e9` и переполнения OFFSET) */
const MAX_PAGE = 10_000;
/** Ограничения фасета: число значений и длина slug */
const MAX_FACET_VALUES = 20;
const MAX_SLUG_LENGTH = 200;

/** `?rubric=a,b&rubric=c` → `["a", "b", "c"]` (trim, уникальные, без пустых). */
export function parseFacetParam(value: SearchParamValue): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  const slugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= MAX_SLUG_LENGTH);
  return [...new Set(slugs)].slice(0, MAX_FACET_VALUES);
}

/**
 * `?page=N` → целое ≥ 1. Некорректное значение (`abc`, `0`, `-1`, `2.5`) — `null`,
 * чтобы страница могла ответить 404, а не молча показать первую.
 * Отсутствующий параметр → 1.
 */
export function parsePageParam(value: SearchParamValue): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === "") return 1;
  if (!/^\d{1,6}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= MAX_PAGE ? n : null;
}
