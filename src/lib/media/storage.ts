// Модуль запускается и под Next, и под tsx (скрипт импорта) — без `server-only` и `next/*`.
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, mediaAssets, promotions, type MediaAsset } from "@/lib/schema";
import { processImage } from "./process";
import {
  assertFolder,
  assertImageBuffer,
  MAX_IMAGE_BYTES,
  MediaValidationError,
  sanitizeOriginalName,
} from "./validate";

export type MediaUsage = { entity: string; label: string; count: number };

export type DeleteMediaResult =
  { ok: true } | { ok: false; reason: "not_found" | "in_use"; usages: MediaUsage[] };

export type SaveImageOptions = {
  /** Логическая метка для медиатеки (не участвует в пути на диске) */
  folder: string;
  alt?: string;
  userId?: string;
  /** Для `File` по умолчанию `file.name`; для `Buffer` следует передавать имя исходного файла */
  originalName?: string;
};

const INVALID_MEDIA_PATH = "INVALID_MEDIA_PATH";
/** `ON DELETE RESTRICT` даёт restrict_violation (23001), `NO ACTION` — foreign_key_violation (23503) */
const PG_REFERENCE_VIOLATION_CODES = new Set(["23503", "23001"]);
/** Сколько заголовков статей/акций показывать в описании использования */
const MARKDOWN_USAGE_LABEL_LIMIT = 5;

/** Человекочитаемые названия таблиц, ссылающихся на media_assets (иначе — имя таблицы). */
const TABLE_LABELS: Record<string, string> = {
  tournaments: "Турниры",
  promotions: "Акции",
  gallery_items: "Галереи",
  authors: "Авторы",
  rubrics: "Рубрики",
  articles: "Статьи",
  menu_items: "Позиции меню",
  banquet_sets: "Банкетные сеты",
};

export function getUploadDir(): string {
  const dir =
    process.env.UPLOAD_DIR ||
    (process.env.NODE_ENV === "production" ? "/data/uploads" : "./.data/uploads");
  // turbopackIgnore: каталог задаётся в рантайме — без пометки Turbopack трассирует
  // весь проект в standalone-сборку маршрута /media
  return path.resolve(/*turbopackIgnore: true*/ dir);
}

/**
 * Превращает относительный путь из URL/БД в абсолютный.
 * При попытке выйти из UPLOAD_DIR бросает Error('INVALID_MEDIA_PATH').
 */
export function resolveMediaPath(rel: string): string {
  const root = getUploadDir();
  if (
    !rel ||
    rel.includes("\0") ||
    rel.includes("\\") ||
    path.isAbsolute(rel) ||
    rel.split("/").some((s) => s === ".." || s === "." || s === "")
  ) {
    throw new Error(INVALID_MEDIA_PATH);
  }
  const abs = path.resolve(root, rel);
  // Вторая линия защиты (например, `C:` в сегменте на Windows)
  if (!abs.startsWith(root + path.sep)) throw new Error(INVALID_MEDIA_PATH);
  return abs;
}

export function isInvalidMediaPathError(error: unknown): boolean {
  return error instanceof Error && error.message === INVALID_MEDIA_PATH;
}

async function removeFilesQuietly(files: string[]): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      try {
        // force: true игнорирует ENOENT
        await rm(file, { force: true });
      } catch (error) {
        console.warn(`[media] не удалось удалить файл ${file}:`, error);
      }
    })
  );
}

/**
 * Проверяет, обрабатывает и сохраняет изображение: варианты пишутся в
 * `<UPLOAD_DIR>/<yyyy>/<mm>/<uuid>-<w>.<fmt>`, метаданные — в `media_assets`.
 * Свежий UUID в имени исключает перезапись существующих файлов.
 */
