"use server";

import { and, eq, inArray, max, ne } from "drizzle-orm";
import { ActionError, adminAction } from "@/lib/admin/action";
import { audit, type DbOrTx } from "@/lib/admin/audit";
import { TAGS } from "@/lib/cache-tags";
import { tournamentSeries } from "@/lib/schema";
import { slugify } from "@/lib/slug";
import { idSchema, reorderSchema, seriesSchema } from "../_schema";

/** varchar(120) в БД; запас под суффикс «-NN» */
const SLUG_BASE_MAX = 110;
const SLUG_MAX_ATTEMPTS = 20;
const SLUG_FALLBACK = "seriya";

async function uniqueSeriesSlug(tx: DbOrTx, name: string, excludeId?: string) {
  const base = (slugify(name) || SLUG_FALLBACK).slice(0, SLUG_BASE_MAX).replace(/-+$/, "");
  for (let attempt = 1; attempt <= SLUG_MAX_ATTEMPTS; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const sameSlug = eq(tournamentSeries.slug, candidate);
    const [taken] = await tx
      .select({ id: tournamentSeries.id })
      .from(tournamentSeries)
      .where(excludeId ? and(sameSlug, ne(tournamentSeries.id, excludeId)) : sameSlug)
      .limit(1);
    if (!taken) return candidate;
  }
  throw new ActionError("Серия с похожим названием уже есть", {
    name: ["Выберите другое название"],
  });
}

/**
 * Создание/редактирование серии. Slug серии генерируется из названия при создании и
 * не меняется при переименовании (на него могут вести ссылки сайта).
 */
export const saveSeries = adminAction(
  seriesSchema,
  async (input, ctx) => {
    const values = { name: input.name, description: input.description || null };

    if (input.id) {
      const [before] = await ctx.tx
        .select()
        .from(tournamentSeries)
        .where(eq(tournamentSeries.id, input.id))
        .limit(1);
      if (!before) throw new ActionError("Серия не найдена");
      await ctx.tx.update(tournamentSeries).set(values).where(eq(tournamentSeries.id, input.id));
      await audit(
        ctx.userId,
        "tournament_series.update",
        "tournament_series",
        input.id,
        { before, after: values },
        ctx.tx
      );
      return { id: input.id, name: values.name };
    }

    const slug = await uniqueSeriesSlug(ctx.tx, values.name);
    // Новая серия — в конец списка
    const [last] = await ctx.tx
      .select({ value: max(tournamentSeries.sortOrder) })
      .from(tournamentSeries);
    const sortOrder = (last?.value ?? -1) + 1;
    const [row] = await ctx.tx
      .insert(tournamentSeries)
      .values({ ...values, slug, sortOrder })
      .returning({ id: tournamentSeries.id });
    if (!row) throw new ActionError("Не удалось создать серию");
    await audit(
      ctx.userId,
      "tournament_series.create",
      "tournament_series",
      row.id,
      { after: { ...values, slug, sortOrder } },
      ctx.tx
    );
    return { id: row.id, name: values.name };
  },
  { tags: [TAGS.tournaments] }
);

/** Турниры серии остаются без серии (FK `tournaments.series_id` — ON DELETE SET NULL). */
export const deleteSeries = adminAction(
  idSchema,
  async (input, ctx) => {
    const [deleted] = await ctx.tx
      .delete(tournamentSeries)
      .where(eq(tournamentSeries.id, input.id))
      .returning({ id: tournamentSeries.id, name: tournamentSeries.name });
    if (!deleted) throw new ActionError("Серия не найдена");
    await audit(
      ctx.userId,
      "tournament_series.delete",
      "tournament_series",
      input.id,
      { before: { name: deleted.name } },
      ctx.tx
    );
  },
  { tags: [TAGS.tournaments] }
);

export const reorderSeries = adminAction(
  reorderSchema,
  async (input, ctx) => {
    if (new Set(input.ids).size !== input.ids.length) {
      throw new ActionError("Список серий содержит повторы");
    }
    const existing = await ctx.tx
      .select({ id: tournamentSeries.id })
      .from(tournamentSeries)
      .where(inArray(tournamentSeries.id, input.ids));
    if (existing.length !== input.ids.length) {
      throw new ActionError("Список серий устарел. Обновите страницу");
    }
    for (const [index, id] of input.ids.entries()) {
      await ctx.tx
        .update(tournamentSeries)
        .set({ sortOrder: index })
        .where(eq(tournamentSeries.id, id));
    }
    await audit(
      ctx.userId,
      "tournament_series.reorder",
      "tournament_series",
      "*",
      { ids: input.ids },
      ctx.tx
    );
  },
  { tags: [TAGS.tournaments] }
);
