# Task 09: Медиа-ядро (хранилище в volume, sharp, отдача /media, Picture)

## Status

complete

## Wave

3

## Description

Подсистема изображений: безопасная проверка загрузки (размер, magic bytes, без SVG), обработка sharp (варианты avif/webp трёх ширин, blur-заглушка), запись файлов в `UPLOAD_DIR`, строка в `media_assets`, безопасная отдача файлов через `GET /media/[...path]` с immutable-кэшем и компонент `<Picture>`. Заменяет стартовый `src/lib/storage.ts` (Vercel Blob) и исправляет уязвимости образца из billiard-darom: path traversal через поле `folder`, перезапись одноимённых файлов, загрузку SVG. Медиатеку и загрузку (`POST/GET /api/admin/media`, страница `/admin/media`, `image-upload-field.tsx`, `media-picker.tsx`) делает задача 14 — **эта задача их не создаёт**; импорт старых фото — задача 15; обе используют `saveImage`.

## Dependencies

**Depends on:** task-01-starter-cleanup-deps.md, task-03-db-schema.md
**Blocks:** task-14-admin-shell.md, task-15-legacy-images-import.md (и через них задачи админки и сайта, показывающие картинки)

**Context from dependencies:**
- Task 01 установил `sharp` и `file-type`, добавил в `src/lib/env.ts` переменную `UPLOAD_DIR` (по умолчанию `./.data/uploads` в dev и `/data/uploads` в prod), выставил `serverActions.bodySizeLimit: '12mb'`, удалил `@vercel/blob`. В `tsconfig.json` строгие флаги (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`).
- Task 03 создал таблицу `mediaAssets` в `src/lib/schema/media.ts`: `id uuid`, `path` (относительно `UPLOAD_DIR`, без расширения и ширины, например `2026/11/<uuid>`), `originalName`, `mime`, `width`, `height`, `size`, `blurDataUrl`, `variants jsonb` (`{ w: number; format: 'avif'|'webp'; file: string }[]`), `alt`, `folder`, `createdBy?`, временные метки. Все внешние ключи на `mediaAssets` имеют `onDelete: 'restrict'`. **Схему не менять.** Экспорт Drizzle — `mediaAssets` (реэкспорт из `@/lib/schema`); тип `MediaAsset = typeof mediaAssets.$inferSelect`.

## Files to Create

- `src/lib/media/validate.ts` — константы лимитов, проверка буфера (magic bytes), санитизация имени и `folder`
- `src/lib/media/process.ts` — обработка sharp: метаданные, варианты, blur
- `src/lib/media/storage.ts` — `getUploadDir`, `resolveMediaPath`, `saveImage`, `deleteMedia`, `findMediaUsages`
- `src/lib/media/url.ts` — изоморфные (без `node:*` импортов) `mediaUrl`, `mediaSrcSet`, типы `MediaVariant`, `PictureAsset`
- `src/app/media/[...path]/route.ts` — отдача файлов
- `src/components/media/picture.tsx` — компонент `<Picture>`

## Files to Modify

- `src/lib/storage.ts` — удалить файл (стартовый Blob/`public/uploads`-код), если на него никто не ссылается (`grep -rn "lib/storage" src`); если ссылки остались в файлах других задач — оставить и указать в отчёте.

## Technical Details

### Implementation Steps

0. **Важно:** модули `src/lib/media/{validate,process,storage}.ts` **не должны** импортировать `server-only`, `next/*`, `next/cache` — их запускают скрипты под `tsx` (задача 15). Путь `@/` под tsx работает (tsconfig paths).

1. **`validate.ts`:**

```ts
import { fileTypeFromBuffer } from "file-type"

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const
export type AllowedMime = (typeof ALLOWED_MIME)[number]

export class MediaValidationError extends Error {
  constructor(message: string, readonly code: "TOO_LARGE" | "BAD_TYPE" | "BAD_IMAGE" | "BAD_FOLDER") {
    super(message)
  }
}

/** Проверка по magic bytes (расширению и client mime НЕ верим). SVG и любые не-растровые типы отклоняются. */
export async function assertImageBuffer(buf: Buffer): Promise<AllowedMime> {
  if (buf.length === 0) throw new MediaValidationError("Пустой файл", "BAD_IMAGE")
  if (buf.length > MAX_IMAGE_BYTES) throw new MediaValidationError("Файл больше 10 МБ", "TOO_LARGE")
  const ft = await fileTypeFromBuffer(buf)
  if (!ft || !(ALLOWED_MIME as readonly string[]).includes(ft.mime)) {
    throw new MediaValidationError("Допустимы только JPEG, PNG, WebP и AVIF", "BAD_TYPE")
  }
  return ft.mime as AllowedMime
}

/** folder — только логическая метка в БД (не часть пути на диске!). */
export function assertFolder(folder: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(folder)) throw new MediaValidationError("Некорректная папка", "BAD_FOLDER")
  return folder
}

