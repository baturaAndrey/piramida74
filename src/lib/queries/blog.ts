import { cacheLife, cacheTag } from "next/cache";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { articleTag, TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { articles, articleTags, authors, blogTags, redirects, rubrics } from "@/lib/schema";
import { loadMedia, pickMedia, type PublicMedia } from "./types";

/**
 * Публичные чтения блога. Все функции (кроме `getArticleForPreview`) кэшируются
 * (`'use cache'` + тег `TAGS.blog`) и вызываются **после `await connection()`** внутри
 * `<Suspense>`. «Сейчас» передаётся аргументом `now` — ISO-строкой, округлённой до
 * 5 минут (`roundedNowIso()`), поэтому ключ кэша меняется не чаще раза в 5 минут.
 *
 * Ошибки БД не перехватываются: пустой результат не должен «запекаться» в кэш.
 */

/** Карточки на странице списка */
export const BLOG_PAGE_SIZE = 12;

/** Профиль кэша списков, зависящих от `now`: отложенные статьи появляются в течение 5 минут */
const LIST_CACHE = { stale: 300, revalidate: 300, expire: 3600 } as const;

// ── View-модели (только JSON-значения; даты — ISO-строки) ───────────────────

export type BlogMedia = PublicMedia;

export interface ArticleCardView {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover: BlogMedia | null;
  publishedAt: string | null;
  readingMinutes: number;
  rubric: { slug: string; name: string } | null;
  tags: { slug: string; name: string }[];
  /** Имя активного автора (для RSS `dc:creator`) */
  authorName: string | null;
  /** Статья скрыта от индексации (в RSS не попадает) */
  noindex: boolean;
}

export interface AuthorView {
  id: string;
  slug: string;
  name: string;
  photo: BlogMedia | null;
  roleInClub: string | null;
  rank: string | null;
  /** markdown */
  bio: string | null;
  sameAs: string[];
}

export interface ArticleDetailView extends ArticleCardView {
  body: string;
  showToc: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
  author: AuthorView | null;
}

export interface RubricView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: BlogMedia | null;
}

export interface RubricWithCount {
  id: string;
  slug: string;
  name: string;
  image: BlogMedia | null;
  count: number;
}

export interface TagWithCount {
  id: string;
  slug: string;
  name: string;
  count: number;
}

export interface PublishedArticlesPage {
  items: ArticleCardView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GetPublishedArticlesOptions {
  /** Номер страницы с 1 */
  page?: number;
  /** Любая из рубрик (OR внутри фасета) */
  rubricSlugs?: string[];
  /** Любой из тегов (OR внутри фасета; AND с рубриками) */
  tagSlugs?: string[];
  /** Только статьи активного автора */
  authorSlug?: string;
  pageSize?: number;
  /** ISO, округлённое до 5 минут */
  now: string;
}

// ── Общие условия и выборки ─────────────────────────────────────────────────

/**
 * Опубликовано: `published` ИЛИ (`scheduled` И `publishedAt <= now`).
 * Единое правило видимости статьи — используется также в sitemap (`src/lib/seo/sitemap-sources.ts`).
 */
export function publishedCondition(now: Date): SQL {
  return or(
    eq(articles.status, "published"),
    and(eq(articles.status, "scheduled"), lte(articles.publishedAt, now))
  ) as SQL;
}

/** Свежие сверху; статьи без даты — в конце. */
const NEWEST_FIRST = [sql`${articles.publishedAt} desc nulls last`, desc(articles.createdAt)];

/** Колонки карточки (+ рубрика и активный автор через left join). */
const cardColumns = {
  id: articles.id,
  slug: articles.slug,
  title: articles.title,
  excerpt: articles.excerpt,
  coverMediaId: articles.coverMediaId,
  publishedAt: articles.publishedAt,
  readingMinutes: articles.readingMinutes,
  noindex: articles.noindex,
  rubricSlug: rubrics.slug,
  rubricName: rubrics.name,
  authorName: authors.name,
};

type CardRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverMediaId: string | null;
  publishedAt: Date | null;
  readingMinutes: number;
  noindex: boolean;
  rubricSlug: string | null;
  rubricName: string | null;
  authorName: string | null;
};

