"use server";

import { and, asc, eq, inArray, max } from "drizzle-orm";
import { ActionError, adminAction, type ActionCtx } from "@/lib/admin/action";
import { audit } from "@/lib/admin/audit";
import { TAGS } from "@/lib/cache-tags";
import { galleries, galleryItems, mediaAssets, services } from "@/lib/schema";
import { galleryLabel, isSystemGalleryKey } from "./_lib/labels";
import {
  addGalleryItemsSchema,
  createGallerySchema,
  deleteGallerySchema,
  removeGalleryItemSchema,
  renameGallerySchema,
  reorderGalleryItemsSchema,
  updateGalleryItemSchema,
} from "./_schema";

const tags = [TAGS.galleries];

async function findGallery(tx: ActionCtx["tx"], key: string) {
  const [row] = await tx
    .select({ id: galleries.id, key: galleries.key, title: galleries.title })
    .from(galleries)
    .where(eq(galleries.key, key))
    .limit(1);
  return row ?? null;
}

export const createGallery = adminAction(
  createGallerySchema,
  async (input, ctx) => {
    const [row] = await ctx.tx
      .insert(galleries)
      .values({ key: input.key, title: input.title })
      .onConflictDoNothing({ target: galleries.key })
      .returning({ id: galleries.id, key: galleries.key });
    if (!row) {
      throw new ActionError("Галерея с таким ключом уже есть", {
        key: ["Галерея с таким ключом уже есть"],
      });
    }
    await audit(ctx.userId, "gallery.create", "gallery", input.key, { after: input }, ctx.tx);
    return { key: row.key };
  },
  { tags }
);

export const renameGallery = adminAction(
  renameGallerySchema,
  async (input, ctx) => {
    const gallery = await findGallery(ctx.tx, input.key);
    if (!gallery) throw new ActionError("Галерея не найдена");
    if (gallery.title === input.title) return { key: input.key };
    await ctx.tx.update(galleries).set({ title: input.title }).where(eq(galleries.id, gallery.id));
    await audit(
      ctx.userId,
      "gallery.rename",
      "gallery",
      input.key,
      { title: { from: gallery.title, to: input.title } },
      ctx.tx
    );
    return { key: input.key };
  },
  { tags }
);

export const deleteGallery = adminAction(
  deleteGallerySchema,
  async (input, ctx) => {
    if (isSystemGalleryKey(input.key)) throw new ActionError("Системную галерею удалить нельзя");
    const gallery = await findGallery(ctx.tx, input.key);
    if (!gallery) throw new ActionError("Галерея не найдена");

    const linked = await ctx.tx
      .select({ title: services.title })
      .from(services)
      .where(eq(services.galleryKey, input.key))
      .orderBy(asc(services.sortOrder));
    if (linked.length > 0) {
      throw new ActionError(
        `Галерея привязана к услугам: ${linked.map((s) => `«${s.title}»`).join(", ")}. Сначала отвяжите её в разделе «Услуги».`
      );
    }

    // Файлы остаются в медиатеке: удаляются только связи и сама галерея
    const removed = await ctx.tx
      .delete(galleryItems)
      .where(eq(galleryItems.galleryId, gallery.id))
      .returning({ mediaId: galleryItems.mediaId });
    await ctx.tx.delete(galleries).where(eq(galleries.id, gallery.id));
    await audit(
      ctx.userId,
      "gallery.delete",
      "gallery",
      input.key,
      { before: { title: gallery.title, mediaIds: removed.map((r) => r.mediaId) } },
      ctx.tx
    );
    return { key: input.key };
  },
  { tags }
);

export const addGalleryItems = adminAction(
  addGalleryItemsSchema,
  async (input, ctx) => {
    // Системная галерея могла быть не засеяна — создаём строку при первом фото
    await ctx.tx
      .insert(galleries)
      .values({ key: input.key, title: galleryLabel(input.key) })
      .onConflictDoNothing({ target: galleries.key });
    const gallery = await findGallery(ctx.tx, input.key);
    if (!gallery) throw new ActionError("Галерея не найдена");

    const mediaIds = [...new Set(input.mediaIds)];
    const existing = await ctx.tx
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(inArray(mediaAssets.id, mediaIds));
    const existingIds = new Set(existing.map((row) => row.id));
    const validIds = mediaIds.filter((id) => existingIds.has(id));
    if (validIds.length === 0) throw new ActionError("Файлы не найдены в медиатеке");

    const [last] = await ctx.tx
      .select({ value: max(galleryItems.sortOrder) })
      .from(galleryItems)
      .where(eq(galleryItems.galleryId, gallery.id));
    const start = (last?.value ?? -1) + 1;

    // Новые элементы — в конец; уже добавленный файл повторно не вставляется
    const inserted = await ctx.tx
      .insert(galleryItems)
      .values(
        validIds.map((mediaId, index) => ({
          galleryId: gallery.id,
          mediaId,
          sortOrder: start + index,
        }))
      )
      .onConflictDoNothing()
      .returning({ id: galleryItems.id, mediaId: galleryItems.mediaId });

    await audit(
      ctx.userId,
      "gallery.add_items",
      "gallery",
      input.key,
      { mediaIds: inserted.map((row) => row.mediaId) },
      ctx.tx
    );
    return { added: inserted.length, skipped: mediaIds.length - inserted.length };
  },
  { tags }
);