export function sanitizeOriginalName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ""
  return base.replace(/[\u0000-\u001f<>:"|?*]/g, "").trim().slice(0, 255) || "image"
}
```

2. **`process.ts`.** Вход — `Buffer`. Шаги:
   - `const img = sharp(buf, { failOn: "error", limitInputPixels: 80_000_000 })`; `const meta = await img.metadata()`; ошибка/отсутствие размеров → `MediaValidationError("Не удалось прочитать изображение", "BAD_IMAGE")`. Анимированные файлы: берётся первый кадр (по умолчанию sharp), это допустимо.
   - Размеры после автоповорота: если `meta.orientation >= 5` поменять `width` и `height` местами. Итоговые `width`/`height` (источник после поворота) пишутся в `media_assets`.
   - Все пайплайны начинаются с `.rotate()` (применяет EXIF-ориентацию; метаданные EXIF/GPS не сохраняются — sharp по умолчанию их вырезает, это важно для приватности).
   - Ширины вариантов: `[640, 1280, 1920].filter((w) => w <= srcW)`; если `srcW < 1920` и `srcW` не входит в список — добавить `srcW` как верхнюю ступень (изображение 500 px → `[500]`, 800 px → `[640, 800]`). Увеличивать запрещено (`withoutEnlargement: true`).
   - Для каждой ширины и формата: `avif` (`{ quality: 55, effort: 4 }`), `webp` (`{ quality: 75 }`). Кодировать последовательно по ширинам (AVIF тяжёлый), форматы одной ширины — `Promise.all`.
   - Blur: `sharp(buf).rotate().resize(16).webp({ quality: 40 }).toBuffer()` → `data:image/webp;base64,<...>`.
   - Результат: `{ width, height, blurDataUrl, variants: { w: number; format: "avif" | "webp"; buffer: Buffer }[] }`.

3. **`storage.ts`:**

```ts
export function getUploadDir(): string {
  const dir = process.env.UPLOAD_DIR ?? (process.env.NODE_ENV === "production" ? "/data/uploads" : "./.data/uploads")
  return path.resolve(dir)
}

/** Превращает относительный путь из URL/БД в абсолютный; при попытке выйти из UPLOAD_DIR бросает Error('INVALID_MEDIA_PATH'). */
export function resolveMediaPath(rel: string): string {
  const root = getUploadDir()
  if (!rel || rel.includes("\0") || rel.includes("\\") || path.isAbsolute(rel) || rel.split("/").some((s) => s === ".." || s === "." || s === "")) {
    throw new Error("INVALID_MEDIA_PATH")
  }
  const abs = path.resolve(root, rel)
  if (!abs.startsWith(root + path.sep)) throw new Error("INVALID_MEDIA_PATH")
  return abs
}
```

   - `saveImage(file: File | Buffer, opts: { folder: string; alt?: string; userId?: string; originalName?: string }): Promise<MediaAsset>`:
     1. буфер из `File` (`Buffer.from(await file.arrayBuffer())`); `originalName = opts.originalName ?? (file instanceof File ? file.name : "image")` → `sanitizeOriginalName`;
     2. `assertFolder(opts.folder)`; `mime = await assertImageBuffer(buf)`;
     3. `processed = await processImage(buf)`;
     4. `id = crypto.randomUUID()`; `now = new Date()`; `path = ${yyyy}/${mm}/${id}` (UTC-год и месяц, месяц двузначный); файлы `<UPLOAD_DIR>/<path>-<w>.<fmt>`. Имя содержит свежий UUID, поэтому перезапись чужих файлов невозможна;
     5. `mkdir(dir, { recursive: true })`, запись каждого варианта (`writeFile` с флагом `wx`);
     6. `insert` в `mediaAssets` (`path`, `originalName`, `mime`, `width`, `height`, `size: buf.length`, `blurDataUrl`, `variants: [{ w, format, file: "<id>-<w>.<fmt>" }]`, `alt: opts.alt ?? ""`, `folder`, `createdBy: opts.userId ?? null`) с `.returning()`;
     7. если запись в БД или файловая запись упала — удалить уже записанные файлы (best-effort) и пробросить ошибку.
     Параметр `originalName` — часть контракта: для `File` по умолчанию `file.name`, для `Buffer` по смыслу обязателен (скрипт импорта, задача 15, передаёт имя исходного файла для идемпотентности); если для `Buffer` не передан — `"image"`.
   - `findMediaUsages(id: string): Promise<MediaUsage[]>` где `MediaUsage = { entity: string; label: string; count: number }`. Две части:
     a. внешние ключи: один раз (кэшировать в переменной модуля) получить из каталога Postgres все FK, ссылающиеся на `media_assets`, и для каждой пары (таблица, колонка) посчитать строки со значением `id`:

```sql
SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype = 'f' AND c.confrelid = 'media_assets'::regclass
```

        Имена таблиц/колонок берутся из каталога, а не от пользователя; подставлять через `sql.identifier(...)` Drizzle. Так список автоматически полон при любых изменениях схемы;
     b. ссылки в markdown: `articles.body` и `promotions.description` — искать подстроку `/media/<asset.path>` (`ILIKE '%' || $1 || '%'` с экранированием `%`, `_`, `\`); в `label` вернуть заголовок статьи/акции (первые 5 найденных строк достаточно, `count` — общее число).
   - `deleteMedia(id: string): Promise<{ ok: true } | { ok: false; reason: "not_found" | "in_use"; usages: MediaUsage[] }>`: найти ассет → `findMediaUsages` → если есть использование, вернуть `in_use`. Иначе в транзакции удалить строку (если сработал FK `restrict`, код Postgres `23503` → вернуть `in_use` с usages), после коммита best-effort удалить все файлы вариантов (`resolveMediaPath(`${asset.path}-${w}.${format}`)`, `ENOENT` игнорировать).

4. **`url.ts` (изоморфный, импорты только типов):**

```ts
export type MediaVariant = { w: number; format: "avif" | "webp"; file: string }
/** Структурный тип: подходит и для строки БД, и для сериализованного объекта из 'use cache'. */
export type PictureAsset = {
  path: string; width: number; height: number; blurDataUrl: string; alt: string; variants: MediaVariant[]
}
export function mediaUrl(asset: Pick<PictureAsset, "path" | "variants">, w?: number, fmt: "avif" | "webp" = "webp"): string
export function mediaSrcSet(asset: Pick<PictureAsset, "path" | "variants">, fmt: "avif" | "webp"): string // "/media/..-640.avif 640w, ..."
```

   `mediaUrl`: без `w` — самый широкий вариант формата; с `w` — ближайший вариант с шириной ≥ `w`, иначе самый широкий; URL = `/media/${asset.path}-${variant.w}.${fmt}`. Если вариантов формата нет — вернуть пустую строку.

5. **`src/app/media/[...path]/route.ts`:**
   - `GET(request, { params })`, `params: Promise<{ path: string[] }>`. Собрать `rel = segments.map(safeDecode).join("/")`, `abs = resolveMediaPath(rel)` в `try/catch` → при `INVALID_MEDIA_PATH` ответ `404`.
   - Разрешены только расширения `.avif` и `.webp` (`Content-Type: image/avif` / `image/webp`); остальное — 404 (даже если файл существует).
   - `stat` → если не файл — 404. Условный запрос: `ETag = W/"<size>-<mtimeMs>"`, при совпадении `If-None-Match` ответ `304`.
   - Тело: `Readable.toWeb(createReadStream(abs)) as ReadableStream`. Заголовки: `Content-Type`, `Content-Length`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`, `ETag`. Ответы 404 без `Cache-Control: immutable`.
   - Не экспортировать `runtime` и `dynamic`: они несовместимы с `cacheComponents`. Чтение `request.headers` делает обработчик динамическим, чтобы он не пререндерился при `next build`.

6. **`picture.tsx`** (серверный компонент без хуков; пригоден и в client-деревьях):

```tsx
type Props = {
  asset: PictureAsset | null | undefined
  sizes: string                 // например "(min-width: 1024px) 50vw, 100vw"
  alt?: string | undefined      // по умолчанию asset.alt
  priority?: boolean            // eager + fetchPriority="high" (LCP, hero)
  className?: string            // классы <img>
  pictureClassName?: string     // классы <picture>
}
```

   Рендерит `null`, если `asset` пуст. Иначе: `<picture><source type="image/avif" srcSet=… sizes=… /><source type="image/webp" … /><img src={mediaUrl(asset, 1280, "webp")} width={asset.width} height={asset.height} alt=… loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" style={{ backgroundImage: `url(${asset.blurDataUrl})`, backgroundSize: "cover" }} className=… /></picture>`. Если `priority`, дополнительно вызвать `preload` из `react-dom` (`{ as: "image", imageSrcSet: mediaSrcSet(asset, "avif"), imageSizes: sizes, fetchPriority: "high", type: "image/avif" }`) — только если вариантов avif не пусто. `alt` по умолчанию пустая строка допустима (декоративное изображение).

7. **Самопроверка (временный скрипт, после проверки удалить):** запустить локальный Postgres с миграциями; временным `tsx`-скриптом вызвать `saveImage(Buffer.from(...), { folder: "test", originalName: "t.jpg" })` с любым jpg; убедиться, что файлы появились в `UPLOAD_DIR/<yyyy>/<mm>/`, строка в БД есть, а `curl -I http://localhost:3000/media/<path>-640.webp` даёт `200`, `cache-control: ... immutable`, `x-content-type-options: nosniff`. Проверить, что `/media/..%2F..%2Fetc/passwd`, `/media/x.svg`, `/media/2026/11/nope-640.webp` дают 404, а загрузка SVG, текстового файла и файла > 10 МБ отклоняется `MediaValidationError`. Затем `deleteMedia(id)` удаляет файлы и строку.

### Code Snippets

Использование потребителями (для справки):

```tsx
<Picture asset={tournament.cover} sizes="(min-width: 1024px) 33vw, 100vw" className="h-full w-full object-cover" />
// route handler POST /api/admin/media (задача 14), file: File из FormData
const asset = await saveImage(file, { folder: "tournaments", alt: "Афиша", userId: session.user.id, originalName: file.name })
// скрипт импорта (задача 15), buf: Buffer
const imported = await saveImage(buf, { folder: "legacy", originalName: "hall-1.jpg" })
```

### Environment Variables

- `UPLOAD_DIR` — каталог загрузок (`/data/uploads` в Docker volume; в dev `./.data/uploads`, каталог должен быть в `.gitignore` и `.dockerignore` — это зона задач 01/04, при отсутствии записи сообщить в отчёте)

### API Endpoints

- `GET /media/[...path]` — отдача `.avif`/`.webp` из `UPLOAD_DIR`; 200 + `Cache-Control: public, max-age=31536000, immutable` + `X-Content-Type-Options: nosniff`; 304 по ETag; 404 для всего остального (traversal, неизвестное расширение, нет файла).

## Acceptance Criteria

- [ ] `saveImage` принимает только jpeg/png/webp/avif до 10 МБ по magic bytes; SVG, PDF, текст, переименованный `.exe` отклоняются с `MediaValidationError`.
- [ ] Для изображения 3000 px создаются варианты 640/1280/1920 в avif и webp (файлы `<uuid>-<w>.<fmt>` в `UPLOAD_DIR/<yyyy>/<mm>/`), для изображения 500 px — один вариант 500 px; увеличения нет; EXIF-поворот применён, метаданные вырезаны.
- [ ] Строка `media_assets` содержит корректные `path`, `width`/`height` (после поворота), `blurDataUrl` (`data:image/webp;base64,…`), `variants`, `folder`, `originalName`, `size`; при сбое записи файлов или БД остатки файлов удаляются.
- [ ] Поле `folder` валидируется regex и не участвует в пути на диске; одноимённые загрузки не перезаписывают друг друга.
- [ ] `resolveMediaPath` отклоняет `..`, абсолютные пути, `\`, нулевой байт; маршрут `/media/...` отвечает 404 на traversal (включая `%2e%2e`), неизвестное расширение и отсутствующий файл.
- [ ] Ответ `/media/...` содержит `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`, корректный `Content-Type`, поддерживает 304.
- [ ] `deleteMedia` возвращает `in_use` со списком использований, если ассет задействован в любой таблице с FK на `media_assets` или упомянут как `/media/<path>` в `articles.body` / `promotions.description`; иначе удаляет строку и все файлы.
- [ ] `<Picture>` рендерит `<picture>` с avif- и webp-`srcset`, `width`/`height`, lazy по умолчанию и eager+`fetchPriority="high"` при `priority`; при пустом `asset` ничего не рендерит.
- [ ] `src/lib/media/{validate,process,storage}.ts` не импортируют `server-only`/`next/*` и запускаются под `tsx`; `url.ts` не импортирует `node:*`.
- [ ] `pnpm lint` и `pnpm typecheck` проходят; `next build` проходит без БД.

## Notes

- `media_assets.path` не содержит ширины и расширения; `mediaUrl` достраивает `-<w>.<fmt>`.
- Оригинал не сохраняется (только варианты) — это экономит место; исходник пользователь хранит у себя.
- Файлы неизменяемы (имя содержит UUID), поэтому `immutable` безопасен. Замена картинки = загрузка нового ассета.
- Тип `PictureAsset` структурный; задача 12 объявляет такую же форму (`PublicMedia`) для своих запросов и не зависит от этого файла на этапе компиляции.
