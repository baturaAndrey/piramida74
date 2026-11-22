"use server";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { ActionError, adminAction } from "@/lib/admin/action";
import { audit } from "@/lib/admin/audit";
import {
  findSlugConflict,
  isUniqueViolation,
  SLUG_CONFLICT_MESSAGES,
} from "@/lib/blog-admin/queries";
import {
  blogPath,
  dropRedirectsTo,
  recordSlugRedirect,
  releaseRedirectFrom,
} from "@/lib/blog-admin/redirects";
import { bumpBlogRouteCache } from "@/lib/blog-route/lookup";
import { articleTag, TAGS } from "@/lib/cache-tags";
import { toLocalInputValue } from "@/lib/content/local-datetime";
import { signPreviewToken } from "@/lib/content/preview-token";
import { computeReadingMinutes } from "@/lib/content/reading-time";
import { absoluteUrl } from "@/lib/content/site-url";
import { parseLocalDateTime } from "@/lib/dates";
import { articles, articleTags, type Article } from "@/lib/schema";
import { articleSchema, idSchema, type ArticleValues } from "@/lib/validation/blog";

/** Допуск для «будущей» даты у опубликованной статьи: минуты в инпуте округлены вниз */
const FUTURE_TOLERANCE_MS = 60_000;

const SLUG_TAKEN = "Адрес занят";

type SaveArticleResult = { id: string; slug: string; oldSlug: string | null };

/**
 * `publishedAt` по статусу. Время из формы — всегда Asia/Yekaterinburg (`parseLocalDateTime`).
 * Неизменённая дата существующей статьи сохраняется с точностью до секунды.
 */
function resolvePublishedAt(
  data: ArticleValues,
  existing: Pick<Article, "publishedAt"> | null,
  now: Date
): Date | null {
  if (data.status === "draft") return null;

  const fromInput = (value: string): Date =>
    existing?.publishedAt && toLocalInputValue(existing.publishedAt) === value
      ? existing.publishedAt
      : parseLocalDateTime(value);

  if (data.status === "scheduled") {
    // superRefine схемы гарантирует дату
    const at = fromInput(data.publishAt ?? "");
    if (at <= now) {
      throw new ActionError("Дата публикации в прошлом", {
        publishAt: ["Дата в прошлом. Выберите статус «Опубликована»"],
      });
    }
    return at;
  }

  // Пустая дата: сохраняем прошлую дату публикации, но не будущую (статья была запланирована) — тогда «сейчас»
  const previous = existing?.publishedAt;
  const at = data.publishAt
    ? fromInput(data.publishAt)
    : previous && previous <= now
      ? previous
      : now;
  if (at.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    throw new ActionError("Дата публикации в будущем", {
      publishAt: ["Дата в будущем. Выберите статус «Запланирована»"],
    });
  }
  return at;
}

function bodyFingerprint(body: string): { length: number; sha256: string } {
  return {
    length: body.length,
    sha256: createHash("sha256").update(body).digest("hex").slice(0, 16),
  };
}

type AuditableArticle = Omit<Article, "body" | "createdAt" | "updatedAt"> & { tagIds: string[] };

/** Изменённые поля без тела статьи (вместо него — длина и хэш), чтобы не раздувать журнал. */
function articleDiff(
  before: (AuditableArticle & { body: string }) | null,
  after: AuditableArticle & { body: string }
): Record<string, unknown> {
  const changed: Record<string, { before: unknown; after: unknown }> = {};
  const keys = Object.keys(after) as (keyof AuditableArticle)[];
  for (const key of keys) {
    if (key === "id") continue;
    const a = before?.[key] ?? null;
    const b = after[key] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) changed[key] = { before: a, after: b };
  }
  const diff: Record<string, unknown> = { changed };
  if (!before || before.body !== after.body) {
    diff.body = {
      before: before ? bodyFingerprint(before.body) : null,
      after: bodyFingerprint(after.body),
    };
  }
  return diff;
}

