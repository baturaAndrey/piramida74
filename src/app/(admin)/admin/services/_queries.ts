import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { galleries, services } from "@/lib/schema";
import { galleryLabel } from "../galleries/_lib/labels";

export type AdminService = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  bullets: string[];
  priceFrom: number | null;
  priceFromHallKind: string | null;
  priceNote: string;
  ctaType: "booking" | "callback";
  ctaBlock: string;
  galleryKey: string | null;
  isActive: boolean;
};

export type GalleryOption = { key: string; label: string };

export async function listAdminServices(): Promise<AdminService[]> {
  const rows = await db.select().from(services).orderBy(asc(services.sortOrder), asc(services.key));
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    title: row.title,
    subtitle: row.subtitle ?? "",
    bullets: row.bullets,
    priceFrom: row.priceFrom,
    priceFromHallKind: row.priceFromHallKind,
    priceNote: row.priceNote ?? "",
    // Колонка varchar: неизвестное значение трактуем как default, как и публичная выдача
    ctaType: row.ctaType === "callback" ? "callback" : "booking",
    ctaBlock: row.ctaBlock,
    galleryKey: row.galleryKey,
    isActive: row.isActive,
  }));
}

export async function listGalleryOptions(): Promise<GalleryOption[]> {
  const rows = await db
    .select({ key: galleries.key, title: galleries.title })
    .from(galleries)
    .orderBy(asc(galleries.key));
  return rows.map((row) => ({ key: row.key, label: galleryLabel(row.key, row.title) }));
}
