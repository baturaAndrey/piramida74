/**
 * Быстрая проверка `/blog/<slug>` для proxy: опубликованная статья или рубрика → страница,
 * запись в `redirects` → редирект, иначе → 404. Нужна, чтобы отдать настоящие коды 301/404:
 * страница блога стримится, и `notFound()`/`permanentRedirect()` внутри `<Suspense>` уже не
 * меняют статус ответа.
 *
 * Без `server-only` и без статического импорта БД: модуль входит в бандл proxy, а `next build`
 * (в т. ч. без `POSTGRES_URL`) не должен создавать клиент postgres при загрузке модуля.
 * `'use cache'` в proxy не работает, поэтому кэш — в памяти процесса с коротким TTL.
 */

export type BlogRouteResult =
  { kind: "page" } | { kind: "redirect"; to: string; code: RedirectCode } | { kind: "missing" };

const REDIRECT_CODES = [301, 302, 307, 308] as const;
export type RedirectCode = (typeof REDIRECT_CODES)[number];
const DEFAULT_REDIRECT_CODE: RedirectCode = 301;

/** Время жизни записи кэша: столько максимум сайт может «не видеть» правки, сделанные в обход админки */
const CACHE_TTL_MS = 60_000;
/** Ограничение памяти: случайные/вредоносные URL не должны раздувать кэш */
const CACHE_MAX_ENTRIES = 1_000;

type CacheEntry = { result: BlogRouteResult; expiresAt: number };

/**
 * Кэш на `globalThis`: proxy и Server Actions собираются в разные бандлы, но работают в одном
 * Node-процессе — так `bumpBlogRouteCache()` из админки очищает тот же Map, что читает proxy.
 */
const globalForCache = globalThis as unknown as { __blogRouteCache?: Map<string, CacheEntry> };
const cache = (globalForCache.__blogRouteCache ??= new Map<string, CacheEntry>());

/** Сбросить кэш после изменений статей, рубрик или редиректов (вызывается после коммита). */
export function bumpBlogRouteCache(): void {
  cache.clear();
}

/** Только относительные пути сайта: `//host` и `/\host` браузер считает внешними адресами */
export function isInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

function isRedirectCode(code: number): code is RedirectCode {
  return (REDIRECT_CODES as readonly number[]).includes(code);
}

type LookupRow = { kind: "page" | "redirect"; to_path: string | null; code: number | null };

/**
 * Один запрос: статья (published или scheduled с наступившей датой) и рубрика важнее редиректа —
 * поэтому `priority` и `order by`. `fromPath` — путь целиком, как он хранится в `redirects`.
 */
async function queryBlogRoute(slug: string, fromPath: string): Promise<BlogRouteResult> {
  // Ленивый импорт: клиент postgres создаётся только при первом реальном запросе
  const { queryClient } = await import("@/lib/db");
  const rows = await queryClient<LookupRow[]>`
    select kind, to_path, code from (
      select 'page' as kind, null::text as to_path, null::int as code, 0 as priority
        from articles
        where slug = ${slug}
          and (status = 'published' or (status = 'scheduled' and published_at <= now()))
      union all
      select 'page', null, null, 1 from rubrics where slug = ${slug}
      union all
      select 'redirect', to_path, code::int, 2 from redirects where from_path = ${fromPath}
    ) as candidates
    order by priority
    limit 1
  `;
  const row = rows[0];
  if (!row) return { kind: "missing" };
  if (row.kind === "page") return { kind: "page" };

  const to = row.to_path?.trim() ?? "";
  // Битая запись (внешний адрес, петля на себя) — как будто редиректа нет
  if (!isInternalPath(to) || to === fromPath) return { kind: "missing" };
  const code = row.code !== null && isRedirectCode(row.code) ? row.code : DEFAULT_REDIRECT_CODE;
  return { kind: "redirect", to, code };
}

function remember(key: string, result: BlogRouteResult, now: number): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Map хранит порядок вставки — удаляем самую старую запись
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { result, expiresAt: now + CACHE_TTL_MS });
}

/** Результат для `/blog/<slug>` (slug уже декодирован). Ошибки БД пробрасываются вызывающему. */
export async function lookupBlogRoute(slug: string): Promise<BlogRouteResult> {
  const now = Date.now();
  const hit = cache.get(slug);
  if (hit && hit.expiresAt > now) return hit.result;

  const result = await queryBlogRoute(slug, `/blog/${slug}`);
  cache.delete(slug);
  remember(slug, result, now);
  return result;
}
