import "server-only";
import { and, asc, count, desc, eq, gt, ilike, lte, ne, or, sql, type SQL } from "drizzle-orm";
import type { DbOrTx } from "@/lib/admin/audit";
import { toMediaDto, type MediaDto } from "@/lib/admin/media-dto";
import { TZ } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  articles,
  articleTags,
  authors,
  blogTags,
  mediaAssets,
  rubrics,
  type Article,
  type Author,
} from "@/lib/schema";
import { isReservedBlogSlug, type ArticleStatus, type SlugEntity } from "@/lib/validation/blog";

/**
 * Чтение для админки блога. Без `'use cache'`: страницы админки динамические и должны
 * видеть изменения сразу. Публичные (кэшируемые) запросы — в `src/lib/queries/blog.ts`.
 */

// ── Статусы ─────────────────────────────────────────────────────────────────

export type EffectiveStatus = ArticleStatus | "published_scheduled";

/** `scheduled` с наступившей датой уже виден на сайте — показываем как опубликованную. */
export function effectiveStatus(
  a: { status: ArticleStatus; publishedAt: Date | null },
  now: Date
): EffectiveStatus {
  if (a.status === "scheduled" && a.publishedAt && a.publishedAt <= now) {
    return "published_scheduled";
  }
  return a.status;
}

const listDateFmt = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** «5 дек. 2026 г., 19:00» по Екатеринбургу */
export function formatAdminDateTime(date: Date): string {
  return listDateFmt.format(date);
}

// ── Список статей ──────────────────────────────────────────────────────────

export const ARTICLE_FILTERS = ["all", "draft", "scheduled", "published"] as const;
export type ArticleFilter = (typeof ARTICLE_FILTERS)[number];
export const ARTICLES_PAGE_SIZE = 25;

export function parseArticleFilter(value: string | undefined): ArticleFilter {
  return (ARTICLE_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as ArticleFilter)
    : "all";
}

/** Строка таблицы статей (сериализуемая — уходит в клиентский компонент) */
export type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  rubricName: string | null;
  authorName: string | null;
  status: EffectiveStatus;
  /** Дата публикации (или запланированная) в формате админки; для черновиков — дата изменения */
  dateLabel: string;
  isFeatured: boolean;
  noindex: boolean;
};

/** `%` и `_` в поисковой строке — обычные символы, а не шаблоны LIKE */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function filterCondition(filter: ArticleFilter, now: Date): SQL | undefined {
  switch (filter) {
    case "draft":
      return eq(articles.status, "draft");
    case "scheduled":
      // Только ещё не наступившие: наступившие видны на сайте и попадают в «Опубликованные»
      return and(eq(articles.status, "scheduled"), gt(articles.publishedAt, now));
    case "published":
      return or(
        eq(articles.status, "published"),
        and(eq(articles.status, "scheduled"), lte(articles.publishedAt, now))
      );
    default:
      return undefined;
  }
}

export async function listArticles(p: {
  filter: ArticleFilter;
  q?: string | undefined;
  page: number;
  now: Date;
}): Promise<{ rows: ArticleRow[]; total: number }> {
  const conds: SQL[] = [];
  const statusCond = filterCondition(p.filter, p.now);
  if (statusCond) conds.push(statusCond);
  if (p.q) conds.push(ilike(articles.title, `%${escapeLike(p.q)}%`));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
        status: articles.status,
        publishedAt: articles.publishedAt,
        updatedAt: articles.updatedAt,
        isFeatured: articles.isFeatured,
        noindex: articles.noindex,
        rubricName: rubrics.name,
        authorName: authors.name,
      })
      .from(articles)
      .leftJoin(rubrics, eq(articles.rubricId, rubrics.id))
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .where(where)
      // Черновики (без даты) — сверху по дате изменения, затем свежие публикации
      .orderBy(sql`${articles.publishedAt} desc nulls first`, desc(articles.updatedAt))
      .limit(ARTICLES_PAGE_SIZE)
      .offset((p.page - 1) * ARTICLES_PAGE_SIZE),
    db.select({ total: count() }).from(articles).where(where),
  ]);

  return {
    total: Number(totalRow?.total ?? 0),
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      rubricName: row.rubricName,
      authorName: row.authorName,
      status: effectiveStatus(row, p.now),
      dateLabel: formatAdminDateTime(row.publishedAt ?? row.updatedAt),
      isFeatured: row.isFeatured,
      noindex: row.noindex,
    })),
  };
}

