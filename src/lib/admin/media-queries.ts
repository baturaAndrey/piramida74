import "server-only";
import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { mediaAssets } from "@/lib/schema";
import {
  MEDIA_PAGE_SIZE_DEFAULT,
  MEDIA_PAGE_SIZE_MAX,
  toMediaDto,
  type MediaListResponse,
} from "./media-dto";

export type MediaListParams = {
  q?: string | null;
  folder?: string | null;
  page?: number | undefined;
  pageSize?: number | undefined;
};

const MAX_QUERY_LENGTH = 100;

/** Экранирует спецсимволы LIKE (`\`, `%`, `_`); escape-символ Postgres по умолчанию — `\`. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Страница медиатеки (без кэша): поиск по имени файла и alt, фильтр папки, новые сверху. */
export async function listMedia(params: MediaListParams): Promise<MediaListResponse> {
  const page = clampInt(params.page, 1, Number.MAX_SAFE_INTEGER, 1);
  const pageSize = clampInt(params.pageSize, 1, MEDIA_PAGE_SIZE_MAX, MEDIA_PAGE_SIZE_DEFAULT);
  const q = params.q?.trim().slice(0, MAX_QUERY_LENGTH);
  const folder = params.folder?.trim();

  const conditions: SQL[] = [];
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    const search = or(ilike(mediaAssets.originalName, pattern), ilike(mediaAssets.alt, pattern));
    if (search) conditions.push(search);
  }
  if (folder) conditions.push(eq(mediaAssets.folder, folder));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(mediaAssets)
      .where(where)
      // id — стабильный порядок при одинаковом createdAt (пакетный импорт)
      .orderBy(desc(mediaAssets.createdAt), desc(mediaAssets.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(mediaAssets).where(where),
  ]);

  return {
    items: rows.map(toMediaDto),
    total: totalRows[0]?.value ?? 0,
    page,
    pageSize,
  };
}

/** Папки, в которых есть файлы (для фильтра медиатеки). */
export async function listMediaFolders(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ folder: mediaAssets.folder })
    .from(mediaAssets)
    .orderBy(asc(mediaAssets.folder));
  return rows.map((r) => r.folder);
}