/** Неактивные авторы публично не показываются — условие прямо в join. */
const activeAuthorJoin = and(eq(articles.authorId, authors.id), eq(authors.isActive, true));

function cardQuery() {
  return db
    .select(cardColumns)
    .from(articles)
    .leftJoin(rubrics, eq(articles.rubricId, rubrics.id))
    .leftJoin(authors, activeAuthorJoin);
}

/** Теги всех статей страницы одним запросом (без N+1). */
async function tagsByArticleIds(
  ids: string[]
): Promise<Map<string, { slug: string; name: string }[]>> {
  const map = new Map<string, { slug: string; name: string }[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({ articleId: articleTags.articleId, slug: blogTags.slug, name: blogTags.name })
    .from(articleTags)
    .innerJoin(blogTags, eq(blogTags.id, articleTags.tagId))
    .where(inArray(articleTags.articleId, ids))
    .orderBy(asc(blogTags.name));
  for (const row of rows) {
    const list = map.get(row.articleId) ?? [];
    list.push({ slug: row.slug, name: row.name });
    map.set(row.articleId, list);
  }
  return map;
}

/** Строки карточек → view-модели (обложки и теги — по одному запросу на страницу). */
async function toCards(rows: CardRow[]): Promise<ArticleCardView[]> {
  const ids = rows.map((r) => r.id);
  const [media, tags] = await Promise.all([
    loadMedia(rows.map((r) => r.coverMediaId)),
    tagsByArticleIds(ids),
  ]);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt.trim().length > 0 ? r.excerpt : null,
    cover: pickMedia(media, r.coverMediaId),
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    readingMinutes: r.readingMinutes,
    rubric:
      r.rubricSlug !== null && r.rubricName !== null
        ? { slug: r.rubricSlug, name: r.rubricName }
        : null,
    tags: tags.get(r.id) ?? [],
    authorName: r.authorName,
    noindex: r.noindex,
  }));
}

/** Подзапрос «у статьи есть хотя бы один из тегов». */
function hasAnyTag(tagSlugs: string[]): SQL {
  return exists(
    db
      .select({ one: sql`1` })
      .from(articleTags)
      .innerJoin(blogTags, eq(blogTags.id, articleTags.tagId))
      .where(and(eq(articleTags.articleId, articles.id), inArray(blogTags.slug, tagSlugs)))
  );
}

function normalizePage(page: number | undefined): number {
  return Number.isSafeInteger(page) && (page as number) >= 1 ? (page as number) : 1;
}

// ── Списки ──────────────────────────────────────────────────────────────────

/** Страница опубликованных статей (свежие сверху) с фасетами рубрик/тегов/автора и `total`. */
export async function getPublishedArticles(
  opts: GetPublishedArticlesOptions
): Promise<PublishedArticlesPage> {
  "use cache";
  cacheLife(LIST_CACHE);
  cacheTag(TAGS.blog);

  const page = normalizePage(opts.page);
  const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? BLOG_PAGE_SIZE));
  const rubricSlugs = opts.rubricSlugs ?? [];
  const tagSlugs = opts.tagSlugs ?? [];

  const conditions: SQL[] = [publishedCondition(new Date(opts.now))];
  if (rubricSlugs.length > 0) conditions.push(inArray(rubrics.slug, rubricSlugs));
  if (tagSlugs.length > 0) conditions.push(hasAnyTag(tagSlugs));
  if (opts.authorSlug !== undefined) conditions.push(eq(authors.slug, opts.authorSlug));
  const where = and(...conditions);

  const [rows, totals] = await Promise.all([
    cardQuery()
      .where(where)
      .orderBy(...NEWEST_FIRST)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ value: count(articles.id) })
      .from(articles)
      .leftJoin(rubrics, eq(articles.rubricId, rubrics.id))
      .leftJoin(authors, activeAuthorJoin)
      .where(where),
  ]);

  return { items: await toCards(rows), total: totals[0]?.value ?? 0, page, pageSize };
}

/** Избранные опубликованные статьи (`isFeatured`), свежие сверху. */
export async function getFeaturedArticles(limit: number, now: string): Promise<ArticleCardView[]> {
  "use cache";
  cacheLife(LIST_CACHE);
  cacheTag(TAGS.blog);
  const rows = await cardQuery()
    .where(and(publishedCondition(new Date(now)), eq(articles.isFeatured, true)))
    .orderBy(...NEWEST_FIRST)
    .limit(limit);
  return toCards(rows);
}

