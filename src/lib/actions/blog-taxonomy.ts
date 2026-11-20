"use server";

import { count, eq, sql } from "drizzle-orm";
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
import { TAGS } from "@/lib/cache-tags";
import { articles, blogTags, rubrics } from "@/lib/schema";
import { slugify } from "@/lib/slug";
import {
  idSchema,
  reorderSchema,
  rubricSchema,
  SLUG_MAX,
  tagInlineSchema,
  tagSchema,
} from "@/lib/validation/blog";

const SLUG_TAKEN = "Адрес занят";

// ── Рубрики ─────────────────────────────────────────────────────────────────

export const saveRubric = adminAction(
  rubricSchema,
  async (data, ctx) => {
    const { tx } = ctx;
    const conflict = await findSlugConflict(tx, "rubric", data.slug, data.id);
    if (conflict) throw new ActionError(SLUG_TAKEN, { slug: [SLUG_CONFLICT_MESSAGES[conflict]] });

    const values = {
      name: data.name,
      slug: data.slug,
      description: data.description,
      imageMediaId: data.imageMediaId ?? null,
    };

    // Адрес рубрики не может оставаться источником редиректа (создание или переименование)
    await releaseRedirectFrom(tx, blogPath(data.slug));

    try {
      if (data.id) {
        const [before] = await tx
          .select()
          .from(rubrics)
          .where(eq(rubrics.id, data.id))
          .for("update");
        if (!before) throw new ActionError("Рубрика не найдена");
        await tx
          .update(rubrics)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(rubrics.id, data.id));
        if (before.slug !== data.slug) {
          await recordSlugRedirect(tx, blogPath(before.slug), blogPath(data.slug));
        }
        await audit(
          ctx.userId,
          "rubric.update",
          "rubric",
          data.id,
          { before: { ...before, createdAt: undefined, updatedAt: undefined }, after: values },
          tx
        );
        return { id: data.id };
      }

      // Новая рубрика — в конец списка
      const [{ next } = { next: 0 }] = await tx
        .select({ next: sql<number>`coalesce(max(${rubrics.sortOrder}) + 1, 0)::int` })
        .from(rubrics);
      const [row] = await tx
        .insert(rubrics)
        .values({ ...values, sortOrder: Number(next) })
        .returning({ id: rubrics.id });
      if (!row) throw new ActionError("Не удалось создать рубрику");
      await audit(ctx.userId, "rubric.create", "rubric", row.id, { after: values }, tx);
      return { id: row.id };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ActionError(SLUG_TAKEN, { slug: [SLUG_CONFLICT_MESSAGES.rubric] });
      }
      throw error;
    }
  },
  { tags: [TAGS.blog], afterCommit: bumpBlogRouteCache }
);

/** Редиректы со старых slug рубрики удаляются вместе с ней — иначе вели бы на 404. */
export const deleteRubric = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const [usage] = await ctx.tx
      .select({ n: count() })
      .from(articles)
      .where(eq(articles.rubricId, id));
    const n = Number(usage?.n ?? 0);
    if (n > 0) {
      throw new ActionError(`В рубрике ${n} ${articlesWord(n)} — сначала перенесите их`);
    }
    const [deleted] = await ctx.tx
      .delete(rubrics)
      .where(eq(rubrics.id, id))
      .returning({ name: rubrics.name, slug: rubrics.slug });
    if (!deleted) throw new ActionError("Рубрика не найдена");
    await dropRedirectsTo(ctx.tx, blogPath(deleted.slug));
    await audit(ctx.userId, "rubric.delete", "rubric", id, { before: deleted }, ctx.tx);
  },
  { tags: [TAGS.blog], afterCommit: bumpBlogRouteCache }
);

export const reorderRubrics = adminAction(
  reorderSchema,
  async ({ ids }, ctx) => {
    for (const [index, id] of ids.entries()) {
      await ctx.tx.update(rubrics).set({ sortOrder: index }).where(eq(rubrics.id, id));
    }
    await audit(ctx.userId, "rubric.reorder", "rubric", "*", { ids }, ctx.tx);
  },
  { tags: [TAGS.blog] }
);

// ── Теги ────────────────────────────────────────────────────────────────────

export const saveTag = adminAction(
  tagSchema,
  async (data, ctx) => {
    const { tx } = ctx;
    const conflict = await findSlugConflict(tx, "tag", data.slug, data.id);
    if (conflict) throw new ActionError(SLUG_TAKEN, { slug: [SLUG_CONFLICT_MESSAGES[conflict]] });
    const values = { name: data.name, slug: data.slug };
    try {
      if (data.id) {
        const [before] = await tx
          .update(blogTags)
          .set(values)
          .where(eq(blogTags.id, data.id))
          .returning({ id: blogTags.id });
        if (!before) throw new ActionError("Тег не найден");
        await audit(ctx.userId, "tag.update", "tag", data.id, { after: values }, tx);
        return { id: data.id, ...values };
      }
      const [row] = await tx.insert(blogTags).values(values).returning({ id: blogTags.id });
      if (!row) throw new ActionError("Не удалось создать тег");
      await audit(ctx.userId, "tag.create", "tag", row.id, { after: values }, tx);
      return { id: row.id, ...values };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ActionError(SLUG_TAKEN, { slug: [SLUG_CONFLICT_MESSAGES.tag] });
      }
      throw error;
    }
  },
  { tags: [TAGS.blog] }
);

/**
 * Создание тега прямо из формы статьи. Имя нормализуется (пробелы, нижний регистр);
 * если тег с таким slug уже есть — возвращается существующий, дубликат не создаётся.
 */
export const createTagInline = adminAction(
  tagInlineSchema,
  async (data, ctx) => {
    const name = data.name.replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
    const slug = slugify(name).slice(0, SLUG_MAX).replace(/-+$/, "");
    if (!slug) {
      throw new ActionError("Название тега должно содержать буквы или цифры", {
        name: ["Название тега должно содержать буквы или цифры"],
      });
    }
    const [inserted] = await ctx.tx
      .insert(blogTags)
      .values({ name, slug })
      .onConflictDoNothing({ target: blogTags.slug })
      .returning({ id: blogTags.id, name: blogTags.name, slug: blogTags.slug });
    if (inserted) {
      await audit(ctx.userId, "tag.create", "tag", inserted.id, { after: { name, slug } }, ctx.tx);
      return { ...inserted, created: true };
    }
    const [existing] = await ctx.tx
      .select({ id: blogTags.id, name: blogTags.name, slug: blogTags.slug })
      .from(blogTags)
      .where(eq(blogTags.slug, slug))
      .limit(1);
    if (!existing) throw new ActionError("Не удалось создать тег");
    return { ...existing, created: false };
  },
  { tags: (_input, r) => (r?.created ? [TAGS.blog] : []) }
);

/** Удаление тега снимает его со всех статей (каскад `article_tags`). */
export const deleteTag = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const [deleted] = await ctx.tx
      .delete(blogTags)
      .where(eq(blogTags.id, id))
      .returning({ name: blogTags.name, slug: blogTags.slug });
    if (!deleted) throw new ActionError("Тег не найден");
    await audit(ctx.userId, "tag.delete", "tag", id, { before: deleted }, ctx.tx);
  },
  { tags: [TAGS.blog] }
);

/** «1 статья», «3 статьи», «5 статей» */
function articlesWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "статья";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "статьи";
  return "статей";
}
