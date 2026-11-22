import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, sortOrder, updatedAt } from "./_common";
import { articleStatusEnum } from "./enums";
import { mediaAssets } from "./media";

/** Авторы-тренеры (бывший expert из billiard-darom) */
export const authors = pgTable("authors", {
  id: id(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  name: text("name").notNull(),
  photoMediaId: uuid("photo_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
  roleInClub: text("role_in_club"),
  rank: text("rank"), // разряд, звание
  bio: text("bio"), // markdown
  sameAs: jsonb("same_as")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  sortOrder: sortOrder(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const rubrics = pgTable("rubrics", {
  id: id(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  imageMediaId: uuid("image_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const blogTags = pgTable("blog_tags", {
  id: id(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const articles = pgTable(
  "articles",
  {
    id: id(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    body: text("body").notNull().default(""), // markdown
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
    authorId: uuid("author_id").references(() => authors.id, { onDelete: "set null" }),
    rubricId: uuid("rubric_id").references(() => rubrics.id, { onDelete: "set null" }),
    isFeatured: boolean("is_featured").notNull().default(false),
    showToc: boolean("show_toc").notNull().default(true),
    status: articleStatusEnum("status").notNull().default("draft"),
    /** Для scheduled/published. Публичная выдача: status in (published, scheduled) and published_at <= now */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    readingMinutes: integer("reading_minutes").notNull().default(1),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    noindex: boolean("noindex").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("articles_status_published_idx").on(t.status, t.publishedAt),
    index("articles_rubric_idx").on(t.rubricId),
    index("articles_author_idx").on(t.authorId),
  ]
);

export const articleTags = pgTable(
  "article_tags",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => blogTags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.tagId] }),
    index("article_tags_tag_idx").on(t.tagId),
  ]
);

/** 301 при смене slug и для старых URL. Проверяется только при промахе страницы */
export const redirects = pgTable(
  "redirects",
  {
    id: id(),
    // fromPath, а не from — зарезервированное слово SQL
    fromPath: text("from_path").notNull().unique(),
    toPath: text("to_path").notNull(),
    code: smallint("code").notNull().default(301),
    createdAt: createdAt(),
  },
  (t) => [check("redirects_code_chk", sql`${t.code} in (301, 302, 307, 308)`)]
);

export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;
export type Rubric = typeof rubrics.$inferSelect;
export type NewRubric = typeof rubrics.$inferInsert;
export type BlogTag = typeof blogTags.$inferSelect;
export type NewBlogTag = typeof blogTags.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type ArticleTag = typeof articleTags.$inferSelect;
export type NewArticleTag = typeof articleTags.$inferInsert;
export type Redirect = typeof redirects.$inferSelect;
export type NewRedirect = typeof redirects.$inferInsert;
