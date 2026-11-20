"use server";

import { count, eq, sql } from "drizzle-orm";
import { ActionError, adminAction } from "@/lib/admin/action";
import { audit } from "@/lib/admin/audit";
import {
  findSlugConflict,
  isUniqueViolation,
  SLUG_CONFLICT_MESSAGES,
} from "@/lib/blog-admin/queries";
import { TAGS } from "@/lib/cache-tags";
import { articles, authors } from "@/lib/schema";
import { authorSchema, idSchema } from "@/lib/validation/blog";

const SLUG_TAKEN = "Адрес занят";

/** Публичные `/authors/<slug>` и карточки авторов в статьях читаются под тегом `TAGS.blog`. */
export const saveAuthor = adminAction(
  authorSchema,
  async (data, ctx) => {
    const { tx } = ctx;
    const conflict = await findSlugConflict(tx, "author", data.slug, data.id);
    if (conflict) throw new ActionError(SLUG_TAKEN, { slug: [SLUG_CONFLICT_MESSAGES[conflict]] });

    const values = {
      slug: data.slug,
      name: data.name,
      photoMediaId: data.photoMediaId ?? null,
      roleInClub: data.roleInClub,
      rank: data.rank,
      bio: data.bio,
      sameAs: [...new Set(data.sameAs)],
      isActive: data.isActive,
    };

    try {
      if (data.id) {
        const [before] = await tx
          .select()
          .from(authors)
          .where(eq(authors.id, data.id))
          .for("update");
        if (!before) throw new ActionError("Автор не найден");
        await tx
          .update(authors)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(authors.id, data.id));
        const { bio: beforeBio, createdAt: _c, updatedAt: _u, ...beforeRest } = before;
        await audit(
          ctx.userId,
          "author.update",
          "author",
          data.id,
          {
            before: { ...beforeRest, bioLength: beforeBio?.length ?? 0 },
            after: { ...values, bio: undefined, bioLength: values.bio?.length ?? 0 },
          },
          tx
        );
        return { id: data.id };
      }

      const [{ next } = { next: 0 }] = await tx
        .select({ next: sql<number>`coalesce(max(${authors.sortOrder}) + 1, 0)::int` })
        .from(authors);
      const [row] = await tx
        .insert(authors)
        .values({ ...values, sortOrder: Number(next) })
        .returning({ id: authors.id });
      if (!row) throw new ActionError("Не удалось создать автора");
      await audit(
        ctx.userId,
        "author.create",
        "author",
        row.id,
        { after: { ...values, bio: undefined, bioLength: values.bio?.length ?? 0 } },
        tx
      );
      return { id: row.id };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ActionError(SLUG_TAKEN, { slug: [SLUG_CONFLICT_MESSAGES.author] });
      }
      throw error;
    }
  },
  { tags: [TAGS.blog] }
);

/** Автора со статьями удалить нельзя — его можно скрыть («Показывать на сайте»). */
export const deleteAuthor = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const [usage] = await ctx.tx
      .select({ n: count() })
      .from(articles)
      .where(eq(articles.authorId, id));
    const n = Number(usage?.n ?? 0);
    if (n > 0) {
      throw new ActionError(
        `У автора есть статьи (${n}). Снимите «Показывать на сайте» вместо удаления`
      );
    }
    const [deleted] = await ctx.tx
      .delete(authors)
      .where(eq(authors.id, id))
      .returning({ name: authors.name, slug: authors.slug });
    if (!deleted) throw new ActionError("Автор не найден");
    await audit(ctx.userId, "author.delete", "author", id, { before: deleted }, ctx.tx);
  },
  { tags: [TAGS.blog] }
);