/** Последние опубликованные статьи (лента, RSS, «Из блога»), кроме `excludeSlug`. */
export async function getRecentArticles(
  n: number,
  now: string,
  excludeSlug?: string
): Promise<ArticleCardView[]> {
  "use cache";
  cacheLife(LIST_CACHE);
  cacheTag(TAGS.blog);
  const conditions: SQL[] = [publishedCondition(new Date(now))];
  if (excludeSlug !== undefined) conditions.push(ne(articles.slug, excludeSlug));
  const rows = await cardQuery()
    .where(and(...conditions))
    .orderBy(...NEWEST_FIRST)
    .limit(n);
  return toCards(rows);
}

/**
 * Похожие статьи: та же рубрика или общие теги, кроме самой статьи. Сортировка —
 * по числу общих тегов, затем по дате. Нет ни рубрики, ни тегов — пустой массив.
 */
export async function getRelatedArticles(
  article: { id: string; rubricSlug: string | null; tagSlugs: string[] },
  now: string,
  limit = 3
): Promise<ArticleCardView[]> {
  "use cache";
  cacheLife(LIST_CACHE);
  cacheTag(TAGS.blog);

  const { rubricSlug, tagSlugs } = article;
  if (rubricSlug === null && tagSlugs.length === 0) return [];

  const affinity: SQL[] = [];
  if (rubricSlug !== null) affinity.push(eq(rubrics.slug, rubricSlug));
  if (tagSlugs.length > 0) affinity.push(hasAnyTag(tagSlugs));

  // Число общих тегов (0, если у исходной статьи тегов нет)
  const sharedTags =
    tagSlugs.length > 0
      ? sql<number>`(select count(*) from ${articleTags} inner join ${blogTags} on ${blogTags.id} = ${articleTags.tagId} where ${articleTags.articleId} = ${articles.id} and ${inArray(blogTags.slug, tagSlugs)})`
      : sql<number>`0`;

  const rows = await cardQuery()
    .where(and(publishedCondition(new Date(now)), ne(articles.id, article.id), or(...affinity)))
    .orderBy(desc(sharedTags), ...NEWEST_FIRST)
    .limit(limit);
  return toCards(rows);
}

/** Рубрики, где есть хотя бы одна опубликованная статья, с их числом. */
export async function getRubricsWithCounts(now: string): Promise<RubricWithCount[]> {
  "use cache";
  cacheLife(LIST_CACHE);
  cacheTag(TAGS.blog);
  const rows = await db
    .select({
      id: rubrics.id,
      slug: rubrics.slug,
      name: rubrics.name,
      imageMediaId: rubrics.imageMediaId,
      count: count(articles.id),
    })
    .from(rubrics)
    .innerJoin(articles, and(eq(articles.rubricId, rubrics.id), publishedCondition(new Date(now))))
    .groupBy(rubrics.id)
    .orderBy(asc(rubrics.sortOrder), asc(rubrics.name));
  const media = await loadMedia(rows.map((r) => r.imageMediaId));
  return rows.map(({ imageMediaId, ...rest }) => ({
    ...rest,
    image: pickMedia(media, imageMediaId),
  }));
}

/** Теги хотя бы одной опубликованной статьи, с их числом. */
export async function getTagsWithCounts(now: string): Promise<TagWithCount[]> {
  "use cache";
  cacheLife(LIST_CACHE);
  cacheTag(TAGS.blog);
  return db
    .select({
      id: blogTags.id,
      slug: blogTags.slug,
      name: blogTags.name,
      count: count(articles.id),
    })
    .from(blogTags)
    .innerJoin(articleTags, eq(articleTags.tagId, blogTags.id))
    .innerJoin(
      articles,
      and(eq(articles.id, articleTags.articleId), publishedCondition(new Date(now)))
    )
    .groupBy(blogTags.id)
    .orderBy(asc(blogTags.name));
}

// ── Отдельные сущности ──────────────────────────────────────────────────────

