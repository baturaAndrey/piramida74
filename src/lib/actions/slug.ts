"use server";

import { adminAction } from "@/lib/admin/action";
import { findSlugConflict, SLUG_CONFLICT_MESSAGES } from "@/lib/blog-admin/queries";
import { slugCheckSchema, slugSchema } from "@/lib/validation/blog";

export type SlugAvailability = { available: boolean; reason?: string };

/**
 * Живая проверка slug для `SlugField` (только чтение, без аудита и сброса кэша).
 * Невалидный slug — `{ available: false }` с текстом ошибки, а не исключение:
 * поле опрашивает действие на каждый ввод. Окончательная проверка повторяется
 * при сохранении (гонки) — см. `saveArticle`/`saveRubric`/`saveAuthor`/`saveTag`.
 */
export const checkSlugAvailable = adminAction(
  slugCheckSchema,
  async (input, ctx): Promise<SlugAvailability> => {
    const parsed = slugSchema.safeParse(input.slug);
    if (!parsed.success) {
      return { available: false, reason: parsed.error.issues[0]?.message ?? "Неверный slug" };
    }
    const conflict = await findSlugConflict(ctx.tx, input.entity, parsed.data, input.ignoreId);
    return conflict
      ? { available: false, reason: SLUG_CONFLICT_MESSAGES[conflict] }
      : { available: true };
  },
  { tags: [] }
);