export async function saveImage(file: File | Buffer, opts: SaveImageOptions): Promise<MediaAsset> {
  const isBuffer = Buffer.isBuffer(file);
  // Размер File известен до чтения — не загружаем в память заведомо слишком большой файл
  if (!isBuffer && file.size > MAX_IMAGE_BYTES) {
    throw new MediaValidationError("Файл больше 10 МБ", "TOO_LARGE");
  }
  const buf =isBuffer ? file : Buffer.from(await file.arrayBuffer());
  const originalName = sanitizeOriginalName(opts.originalName ?? (isBuffer ? "image" : file.name));

  const folder = assertFolder(opts.folder);
  const mime = await assertImageBuffer(buf);
  const processed = await processImage(buf);

  const id = randomUUID();
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const relPath = `${yyyy}/${mm}/${id}`;
  const dir = path.dirname(resolveMediaPath(`${relPath}-0.webp`));

  const written: string[] = [];
  try {
    await mkdir(dir, { recursive: true });
    const variants = [];
    for (const variant of processed.variants) {
      const fileName = `${id}-${variant.w}.${variant.format}`;
      const abs = resolveMediaPath(`${yyyy}/${mm}/${fileName}`);
      // `wx` — падаем, если файл внезапно существует, вместо перезаписи
      await writeFile(abs, variant.buffer, { flag: "wx" });
      written.push(abs);
      variants.push({ w: variant.w, format: variant.format, file: fileName });
    }

    const [asset] = await db
      .insert(mediaAssets)
      .values({
        path: relPath,
        originalName,
        mime,
        width: processed.width,
        height: processed.height,
        size: buf.length,
        blurDataUrl: processed.blurDataUrl,
        variants,
        alt: opts.alt ?? "",
        folder,
        createdBy: opts.userId ?? null,
      })
      .returning();
    if (!asset) throw new Error("Не удалось сохранить запись media_assets");
    return asset;
  } catch (error) {
    await removeFilesQuietly(written);
    throw error;
  }
}

// ── Использование ассета ─────────────────────────────────────────────────────

type ForeignKeyRef = { schemaName: string; tableName: string; columnName: string };

let foreignKeyRefsPromise: Promise<ForeignKeyRef[]> | undefined;

/** Все FK на media_assets из каталога Postgres (кэшируется на процесс). */
function getForeignKeyRefs(): Promise<ForeignKeyRef[]> {
  foreignKeyRefsPromise ??= db
    .execute<{ schema_name: string; table_name: string; column_name: string }>(
      sql`
        SELECT n.nspname AS schema_name, cl.relname AS table_name, a.attname AS column_name
        FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f' AND c.confrelid = 'media_assets'::regclass
        ORDER BY cl.relname, a.attname
      `
    )
    .then((rows) =>
      Array.from(rows, (r) => ({
        schemaName: r.schema_name,
        tableName: r.table_name,
        columnName: r.column_name,
      }))
    )
    .catch((error: unknown) => {
      // Не кэшируем сбой — следующая попытка перечитает каталог
      foreignKeyRefsPromise = undefined;
      throw error;
    });
  return foreignKeyRefsPromise;
}

async function findForeignKeyUsages(id: string): Promise<MediaUsage[]> {
  const refs = await getForeignKeyRefs();
  const counts = await Promise.all(
    refs.map(async (ref) => {
      // Идентификаторы берутся из системного каталога, не от пользователя
      const table = sql`${sql.identifier(ref.schemaName)}.${sql.identifier(ref.tableName)}`;
      const rows = await db.execute<{ count: number }>(
        sql`SELECT count(*)::int AS count FROM ${table} WHERE ${sql.identifier(ref.columnName)} = ${id}`
      );
      const count = Number(rows[0]?.count ?? 0);
      return { ref, count };
    })
  );
  return counts
    .filter(({ count }) => count > 0)
    .map(({ ref, count }) => ({
      entity: ref.tableName,
      label: `${TABLE_LABELS[ref.tableName] ?? ref.tableName} (${ref.columnName})`,
      count,
    }));
}

