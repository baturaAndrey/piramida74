"use server";

import { and, eq, ne } from "drizzle-orm";
import { ActionError, adminAction } from "@/lib/admin/action";
import { audit, type DbOrTx } from "@/lib/admin/audit";
import { TAGS } from "@/lib/cache-tags";
import { tournaments } from "@/lib/schema";
import { slugify } from "@/lib/slug";
import { idSchema, togglePublishSchema, tournamentSchema } from "./_schema";

/** varchar(160) в БД; оставляем запас под суффикс «-NN» */
const SLUG_BASE_MAX = 150;
const SLUG_MAX_ATTEMPTS = 20;
const SLUG_FALLBACK = "turnir";
/** Postgres: foreign_key_violation */
const PG_FK_VIOLATION = "23503";

/**
 * Свободный slug: занятый другим турниром получает суффикс `-2`, `-3`… (до 20 попыток),
 * чтобы сохранение не падало из-за совпадения названий туров.
 */
async function uniqueTournamentSlug(tx: DbOrTx, source: string, excludeId?: string) {
  const base = (slugify(source) || SLUG_FALLBACK).slice(0, SLUG_BASE_MAX).replace(/-+$/, "");
  for (let attempt = 1; attempt <= SLUG_MAX_ATTEMPTS; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const sameSlug = eq(tournaments.slug, candidate);
    const [taken] = await tx
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(excludeId ? and(sameSlug, ne(tournaments.id, excludeId)) : sameSlug)
      .limit(1);
    if (!taken) return candidate;
  }
  throw new ActionError("Адрес страницы занят", {
    slug: ["Такой адрес уже занят — укажите другой"],
  });
}

/** Код ошибки Postgres: драйвер кладёт его в `code`, Drizzle оборачивает ошибку в `cause` */
function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

export const saveTournament = adminAction(
  tournamentSchema,
  async (input, ctx) => {
    const { id: inputId, ...rest } = input;
    const values = {
      ...rest,
      // Номер тура имеет смысл только внутри серии
      stageNumber: rest.seriesId ? rest.stageNumber : null,
      description: rest.description || null,
    };
    const slug = await uniqueTournamentSlug(ctx.tx, values.slug || values.title, inputId);
    const after = { ...values, slug };

    if (inputId) {
      const [before] = await ctx.tx
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, inputId))
        .limit(1);
      if (!before) throw new ActionError("Турнир не найден");
      await ctx.tx.update(tournaments).set(after).where(eq(tournaments.id, inputId));
      await audit(
        ctx.userId,
        "tournament.update",
        "tournament",
        inputId,
        { before, after },
        ctx.tx
      );
      return { id: inputId, slug };
    }

    const [row] = await ctx.tx.insert(tournaments).values(after).returning({ id: tournaments.id });
    if (!row) throw new ActionError("Не удалось создать турнир");
    await audit(ctx.userId, "tournament.create", "tournament", row.id, { after }, ctx.tx);
    return { id: row.id, slug };
  },
  { tags: [TAGS.tournaments] }
);

export const togglePublishTournament = adminAction(
  togglePublishSchema,
  async (input, ctx) => {
    const [row] = await ctx.tx
      .update(tournaments)
      .set({ isPublished: input.value })
      .where(eq(tournaments.id, input.id))
      .returning({ id: tournaments.id });
    if (!row) throw new ActionError("Турнир не найден");
    await audit(
      ctx.userId,
      "tournament.toggle",
      "tournament",
      input.id,
      { isPublished: input.value },
      ctx.tx
    );
  },
  { tags: [TAGS.tournaments] }
);

export const deleteTournament = adminAction(
  idSchema,
  async (input, ctx) => {
    let deleted: { id: string; title: string } | undefined;
    try {
      [deleted] = await ctx.tx
        .delete(tournaments)
        .where(eq(tournaments.id, input.id))
        .returning({ id: tournaments.id, title: tournaments.title });
    } catch (error) {
      // Сейчас заявки ссылаются на турнир с ON DELETE SET NULL; перехват — на случай смены FK
      if (pgErrorCode(error) === PG_FK_VIOLATION) {
        throw new ActionError("Нельзя удалить: на турнир есть заявки. Снимите публикацию");
      }
      throw error;
    }
    if (!deleted) throw new ActionError("Турнир не найден");
    await audit(
      ctx.userId,
      "tournament.delete",
      "tournament",
      input.id,
      { before: { title: deleted.title } },
      ctx.tx
    );
  },
  { tags: [TAGS.tournaments] }
);