// ── Статья ────────────────────────────────────────────────────────────────

export type ArticleForEdit = {
  article: Article;
  tagIds: string[];
  cover: MediaDto | null;
};

export async function getArticleForEdit(id: string): Promise<ArticleForEdit | null> {
  const [row] = await db
    .select({ article: articles, cover: mediaAssets })
    .from(articles)
    .leftJoin(mediaAssets, eq(articles.coverMediaId, mediaAssets.id))
    .where(eq(articles.id, id))
    .limit(1);
  if (!row) return null;
  const tags = await db
    .select({ tagId: articleTags.tagId })
    .from(articleTags)
    .where(eq(articleTags.articleId, id));
  return {
    article: row.article,
    tagIds: tags.map((t) => t.tagId),
    cover: row.cover ? toMediaDto(row.cover) : null,
  };
}

// ── Справочники для формы статьи ──────────────────────────────────────────

export type Option = { id: string; name: string };
export type TagOption = { id: string; name: string; slug: string };

export async function listRubricOptions(): Promise<Option[]> {
  return db
    .select({ id: rubrics.id, name: rubrics.name })
    .from(rubrics)
    .orderBy(asc(rubrics.sortOrder), asc(rubrics.name));
}

/** Все авторы (в т. ч. скрытые — у старых статей автор мог быть снят с сайта) */
export async function listAuthorOptions(): Promise<(Option & { isActive: boolean })[]> {
  return db
    .select({ id: authors.id, name: authors.name, isActive: authors.isActive })
    .from(authors)
    .orderBy(asc(authors.sortOrder), asc(authors.name));
}

export async function listTagOptions(): Promise<TagOption[]> {
  return db
    .select({ id: blogTags.id, name: blogTags.name, slug: blogTags.slug })
    .from(blogTags)
    .orderBy(asc(blogTags.name));
}

// ── Рубрики, теги, авторы ─────────────────────────────────────────────────

export type RubricRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageMediaId: string | null;
  image: MediaDto | null;
  articlesCount: number;
};

export async function listRubricsWithCounts(): Promise<RubricRow[]> {
  const rows = await db
    .select({
      rubric: rubrics,
      image: mediaAssets,
      articlesCount: sql<number>`(select count(*) from ${articles} where ${articles.rubricId} = ${rubrics.id})::int`,
    })
    .from(rubrics)
    .leftJoin(mediaAssets, eq(rubrics.imageMediaId, mediaAssets.id))
    .orderBy(asc(rubrics.sortOrder), asc(rubrics.name));
  return rows.map(({ rubric, image, articlesCount }) => ({
    id: rubric.id,
    name: rubric.name,
    slug: rubric.slug,
    description: rubric.description,
    imageMediaId: rubric.imageMediaId,
    image: image ? toMediaDto(image) : null,
    articlesCount: Number(articlesCount),
  }));
}

export type TagRow = { id: string; name: string; slug: string; articlesCount: number };

export async function listTagsWithCounts(): Promise<TagRow[]> {
  const rows = await db
    .select({
      id: blogTags.id,
      name: blogTags.name,
      slug: blogTags.slug,
      articlesCount: count(articleTags.articleId),
    })
    .from(blogTags)
    .leftJoin(articleTags, eq(articleTags.tagId, blogTags.id))
    .groupBy(blogTags.id)
    .orderBy(asc(blogTags.name));
  return rows.map((row) => ({ ...row, articlesCount: Number(row.articlesCount) }));
}

export type AuthorRow = {
  id: string;
  name: string;
  slug: string;
  roleInClub: string | null;
  rank: string | null;
  isActive: boolean;
  photo: MediaDto | null;
  articlesCount: number;
};