/** Полная статья по условию (без кэша) — общая часть для публичной страницы и предпросмотра. */
async function selectArticleDetail(where: SQL): Promise<ArticleDetailView | null> {
  const [row] = await db
    .select({
      ...cardColumns,
      body: articles.body,
      showToc: articles.showToc,
      seoTitle: articles.seoTitle,
      seoDescription: articles.seoDescription,
      updatedAt: articles.updatedAt,
      author: {
        id: authors.id,
        slug: authors.slug,
        name: authors.name,
        photoMediaId: authors.photoMediaId,
        roleInClub: authors.roleInClub,
        rank: authors.rank,
        bio: authors.bio,
        sameAs: authors.sameAs,
      },
    })
    .from(articles)
    .leftJoin(rubrics, eq(articles.rubricId, rubrics.id))
    .leftJoin(authors, activeAuthorJoin)
    .where(where)
    .limit(1);
  if (!row) return null;

  const [card] = await toCards([row]);
  if (!card) return null;
  const authorMedia = await loadMedia([row.author?.photoMediaId]);

  return {
    ...card,
    body: row.body,
    showToc: row.showToc,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    updatedAt: row.updatedAt.toISOString(),
    author: row.author
      ? toAuthorView(row.author, pickMedia(authorMedia, row.author.photoMediaId))
      : null,
  };
}

/** Только абсолютные https-ссылки (jsonb мог быть исправлен вручную) */
function safeProfileUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((url): url is string => {
    if (typeof url !== "string") return false;
    try {
      return new URL(url).protocol === "https:";
    } catch {
      return false;
    }
  });
}

function toAuthorView(
  row: {
    id: string;
    slug: string;
    name: string;
    roleInClub: string | null;
    rank: string | null;
    bio: string | null;
    sameAs: string[];
  },
  photo: BlogMedia | null
): AuthorView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    photo,
    roleInClub: row.roleInClub,
    rank: row.rank,
    bio: row.bio,
    sameAs: safeProfileUrls(row.sameAs),
  };
}

/** Опубликованная статья по slug; черновики, будущие `scheduled` и несуществующие → `null`. */
export async function getArticleBySlug(
  slug: string,
  now: string
): Promise<ArticleDetailView | null> {
  "use cache";
  cacheLife(LIST_CACHE);
  cacheTag(TAGS.blog, articleTag(slug));
  return selectArticleDetail(
    and(eq(articles.slug, slug), publishedCondition(new Date(now))) as SQL
  );
}

/**
 * Статья для предпросмотра по id — **без кэша и без фильтра публикации** (черновики
 * и будущие тоже). Вызывать только после проверки подписанного токена.
 */
export async function getArticleForPreview(id: string): Promise<ArticleDetailView | null> {
  return selectArticleDetail(eq(articles.id, id));
}

export async function getRubricBySlug(slug: string): Promise<RubricView | null> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.blog);
  const [row] = await db
    .select({
      id: rubrics.id,
      slug: rubrics.slug,
      name: rubrics.name,
      description: rubrics.description,
      imageMediaId: rubrics.imageMediaId,
    })
    .from(rubrics)
    .where(eq(rubrics.slug, slug))
    .limit(1);
  if (!row) return null;
  const { imageMediaId, ...rest } = row;
  const media = await loadMedia([imageMediaId]);
  return { ...rest, image: pickMedia(media, imageMediaId) };
}

/** Активный автор по slug (неактивный → `null`). */
export async function getAuthorBySlug(slug: string): Promise<AuthorView | null> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.blog);
  const [row] = await db
    .select()
    .from(authors)
    .where(and(eq(authors.slug, slug), eq(authors.isActive, true)))
    .limit(1);
  if (!row) return null;
  const media = await loadMedia([row.photoMediaId]);
  return toAuthorView(row, pickMedia(media, row.photoMediaId));
}

/** Внутренний путь: `/…`, но не протокол-относительный `//host` или `/\host`. */
function isInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

/** `'/blog/old'` → `'/blog/new'` из таблицы `redirects`; только внутренние пути. */
export async function findRedirect(path: string): Promise<string | null> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.blog);
  const [row] = await db
    .select({ toPath: redirects.toPath })
    .from(redirects)
    .where(eq(redirects.fromPath, path))
    .limit(1);
  const target = row?.toPath.trim();
  return target && isInternalPath(target) && target !== path ? target : null;
}