export const updateGalleryItem = adminAction(
  updateGalleryItemSchema,
  async (input, ctx) => {
    const [item] = await ctx.tx
      .select({
        id: galleryItems.id,
        caption: galleryItems.caption,
        mediaId: galleryItems.mediaId,
        alt: mediaAssets.alt,
      })
      .from(galleryItems)
      .innerJoin(mediaAssets, eq(galleryItems.mediaId, mediaAssets.id))
      .where(eq(galleryItems.id, input.id))
      .limit(1);
    if (!item) throw new ActionError("Фото не найдено");

    const caption = input.caption === "" ? null : input.caption;
    const diff: Record<string, { from: string | null; to: string | null }> = {};
    if ((item.caption ?? null) !== caption) {
      await ctx.tx.update(galleryItems).set({ caption }).where(eq(galleryItems.id, item.id));
      diff.caption = { from: item.caption, to: caption };
    }
    // alt хранится у файла медиатеки — меняется везде, где файл используется
    if (item.alt !== input.alt) {
      await ctx.tx
        .update(mediaAssets)
        .set({ alt: input.alt })
        .where(eq(mediaAssets.id, item.mediaId));
      diff.alt = { from: item.alt, to: input.alt };
    }
    if (Object.keys(diff).length > 0) {
      await audit(ctx.userId, "gallery_item.update", "gallery_item", item.id, diff, ctx.tx);
    }
    return { id: item.id };
  },
  // alt файла может показываться и в других разделах сайта
  { tags: [TAGS.galleries, TAGS.services, TAGS.tournaments, TAGS.promotions, TAGS.blog] }
);

export const removeGalleryItem = adminAction(
  removeGalleryItemSchema,
  async (input, ctx) => {
    const [row] = await ctx.tx.delete(galleryItems).where(eq(galleryItems.id, input.id)).returning({
      id: galleryItems.id,
      galleryId: galleryItems.galleryId,
      mediaId: galleryItems.mediaId,
    });
    if (!row) throw new ActionError("Фото уже убрано из галереи");
    await audit(
      ctx.userId,
      "gallery_item.delete",
      "gallery_item",
      row.id,
      { before: { galleryId: row.galleryId, mediaId: row.mediaId } },
      ctx.tx
    );
    return { id: row.id };
  },
  { tags }
);

export const reorderGalleryItems = adminAction(
  reorderGalleryItemsSchema,
  async (input, ctx) => {
    const gallery = await findGallery(ctx.tx, input.key);
    if (!gallery) throw new ActionError("Галерея не найдена");

    const current = await ctx.tx
      .select({ id: galleryItems.id })
      .from(galleryItems)
      .where(eq(galleryItems.galleryId, gallery.id))
      .orderBy(asc(galleryItems.sortOrder), asc(galleryItems.id));
    const currentIds = current.map((row) => row.id);
    const sameSet =
      currentIds.length === input.ids.length &&
      new Set(input.ids).size === input.ids.length &&
      input.ids.every((id) => currentIds.includes(id));
    if (!sameSet) throw new ActionError("Состав галереи изменился — обновите страницу");

    // Последовательно: запросы одной транзакции всё равно идут по одному соединению
    for (const [index, id] of input.ids.entries()) {
      await ctx.tx
        .update(galleryItems)
        .set({ sortOrder: index })
        .where(and(eq(galleryItems.id, id), eq(galleryItems.galleryId, gallery.id)));
    }
    await audit(
      ctx.userId,
      "gallery.reorder",
      "gallery",
      input.key,
      { from: currentIds, to: input.ids },
      ctx.tx
    );
    return { key: input.key };
  },
  { tags }
);
