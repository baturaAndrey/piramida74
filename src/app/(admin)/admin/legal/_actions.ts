"use server";

import { createHash } from "node:crypto";
import { and, eq, isNull, like } from "drizzle-orm";
import { ActionError, adminAction } from "@/lib/admin/action";
import { audit, type DbOrTx } from "@/lib/admin/audit";
import { TAGS } from "@/lib/cache-tags";
import { getToday } from "@/lib/dates";
import { legalDocuments } from "@/lib/schema";
import type { LegalDocType } from "@/lib/schema/enums";
import { legalIdSchema, saveLegalDraftSchema } from "./_schema";

/** Больше версий за один день не бывает; защита от бесконечного цикла */
const MAX_VERSIONS_PER_DAY = 99;
/** Postgres: unique_violation (гонка двух одновременных созданий версии) */
const PG_UNIQUE_VIOLATION = "23505";

const ERR_NOT_FOUND = "Документ не найден";
const ERR_PUBLISHED_IMMUTABLE = "Опубликованную версию нельзя изменить";

/** Хэш исходного текста с плейсхолдерами — фиксирует, на что именно дано согласие */
function sha256(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
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

/** Версия `YYYY-MM-DD` (дата в TZ клуба) с суффиксом `-2`, `-3`… при совпадении внутри типа. */
async function nextVersion(tx: DbOrTx, type: LegalDocType): Promise<string> {
  const today = getToday();
  const rows = await tx
    .select({ version: legalDocuments.version })
    .from(legalDocuments)
    .where(and(eq(legalDocuments.type, type), like(legalDocuments.version, `${today}%`)));
  const taken = new Set(rows.map((r) => r.version));
  for (let n = 1; n <= MAX_VERSIONS_PER_DAY; n++) {
    const candidate = n === 1 ? today : `${today}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new ActionError("Слишком много версий за один день");
}

async function findDocument(tx: DbOrTx, id: string) {
  const [row] = await tx
    .select({
      id: legalDocuments.id,
      type: legalDocuments.type,
      version: legalDocuments.version,
      title: legalDocuments.title,
      sha256: legalDocuments.sha256,
      publishedAt: legalDocuments.publishedAt,
    })
    .from(legalDocuments)
    .where(eq(legalDocuments.id, id))
    .limit(1);
  if (!row) throw new ActionError(ERR_NOT_FOUND);
  return row;
}

export type SaveLegalDraftResult = { id: string; version: string; created: boolean };

/** Создаёт новую версию-черновик или обновляет существующий черновик. */
export const saveLegalDraft = adminAction(
  saveLegalDraftSchema,
  async (input, ctx): Promise<SaveLegalDraftResult> => {
    const hash = sha256(input.body);

    if (input.id) {
      const before = await findDocument(ctx.tx, input.id);
      if (before.publishedAt) throw new ActionError(ERR_PUBLISHED_IMMUTABLE);
      // Условие `publishedAt is null` повторяем в UPDATE: защита от гонки с публикацией
      const [row] = await ctx.tx
        .update(legalDocuments)
        .set({ title: input.title, body: input.body, sha256: hash })
        .where(and(eq(legalDocuments.id, before.id), isNull(legalDocuments.publishedAt)))
        .returning({ id: legalDocuments.id });
      if (!row) throw new ActionError(ERR_PUBLISHED_IMMUTABLE);
      await audit(
        ctx.userId,
        "legal_document.update",
        "legal_document",
        before.id,
        {
          before: { title: before.title, sha256: before.sha256 },
          after: { title: input.title, sha256: hash },
        },
        ctx.tx
      );
      return { id: before.id, version: before.version, created: false };
    }

    const version = await nextVersion(ctx.tx, input.type);
    let created: { id: string } | undefined;
    try {
      [created] = await ctx.tx
        .insert(legalDocuments)
        .values({
          type: input.type,
          version,
          title: input.title,
          body: input.body,
          sha256: hash,
          publishedAt: null,
        })
        .returning({ id: legalDocuments.id });
    } catch (error) {
      if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
        throw new ActionError("Версия с таким номером уже создана. Попробуйте ещё раз");
      }
      throw error;
    }
    if (!created) throw new Error("legal_documents insert returned no row");
    await audit(
      ctx.userId,
      "legal_document.create",
      "legal_document",
      created.id,
      { after: { type: input.type, version, title: input.title, sha256: hash } },
      ctx.tx
    );
    return { id: created.id, version, created: true };
  },
  { tags: [TAGS.legal] }
);

/** Публикация: версия становится текущей; дальнейшие изменения запрещены. */
export const publishLegalDocument = adminAction(
  legalIdSchema,
  async (input, ctx) => {
    const before = await findDocument(ctx.tx, input.id);
    if (before.publishedAt) throw new ActionError("Версия уже опубликована");
    const publishedAt = new Date();
    const [row] = await ctx.tx
      .update(legalDocuments)
      .set({ publishedAt })
      .where(and(eq(legalDocuments.id, before.id), isNull(legalDocuments.publishedAt)))
      .returning({ id: legalDocuments.id });
    if (!row) throw new ActionError("Версия уже опубликована");
    await audit(
      ctx.userId,
      "legal_document.publish",
      "legal_document",
      before.id,
      {
        type: before.type,
        version: before.version,
        sha256: before.sha256,
        publishedAt: publishedAt.toISOString(),
      },
      ctx.tx
    );
    return { id: before.id, publishedAt: publishedAt.toISOString() };
  },
  { tags: [TAGS.legal] }
);

/** Удаление разрешено только для черновиков: на опубликованные ссылаются согласия в заявках. */
export const deleteLegalDraft = adminAction(
  legalIdSchema,
  async (input, ctx) => {
    const before = await findDocument(ctx.tx, input.id);
    if (before.publishedAt) throw new ActionError("Опубликованную версию нельзя удалить");
    const [row] = await ctx.tx
      .delete(legalDocuments)
      .where(and(eq(legalDocuments.id, before.id), isNull(legalDocuments.publishedAt)))
      .returning({ id: legalDocuments.id });
    if (!row) throw new ActionError("Опубликованную версию нельзя удалить");
    await audit(
      ctx.userId,
      "legal_document.delete",
      "legal_document",
      before.id,
      { before: { type: before.type, version: before.version, title: before.title } },
      ctx.tx
    );
    return { id: before.id };
  },
  { tags: [TAGS.legal] }
);