/** Экранирует спецсимволы LIKE (`\`, `%`, `_`); escape-символ по умолчанию — `\`. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function markdownUsage(
  entity: string,
  prefix: string,
  titles: string[],
  count: number
): MediaUsage | null {
  if (count === 0) return null;
  const more = count > titles.length ? ", …" : "";
  return {
    entity,
    label: `${prefix}: ${titles.map((t) => `«${t}»`).join(", ")}${more}`,
    count,
  };
}

async function findMarkdownUsages(assetPath: string): Promise<MediaUsage[]> {
  const pattern = `%${escapeLike(`/media/${assetPath}`)}%`;

  const [articleRows, articleCount, promoRows, promoCount] = await Promise.all([
    db
      .select({ title: articles.title })
      .from(articles)
      .where(sql`${articles.body} ILIKE ${pattern}`)
      .limit(MARKDOWN_USAGE_LABEL_LIMIT),
    db.$count(articles, sql`${articles.body} ILIKE ${pattern}`),
    db
      .select({ title: promotions.title })
      .from(promotions)
      .where(sql`${promotions.description} ILIKE ${pattern}`)
      .limit(MARKDOWN_USAGE_LABEL_LIMIT),
    db.$count(promotions, sql`${promotions.description} ILIKE ${pattern}`),
  ]);

  return [
    markdownUsage(
      "articles",
      "Текст статей",
      articleRows.map((r) => r.title),
      articleCount
    ),
    markdownUsage(
      "promotions",
      "Описание акций",
      promoRows.map((r) => r.title),
      promoCount
    ),
  ].filter((u): u is MediaUsage => u !== null);
}

/** Где используется ассет: все FK на media_assets + упоминания `/media/<path>` в markdown. */
export async function findMediaUsages(id: string): Promise<MediaUsage[]> {
  const [asset] = await db
    .select({ path: mediaAssets.path })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1);
  const [fkUsages, mdUsages] = await Promise.all([
    findForeignKeyUsages(id),
    asset ? findMarkdownUsages(asset.path) : Promise.resolve([]),
  ]);
  return [...fkUsages, ...mdUsages];
}

/** Код ошибки Postgres; Drizzle может обернуть исходную ошибку в `cause`. */
function pgErrorCode(error: unknown): string | undefined {
  for (let e: unknown = error, depth = 0; e && depth < 3; depth++) {
    if (typeof e === "object" && "code" in e && typeof e.code === "string") return e.code;
    e = typeof e === "object" && "cause" in e ? e.cause : undefined;
  }
  return undefined;
}

/** Удаляет ассет, если он нигде не используется; файлы вариантов — после коммита (best-effort). */
export async function deleteMedia(id: string): Promise<DeleteMediaResult> {
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  if (!asset) return { ok: false, reason: "not_found", usages: [] };

  const usages = await findMediaUsages(id);
  if (usages.length > 0) return { ok: false, reason: "in_use", usages };

  let deleted: { id: string }[];
  try {
    deleted = await db.transaction((tx) =>
      tx.delete(mediaAssets).where(eq(mediaAssets.id, id)).returning({ id: mediaAssets.id })
    );
  } catch (error) {
    // Гонка: ссылка появилась между проверкой и удалением — сработал FK `restrict`
    const code = pgErrorCode(error);
    if (code && PG_REFERENCE_VIOLATION_CODES.has(code)) {
      return { ok: false, reason: "in_use", usages: await findMediaUsages(id) };
    }
    throw error;
  }
  if (deleted.length === 0) return { ok: false, reason: "not_found", usages: [] };

  const files: string[] = [];
  for (const v of asset.variants) {
    try {
      files.push(resolveMediaPath(`${asset.path}-${v.w}.${v.format}`));
    } catch {
      console.warn(`[media] некорректный путь варианта: ${asset.path}-${v.w}.${v.format}`);
    }
  }
  await removeFilesQuietly(files);
  return { ok: true };
}
