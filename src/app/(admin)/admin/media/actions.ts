"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { ActionError, adminAction, type ActionResult } from "@/lib/admin/action";
import { audit } from "@/lib/admin/audit";
import { TAGS } from "@/lib/cache-tags";
import { deleteMedia, removeMediaFiles, type MediaUsage } from "@/lib/media/storage";
import { mediaAssets } from "@/lib/schema";

const MAX_ALT_LENGTH = 300;

/** alt встроен в кэшируемые данные сайта — сбрасываем все теги, где есть картинки. */
export const updateMediaAlt = adminAction(
  z.object({ id: z.uuid(), alt: z.string().trim().max(MAX_ALT_LENGTH) }),
  async (input, ctx) => {
    const [row] = await ctx.tx
      .update(mediaAssets)
      .set({ alt: input.alt })
      .where(eq(mediaAssets.id, input.id))
      .returning({ id: mediaAssets.id, alt: mediaAssets.alt });
    if (!row) throw new ActionError("Файл не найден");
    await audit(
      ctx.userId,
      "media.update",
      "media",
      input.id,
      { after: { alt: input.alt } },
      ctx.tx
    );
    return row;
  },
  {
    tags: [
      TAGS.galleries,
      TAGS.tournaments,
      TAGS.promotions,
      TAGS.menu,
      TAGS.sets,
      TAGS.services,
      TAGS.blog,
    ],
  }
);

export type DeleteMediaActionResult = { deleted: boolean; usages: MediaUsage[] };

/** Внутренний результат: `files` — пути вариантов для удаления после коммита (клиенту не отдаются). */
type DeleteMediaTxResult = DeleteMediaActionResult & { files: string[] };

/**
 * Удаление записи и аудит — в одной транзакции `ctx.tx`. Используемый файл не удаляется,
 * список использований возвращается в `usages`. Тегов нет: неиспользуемый ассет не попадает
 * в кэшируемые данные сайта.
 */
const deleteMediaInTx = adminAction(
  z.object({ id: z.uuid() }),
  async (input, ctx): Promise<DeleteMediaTxResult> => {
    const result = await deleteMedia(input.id, { tx: ctx.tx });
    if (!result.ok) {
      if (result.reason === "not_found") throw new ActionError("Файл не найден");
      return { deleted: false, usages: result.usages, files: [] };
    }
    await audit(ctx.userId, "media.delete", "media", input.id, undefined, ctx.tx);
    return { deleted: true, usages: [], files: result.files };
  },
  { tags: [] }
);

/**
 * Удаляет неиспользуемый ассет. Файлы вариантов стираются с диска только после того, как
 * `adminAction` закоммитил транзакцию (при откате запись и файлы остаются согласованными).
 */
export async function deleteMediaAction(input: {
  id: string;
}): Promise<ActionResult<DeleteMediaActionResult>> {
  const result = await deleteMediaInTx(input);
  if (!result.ok) return result;
  const { files, ...data } = result.data;
  await removeMediaFiles(files);
  return { ok: true, data };
}