export async function listAuthorsWithCounts(): Promise<AuthorRow[]> {
  const rows = await db
    .select({
      author: authors,
      photo: mediaAssets,
      articlesCount: sql<number>`(select count(*) from ${articles} where ${articles.authorId} = ${authors.id})::int`,
    })
    .from(authors)
    .leftJoin(mediaAssets, eq(authors.photoMediaId, mediaAssets.id))
    .orderBy(asc(authors.sortOrder), asc(authors.name));
  return rows.map(({ author, photo, articlesCount }) => ({
    id: author.id,
    name: author.name,
    slug: author.slug,
    roleInClub: author.roleInClub,
    rank: author.rank,
    isActive: author.isActive,
    photo: photo ? toMediaDto(photo) : null,
    articlesCount: Number(articlesCount),
  }));
}

export async function getAuthorForEdit(
  id: string
): Promise<{ author: Author; photo: MediaDto | null } | null> {
  const [row] = await db
    .select({ author: authors, photo: mediaAssets })
    .from(authors)
    .leftJoin(mediaAssets, eq(authors.photoMediaId, mediaAssets.id))
    .where(eq(authors.id, id))
    .limit(1);
  if (!row) return null;
  return { author: row.author, photo: row.photo ? toMediaDto(row.photo) : null };
}

export async function countAuthorArticles(authorId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(articles)
    .where(eq(articles.authorId, authorId));
  return Number(row?.n ?? 0);
}

// ── Занятость slug ────────────────────────────────────────────────────────

export type SlugConflict = "reserved" | "article" | "rubric" | "author" | "tag";

/**
 * Причина, по которой slug занят, или `null`, если свободен. Статьи и рубрики делят
 * одно пространство `/blog/<slug>`, поэтому для них проверяются обе таблицы и
 * зарезервированные сегменты. `ignoreId` исключает редактируемую запись своей таблицы.
 */
export async function findSlugConflict(
  tx: DbOrTx,
  entity: SlugEntity,
  slug: string,
  ignoreId?: string
): Promise<SlugConflict | null> {
  const exclude = (idCol: typeof articles.id | typeof rubrics.id, own: SlugEntity) =>
    ignoreId && own === entity ? ne(idCol, ignoreId) : undefined;

  if (entity === "article" || entity === "rubric") {
    if (isReservedBlogSlug(slug)) return "reserved";
    const [article] = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.slug, slug), exclude(articles.id, "article")))
      .limit(1);
    if (article) return "article";
    const [rubric] = await tx
      .select({ id: rubrics.id })
      .from(rubrics)
      .where(and(eq(rubrics.slug, slug), exclude(rubrics.id, "rubric")))
      .limit(1);
    return rubric ? "rubric" : null;
  }

  if (entity === "author") {
    const [author] = await tx
      .select({ id: authors.id })
      .from(authors)
      .where(and(eq(authors.slug, slug), ignoreId ? ne(authors.id, ignoreId) : undefined))
      .limit(1);
    return author ? "author" : null;
  }

  const [tag] = await tx
    .select({ id: blogTags.id })
    .from(blogTags)
    .where(and(eq(blogTags.slug, slug), ignoreId ? ne(blogTags.id, ignoreId) : undefined))
    .limit(1);
  return tag ? "tag" : null;
}

export const SLUG_CONFLICT_MESSAGES: Record<SlugConflict, string> = {
  reserved: "Этот адрес зарезервирован",
  article: "Адрес занят другой статьёй",
  rubric: "Адрес занят рубрикой",
  author: "Адрес занят другим автором",
  tag: "Адрес занят другим тегом",
};

// ── Ошибки БД ─────────────────────────────────────────────────────────────

/** Postgres: unique_violation */
const PG_UNIQUE_VIOLATION = "23505";

/** Нарушение unique-индекса (гонка двух сохранений с одним slug). Drizzle кладёт ошибку драйвера в `cause`. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
    if ("code" in current && current.code === PG_UNIQUE_VIOLATION) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
