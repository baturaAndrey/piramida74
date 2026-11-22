import { z } from "zod";
import { GALLERY_KEY_MESSAGE, GALLERY_KEY_RE } from "./_lib/labels";

export const GALLERY_TITLE_MAX = 120;
export const GALLERY_TEXT_MAX = 160;
/** Сколько файлов можно добавить за один вызов `addGalleryItems` */
export const GALLERY_ADD_MAX = 50;

export const galleryKeySchema = z.string().regex(GALLERY_KEY_RE, GALLERY_KEY_MESSAGE);

const titleSchema = z
  .string()
  .trim()
  .min(1, "Укажите название")
  .max(GALLERY_TITLE_MAX, `Не длиннее ${GALLERY_TITLE_MAX} символов`);

export const createGallerySchema = z.object({ key: galleryKeySchema, title: titleSchema });
export type CreateGalleryInput = z.input<typeof createGallerySchema>;

export const renameGallerySchema = z.object({ key: galleryKeySchema, title: titleSchema });

export const deleteGallerySchema = z.object({ key: galleryKeySchema });

export const addGalleryItemsSchema = z.object({
  key: galleryKeySchema,
  mediaIds: z.array(z.uuid()).min(1).max(GALLERY_ADD_MAX),
});

export const updateGalleryItemSchema = z.object({
  id: z.uuid(),
  alt: z.string().trim().max(GALLERY_TEXT_MAX, `Не длиннее ${GALLERY_TEXT_MAX} символов`),
  caption: z.string().trim().max(GALLERY_TEXT_MAX, `Не длиннее ${GALLERY_TEXT_MAX} символов`),
});

export const removeGalleryItemSchema = z.object({ id: z.uuid() });

export const reorderGalleryItemsSchema = z.object({
  key: galleryKeySchema,
  ids: z.array(z.uuid()).min(1),
});