export const saveArticle = adminAction(
  articleSchema,
  async (data, ctx): Promise<SaveArticleResult> => {
    const { tx } = ctx;
    const now = new Date();

    let existing: Article | null = null;
    let existingTagIds: string[] = [];
    if (data.id) {
      // FOR UPDATE: параллельное сохранение той же статьи ждёт коммита (redirect/теги без гонок)
      const [row] = await tx.select().from(articles).where(eq(articles.id, data.id)).for("update");
      if (!row) throw new ActionError("Статья не найдена");
      existing = row;
      const tagRows = await tx
        .select({ tagId: articleTags.tagId })
        .from(articleTags)
        .where(eq(articleTags.articleId, data.id));
      existingTagIds = tagRows.map((t) => t.tagId);
    }

    const conflict = await findSlugConflict(tx, "article", data.slug, data.id);
    if (conflict) {
      throw new ActionError(SLUG_TAKEN, { slug: [SLUG_CONFLICT_MESSAGES[conflict]] });
    }

    const values = {
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt,
      body: data.body,
      coverMediaId: data.coverMediaId ?? null,
      authorId: data.authorId ?? null,
      rubricId: data.rubricId ?? null,
      isFeatured: data.isFeatured,
      showToc: data.showToc,
      status: data.status,
      publishedAt: resolvePublishedAt(data, existing, now),
      readingMinutes: computeReadingMinutes(data.body),
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      noindex: data.noindex,
    };

    let id: string;
    try {
      if (existing) {
        await tx
          .update(articles)
          .set({ ...values, updatedAt: now })
          .where(eq(articles.id, existing.id));
        id = existing.id;
      } else {
        const [row] = await tx.insert(articles).values(values).returning({ id: articles.id });
        if (!row) throw new ActionError("Не удалось создать статью");
        id = row.id;
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ActionError(SLUG_TAKEN, { slug: [SLUG_CONFLICT_MESSAGES.article] });
      }
      throw error;
    }

    const tagIds = [...new Set(data.tagIds)];
    await tx.delete(articleTags).where(eq(articleTags.articleId, id));
    if (tagIds.length > 0) {
      await tx.insert(articleTags).values(tagIds.map((tagId) => ({ articleId: id, tagId })));
    }

    // Адрес статьи не может оставаться источником редиректа (например, от прежнего slug
    // другой статьи или рубрики) — иначе после удаления статьи он снова «оживёт»
    await releaseRedirectFrom(tx, blogPath(data.slug));
    const oldSlug = existing?.slug ?? null;
    if (oldSlug && oldSlug !== data.slug) {
      await recordSlugRedirect(tx, blogPath(oldSlug), blogPath(data.slug));
    }

    const after = { id, ...values, tagIds };
    const before = existing ? { ...existing, tagIds: existingTagIds } : null;
    await audit(
      ctx.userId,
      existing ? "article.update" : "article.create",
      "article",
      id,
      articleDiff(before, after),
      tx
    );

    return { id, slug: data.slug, oldSlug };
  },
  {
    tags: (_input, r) => [
      TAGS.blog,
      articleTag(r.slug),
      ...(r.oldSlug && r.oldSlug !== r.slug ? [articleTag(r.oldSlug)] : []),
    ],
    afterCommit: bumpBlogRouteCache,
  }
);

/**
 * Удаление статьи (теги снимаются каскадом). Редирект не создаётся — адрес отдаёт 404;
 * редиректы со старых slug этой статьи тоже удаляются, чтобы не вести на 404.
 */
export const deleteArticle = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const [deleted] = await ctx.tx
      .delete(articles)
      .where(eq(articles.id, id))
      .returning({ slug: articles.slug, title: articles.title });
    if (!deleted) throw new ActionError("Статья не найдена");
    await dropRedirectsTo(ctx.tx, blogPath(deleted.slug));
    await audit(ctx.userId, "article.delete", "article", id, { before: deleted }, ctx.tx);
    return { slug: deleted.slug };
  },
  {
    tags: (_input, r) => (r ? [TAGS.blog, articleTag(r.slug)] : [TAGS.blog]),
    afterCommit: bumpBlogRouteCache,
  }
);

/**
 * Подписанная ссылка предпросмотра (24 ч). Токен не пишется в журнал — только факт создания.
 */
export const createPreviewLink = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const [row] = await ctx.tx
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);
    if (!row) throw new ActionError("Статья не найдена — сначала сохраните её");
    await audit(ctx.userId, "article.preview_link", "article", id, undefined, ctx.tx);
    return { url: absoluteUrl(`/blog/preview/${id}?t=${signPreviewToken(id)}`) };
  },
  { tags: [] }
);
