import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { publishedCondition } from "@/lib/queries/blog";
import { articles, authors, rubrics } from "@/lib/schema";

export interface SitemapEntry {
  slug: string;
  updatedAt: Date;
}

export interface BlogSitemapEntries {
  articles: SitemapEntry[];
  rubrics: SitemapEntry[];
  authors: SitemapEntry[];
}

/**
 * Прямые запросы для sitemap.xml без `'use cache'`: карта запрашивается редко,
 * а инвалидация тегами для неё не нужна. Условие публикации — то же, что в публичном
 * блоге (`publishedCondition`), плюс `noindex = false`.
 */
export async function getBlogSitemapEntries(now: Date): Promise<BlogSitemapEntries> {
  const visible = and(publishedCondition(now), eq(articles.noindex, false));
  const [articleRows, rubricRows, authorRows] = await Promise.all([
    db.select({ slug: articles.slug, updatedAt: articles.updatedAt }).from(articles).where(visible),
    // Только рубрики и активные авторы, у которых есть хотя бы одна индексируемая опубликованная статья.
    db
      .selectDistinct({ slug: rubrics.slug, updatedAt: rubrics.updatedAt })
      .from(rubrics)
      .innerJoin(articles, eq(articles.rubricId, rubrics.id))
      .where(visible),
    db
      .selectDistinct({ slug: authors.slug, updatedAt: authors.updatedAt })
      .from(authors)
      .innerJoin(articles, eq(articles.authorId, authors.id))
      .where(and(visible, eq(authors.isActive, true))),
  ]);
  return { articles: articleRows, rubrics: rubricRows, authors: authorRows };
}
