# Task 26: Блог в админке: статьи, рубрики, теги, авторы

## Status

pending

## Wave

6

## Description

Раздел «Блог» админки для владельца клуба: список статей с фильтром по статусу, создание и редактирование статьи (Markdown + панель шорткодов + вставка картинок из медиатеки + клиентский предпросмотр + ссылка на подписанный предпросмотр), статусы `draft/scheduled/published` с отложенной публикацией (время вводится в `Asia/Yekaterinburg`), SEO-поля, noindex, теги с созданием «на лету», рубрики, авторы-тренеры. Медиатека (`/admin/media`, `POST/GET /api/admin/media`) принадлежит задаче 14 и здесь не создаётся: блог использует её компоненты `image-upload-field` и `media-picker`. Порт админских компонентов из `billiard-darom` с исправлением найденных там дефектов: запись без транзакций, отсутствие 301 при смене slug, интерпретация `datetime-local` в UTC сервера, общий slug у статей и рубрик без проверки коллизий, нативные `<select>`, небезопасная загрузка обложек (path traversal, SVG). Все действия идут через `adminAction` и сбрасывают кэш тегами `TAGS.blog` и `articleTag(slug)`.

## Dependencies

**Depends on:** task-14-admin-shell.md, task-25-blog-public.md (а транзитивно 03, 08, 09, 12)
**Blocks:** task-28-qa-verification.md

**Context from dependencies:**
- task-14 создала каркас админки: `src/app/(admin)/admin/layout.tsx` (sidebar), общие компоненты `src/components/admin/{data-table,sortable-list,image-upload-field,media-picker,confirm-dialog,form-actions,page-header}.tsx` (`image-upload-field` загружает в `POST /api/admin/media` и возвращает `mediaId`; `media-picker` — выбор из медиатеки), страницу медиатеки `/admin/media` и маршрут `POST/GET /api/admin/media`. Контракты:
  - `src/lib/admin/audit.ts`: `audit(userId: string, action: string, entity: string, entityId: string, diff?: unknown, tx?: DbOrTx): Promise<void>`;
  - `src/lib/admin/action.ts`:
    ```ts
    export type ActionResult<T = void> =
      | { ok: true; data: T }
      | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
    export class ActionError extends Error { constructor(message: string, readonly fieldErrors?: Record<string, string[]>) }
    export type ActionCtx = { userId: string; tx: DbOrTx }
    export function adminAction<S extends z.ZodType, T>(
      schema: S,
      handler: (input: z.output<S>, ctx: ActionCtx) => Promise<T>,
      opts: { tags: string[] | ((input: z.output<S>, result: T) => string[]) },
    ): (input: z.input<S>) => Promise<ActionResult<T>>
    ```
    Порядок: `requireAdminAction()` (ошибка → `{ ok: false, error: 'Нет доступа' }`) → `schema.safeParse` (ошибка → `fieldErrors`) → `db.transaction(tx => handler(input, { userId, tx }))` → после коммита `updateTag` для каждого тега → `{ ok: true, data }`. `ActionError` → `{ ok: false, error, fieldErrors }`. **Аудит пишет сам handler** в той же транзакции: `await audit(ctx.userId, 'article.update', 'article', id, diff, ctx.tx)`; в `ctx` нет `audit`/`user`.
  - task-08 (`src/lib/session.ts`): `requireAdmin()` — для страниц (без админа `redirect('/login')`); `requireAdminAction()` — для Server Actions/route handlers (бросает `Error('UNAUTHORIZED')`). Каждая страница админки первой строкой вызывает `await requireAdmin()`; если понадобится route handler — `try { await requireAdminAction() } catch { return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 }) }`.
- task-25 создала публичную часть блога: `src/lib/content/{markdown,shortcodes,video-url,preview-token,blog-now,format,site-url}.ts`, компоненты `src/components/blog/*` (в т. ч. **синхронный, изоморфный** `ArticleBody`, `VideoEmbed`, `DocumentEmbed`, `Callout`), функции `signPreviewToken(articleId)`/`verifyPreviewToken` и `resolveVideoSource(url)`. Публичные страницы `/blog/[slug]` обслуживают и статьи, и рубрики (одно пространство имён), зарезервированные сегменты `preview` и `rss.xml`. Публикуются статьи со `status='published'` ИЛИ (`status='scheduled'` И `publishedAt <= now`).
- task-12 дала теги кэша `TAGS.blog`, `articleTag(slug)` (`src/lib/cache-tags.ts`).
- task-09 дала `mediaAssets`, `saveImage`, `deleteMedia(id)`, `mediaUrl()`, `<Picture>`; формат файлов — только jpeg/png/webp/avif, SVG запрещён.
- task-06 дала `slugify` (`src/lib/slug.ts`), `TZ`, `parseLocalDateTime(value): Date` (`datetime-local` → момент времени в `Asia/Yekaterinburg`) в `src/lib/dates.ts`.
- task-03: таблицы `articles`, `rubrics`, `blogTags`, `articleTags`, `authors`, `redirects` (`src/lib/schema/content.ts`), `mediaAssets`, `auditLog`. Точные колонки (Drizzle-имена, из `contracts.md`):
  - `authors`: `id`, `slug`, `name`, `photoMediaId?`, `roleInClub?`, `rank?`, `bio?` (markdown), `sameAs` (jsonb `string[]`, default `[]`), `sortOrder`, `isActive`, `createdAt`, `updatedAt`;
  - `rubrics`: `id`, `slug`, `name`, `description?`, `imageMediaId?`, `sortOrder`, `createdAt`, `updatedAt`;
  - `blogTags`: `id`, `slug`, `name`, `createdAt`;
  - `articleTags`: `articleId`, `tagId` (составной PK, `cascade`);
  - `articles`: `id`, `slug`, `title`, `excerpt` (default `''`), `body` (markdown, default `''`), `coverMediaId?`, `authorId?`, `rubricId?`, `isFeatured`, `showToc`, `status` (`article_status`), `publishedAt?` (timestamptz), `readingMinutes`, `seoTitle?`, `seoDescription?`, `noindex`, `createdAt`, `updatedAt`;
  - `redirects`: `id`, `fromPath` (unique), `toPath`, `code` (smallint 301/302/307/308, default 301), `createdAt`.
  FK на `mediaAssets` — `onDelete: 'restrict'`.

## Files to Create

Страницы (`src/app/(admin)/admin/blog/`):
- `articles/page.tsx` — список статей, фильтр по статусу, поиск.
- `articles/new/page.tsx` — создание.
- `articles/[id]/page.tsx` — редактирование.
- `rubrics/page.tsx` — управление рубриками.
- `tags/page.tsx` — управление тегами.
- `authors/page.tsx` — список авторов.
- `authors/new/page.tsx`, `authors/[id]/page.tsx` — форма автора.

Действия и запросы:
- `src/lib/actions/blog-articles.ts` — `saveArticle`, `deleteArticle`, `createPreviewLink`.
- `src/lib/actions/blog-taxonomy.ts` — рубрики и теги (`saveRubric`, `deleteRubric`, `reorderRubrics`, `saveTag`, `createTagInline`, `deleteTag`).
- `src/lib/actions/blog-authors.ts` — `saveAuthor`, `deleteAuthor`.
- `src/lib/actions/slug.ts` — `checkSlugAvailable(entity, slug, ignoreId?)`.
- `src/lib/blog-admin/queries.ts` — чтение для админки (без `'use cache'`; страницы динамические).
- `src/lib/blog-admin/redirects.ts` — запись 301 при смене slug и схлопывание цепочек.
- `src/lib/validation/blog.ts` — zod-схемы (общие для клиента и сервера).
- `src/lib/content/reading-time.ts` — `computeReadingMinutes(body)` + `reading-time.test.ts`.
- `src/lib/content/local-datetime.ts` — `toLocalInputValue(date)` (момент → `YYYY-MM-DDTHH:mm` в `Asia/Yekaterinburg`) + `local-datetime.test.ts`.

Компоненты (`src/components/admin/blog/`):
- `article-form.tsx` — форма статьи (react-hook-form).
- `shortcode-toolbar.tsx` — панель вставок (Видео, Документ, Картинка из медиатеки, Callout, заголовки/жирный/ссылка/список).
- `slug-field.tsx` — slug с транслитерацией и проверкой уникальности.
- `content-preview-button.tsx` — клиентский предпросмотр в модалке.
- `tag-picker.tsx` — мультивыбор тегов + создание «на лету».
- `rubric-manager.tsx`, `tag-manager.tsx` — списки с inline-CRUD.
- `author-form.tsx` — форма автора (+ список `sameAs`).
- `articles-table.tsx` — таблица статей (на базе `data-table`).

Тесты:
- `src/lib/validation/blog.test.ts`, `src/lib/blog-admin/redirects.test.ts` (если вынести чистую часть логики схлопывания цепочек).

## Files to Modify

Нет. `/admin/media`, `/api/admin/media`, `src/lib/admin/*`, `src/components/admin/*` (общие) и `src/app/(admin)/admin/layout.tsx` принадлежат задаче 14 — не менять. Навигацию sidebar (разделы «Блог» и «Медиатека») добавляет задача 14; если пунктов нет — сообщить, не править общий layout.

## Technical Details

### Источники в billiard-darom

Путь: `C:\Users\ba2ra\Documents\__WORKS__\billiard-darom\src`. Читать: `components/admin/{article-form,shortcode-toolbar,slug-field,content-preview-button,rubric-manager,blog-tag-manager}.tsx`, `lib/admin/{content-actions,content-queries,slug-actions}.ts`. Переносить с переработкой.

**Выбросить:** выбор товаров/коллекций/комплектов (`ProductPicker`, `getEmbedPickerData`, `searchProductsForCrossSell`), `reviewedBy` («Проверил»), CMS-страницы, баннеры, промо, меню darom (`createPage`, `createBanner` и т. д.), RBAC-вызовы (`requirePermission`, `sessionHasPermission`), `uploadCoverImage` и `upload(buffer, name, folder)`, `/api/admin/content/preview`.

**Исправить (обязательно):**

| Дефект в darom | Решение |
|---|---|
| `uploadCoverImage(formData)`: `folder` из FormData → path traversal; перезапись одноимённых файлов | обложки и фото авторов грузятся только через `image-upload-field` (task 14) → `POST /api/admin/media` → `saveImage`; в статье хранится `coverMediaId` (uuid), а не путь |
| SVG-загрузки | запрещены на уровне `saveImage` (task 09); в форме `accept="image/jpeg,image/png,image/webp,image/avif"` |
| `datetime-local` читался как UTC сервера (`new Date(str)`) | `parseLocalDateTime(value)` из `src/lib/dates.ts`; для отображения — `toLocalInputValue` |
| Нет отложенной публикации | статус `scheduled` + дата; в списке «Запланирована на …» |
| `replaceArticleTags` без транзакции; запись статьи и тегов раздельно | всё в одной транзакции `adminAction` (`tx`) |
| Нет 301 при смене slug | запись в `redirects` (см. ниже) |
| `revalidateTag(…, 'max')` в Server Action | в Server Actions — `updateTag` (его делает `adminAction` по `tags`; для `articleTag(slug)` — см. ниже) |
| Slug статьи и рубрики в одном `/blog/<slug>`, но проверялась уникальность только внутри таблицы | `checkSlugAvailable` проверяет **обе** таблицы + зарезервированные `preview`, `rss.xml` |
| Нативные `<select>`, `<input type=checkbox>` | shadcn `Select`, `Checkbox`, `Switch` |
| SEO-поля не редактировались | поля `seoTitle`, `seoDescription`, `noindex` |
| `reviewedBy`, `expert` вместо автора | только `authorId` (тренеры клуба) |
| Предпросмотр через серверный `/api/admin/content/preview` | клиентский рендер `ArticleBody` в модалке + ссылка на серверный подписанный предпросмотр |

### Implementation Steps

1. **Прочитать:** `src/components/admin/{data-table,image-upload-field,media-picker,page-header,form-actions,confirm-dialog}.tsx` (их пропсы), `src/lib/schema/content.ts`, `src/lib/cache-tags.ts`, `src/lib/content/{shortcodes,video-url,preview-token}.ts`, `src/components/blog/article-body.tsx`, `DESIGN.md`. Если какого-то shadcn-компонента нет (`select`, `checkbox`, `switch`, `textarea`, `popover`, `command`, `tabs`, `dialog`, `form`, `badge`, `calendar`, `skeleton`) — не устанавливать, сообщить.

2. **Валидация `src/lib/validation/blog.ts`** (zod 4; используется и RHF-резолвером на клиенте, и в actions):

```ts
import { z } from 'zod'

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const RESERVED_BLOG_SLUGS = ['preview', 'rss.xml'] as const // «rss.xml» не пройдёт и по SLUG_RE; держим для явной ошибки

export const slugSchema = z
  .string().trim().min(1, 'Укажите slug').max(120)
  .regex(SLUG_RE, 'Slug: латиница, цифры и дефис')
  .refine((s) => !(RESERVED_BLOG_SLUGS as readonly string[]).includes(s), 'Этот slug зарезервирован')

export const articleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Укажите заголовок').max(200),
  slug: slugSchema,
  excerpt: z.string().trim().max(400).default(''), // колонка not null, default ''
  body: z.string().max(200_000).default(''),
  coverMediaId: z.string().uuid().nullish(),
  authorId: z.string().uuid().nullish(),
  rubricId: z.string().uuid().nullish(),
  tagIds: z.array(z.string().uuid()).max(30).default([]),
  isFeatured: z.boolean().default(false),
  showToc: z.boolean().default(true),
  status: z.enum(['draft', 'scheduled', 'published']),
  /** значение <input type="datetime-local"> (в Asia/Yekaterinburg), '' или null */
  publishAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).or(z.literal('')).nullish(),
  seoTitle: z.string().trim().max(70).nullish().transform((v) => v || null),
  seoDescription: z.string().trim().max(200).nullish().transform((v) => v || null),
  noindex: z.boolean().default(false),
}).superRefine((v, ctx) => {
  if (v.status === 'scheduled' && !v.publishAt) {
    ctx.addIssue({ code: 'custom', path: ['publishAt'], message: 'Укажите дату и время публикации' })
  }
})
```

   Аналогично `rubricSchema` (`id?`, `name`, `slug`, `description?`, `imageMediaId?`), `tagSchema` (`id?`, `name`, `slug`), `authorSchema` (`id?`, `slug`, `name`, `photoMediaId?`, `roleInClub?`, `rank?`, `bio?`, `sameAs: z.array(z.url()).max(10)` — только `https://`, `isActive: z.boolean().default(true)`).

3. **Время и статусы.** При сохранении:
   - `draft`: `publishedAt` = `null` (если ранее был опубликован и возвращается в черновик — тоже `null`, статья пропадёт с сайта; показать подтверждение в UI);
   - `scheduled`: `publishedAt = parseLocalDateTime(publishAt)`; если момент в прошлом → ошибка поля «Дата в прошлом. Выберите статус «Опубликована»»;
   - `published`: `publishedAt = publishAt ? parseLocalDateTime(publishAt) : (существующая publishedAt ?? new Date())`; будущая дата при `published` недопустима → ошибка (использовать `scheduled`).
   - Новая статья без даты и со статусом `published` получает `now`.
   Хелпер `toLocalInputValue(d: Date): string` (в `src/lib/content/local-datetime.ts`) формирует `YYYY-MM-DDTHH:mm` по `Asia/Yekaterinburg`, например через `Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' })` и замену пробела на `T`. Тест: UTC `2026-12-05T14:00:00Z` → `2026-12-05T19:00`; граница даты (UTC 21:00 → следующий день в UTC+5); round-trip `parseLocalDateTime(toLocalInputValue(d))` равен `d` с точностью до минуты.

4. **Время чтения.** `computeReadingMinutes(body)`: убрать шорткоды `{{…}}`, fenced-код, URL картинок и разметку (`#`, `*`, `_`, `>`, `|`, ```` ` ````), посчитать слова по `/[\p{L}\p{N}]+/gu`, `Math.max(1, Math.ceil(words / 200))`. Тест: пусто → 1; 200 слов → 1; 201 → 2; шорткоды не считаются. Значение пишется в `readingMinutes` при каждом сохранении.

5. **Server Actions** (`'use server'`, все через `adminAction`). Пример статьи:

```ts
'use server'
import { adminAction, ActionError } from '@/lib/admin/action'
import { audit } from '@/lib/admin/audit'
import { TAGS, articleTag } from '@/lib/cache-tags'
import { articleSchema } from '@/lib/validation/blog'
import { parseLocalDateTime } from '@/lib/dates'
import { recordSlugRedirect } from '@/lib/blog-admin/redirects'

export const saveArticle = adminAction(
  articleSchema,
  async (data, ctx) => {
    const { tx } = ctx
    // 1. slug свободен среди статей И рубрик (+ зарезервированные); self исключается по data.id (иначе throw new ActionError(..., { slug: [...] }))
    // 2. publishedAt по правилам п.3
    // 3. readingMinutes = computeReadingMinutes(data.body)
    // 4. INSERT/UPDATE articles (+ updatedAt = now)
    // 5. replace tags: tx.delete(articleTags).where(eq(articleTags.articleId, id)); tx.insert(articleTags).values(дедуп tagIds → { articleId, tagId })
    // 6. если slug существующей статьи изменился: recordSlugRedirect(tx, `/blog/${oldSlug}`, `/blog/${data.slug}`)
    // 7. await audit(ctx.userId, data.id ? 'article.update' : 'article.create', 'article', id, diff, tx)
    // 8. вернуть { id, slug: data.slug, oldSlug }
  },
  {
    tags: (_input, r) => [
      TAGS.blog,
      articleTag(r.slug),
      ...(r.oldSlug && r.oldSlug !== r.slug ? [articleTag(r.oldSlug)] : []),
    ],
  },
)
```

   **Теги кэша.** `adminAction` принимает `tags` как функцию `(input, result) => string[]` и сам вызывает `updateTag` после коммита — сбрасываются `TAGS.blog` и `articleTag(slug)` для нового **и** старого slug. Вручную `updateTag`/`revalidateTag` не вызывать.
   - `deleteArticle({ id })`: удаляет статью (каскад `articleTags`), возвращает `{ slug }`, `tags: (_i, r) => [TAGS.blog, articleTag(r.slug)]`; **не** создаёт redirect (удалённая статья отдаёт 404). Подтверждение через `confirm-dialog`. В handler: `await audit(ctx.userId, 'article.delete', 'article', id, { before: { slug, title } }, ctx.tx)`.
   - `createPreviewLink({ id })`: `adminAction` без записи в БД (`tags: []`): возвращает `${NEXT_PUBLIC_SITE_URL}/blog/preview/${id}?t=${signPreviewToken(id)}`; токен не логируется и не пишется в `auditLog` (в аудит — только факт создания ссылки: `await audit(ctx.userId, 'article.preview_link', 'article', id, undefined, ctx.tx)`).
   - Аудит — всегда внутри handler: `await audit(ctx.userId, 'article.create'|'article.update'|'article.delete', 'article', id, diff, ctx.tx)` (diff без тела статьи — только изменённые поля и размер/хэш `body`, чтобы не раздувать журнал). Так же для рубрик (`rubric.*`), тегов (`tag.*`), авторов (`author.*`).

6. **Редиректы `src/lib/blog-admin/redirects.ts`** (функция принимает `tx`):

```ts
export async function recordSlugRedirect(tx: DbOrTx, fromPath: string, toPath: string) {
  if (fromPath === toPath) return
  // 1) Любые редиректы, ведущие на старый путь, перенаправить на новый (нет цепочек a→b→c):
  //    tx.update(redirects).set({ toPath }).where(eq(redirects.toPath, fromPath))
  // 2) Если существует редирект С нового пути (возврат к прежнему slug) — удалить его (иначе петля):
  //    tx.delete(redirects).where(eq(redirects.fromPath, toPath))
  // 3) Upsert по fromPath: tx.insert(redirects).values({ fromPath, toPath, code: 301 })
  //    .onConflictDoUpdate({ target: redirects.fromPath, set: { toPath, code: 301 } })
}
```

   Для рубрик — те же правила (`/blog/<old>` → `/blog/<new>`). Тест на чистой части (схлопывание цепочек, возврат к старому slug, одинаковые пути).

7. **Slug.** `checkSlugAvailable({ entity: 'article' | 'rubric' | 'author' | 'tag', slug, ignoreId? })` — `adminAction(schema, handler, { tags: [] })` (только чтение через `ctx.tx`, без аудита): zod-валидация slug (иначе `{ available: false }`), для `article` и `rubric` проверяет **обе таблицы** (`articles.slug`, `rubrics.slug`) и зарезервированные; `author` — `authors.slug`; `tag` — `blogTags.slug`. `ignoreId` исключает редактируемую запись. Для надёжности запись всё равно проверяется заново внутри `saveArticle`/`saveRubric` (гонки) + unique-индексы БД — перехватить нарушение и вернуть понятную ошибку поля.
   - `slug-field.tsx`: порт из darom (`slugify` из `src/lib/slug.ts`, связка «slug следует за заголовком, пока не отредактирован вручную», дебаунс 350 мс, защита от устаревших ответов по счётчику запросов, статусы «проверяем / свободен / занят»). При редактировании существующей статьи поле «отвязано» по умолчанию, плюс предупреждение «Смена slug создаст 301-редирект со старого адреса».

8. **Форма статьи `article-form.tsx`** (`'use client'`, react-hook-form + `zodResolver(articleSchema)`; компоненты shadcn `Form`, `Input`, `Textarea`, `Select`, `Checkbox`/`Switch`):
   - Блок «Основное»: заголовок, slug (`SlugField`), рубрика (`Select`, «— без рубрики —»), автор (`Select`), краткое описание (`excerpt`, счётчик до 400).
   - **Статус** — `Select`: «Черновик», «Запланирована», «Опубликована». Поле «Дата и время публикации» (`<Input type="datetime-local">`) показывается для `scheduled` и `published`; подпись «Время по Екатеринбургу (UTC+5)». Для опубликованных, дата которых уже прошла, поле показывает фактическую дату.
   - **Обложка:** `ImageUploadField` (task 14) → `coverMediaId`; подпись про alt (alt задаётся в медиатеке).
   - **Теги:** `TagPicker` (бейджи-переключатели, поиск, поле «Новый тег» + кнопка → `createTagInline(name)` возвращает `{id,name,slug}`, новый тег сразу выбирается).
   - **Тумблеры:** «Рекомендуемая (блок «Рекомендуем»)» (`isFeatured`), «Авто-оглавление» (`showToc`), «Не индексировать (noindex)».
   - **SEO** (сворачиваемая секция): `seoTitle` (подсказка 50–60 символов), `seoDescription` (до 160), превью сниппета (заголовок/URL/описание) — необязательно.
   - **Текст:** `ShortcodeToolbar` + `Textarea` (моноширинный, `min-h-[24rem]`, `ref`) + `ContentPreviewButton`. Горячая клавиша Ctrl/Cmd+S сохраняет.
   - Кнопки: «Сохранить» (остаётся на странице, toast), «Сохранить и закрыть», «Открыть подписанный предпросмотр» (вызывает `createPreviewLink`, открывает в новой вкладке; доступно только у уже сохранённой статьи, у несохранённых изменений — предупреждение «Сначала сохраните»), «Удалить».
   - Предупреждение о несохранённых изменениях при уходе (`beforeunload` + `form.formState.isDirty`).
   - Ошибки сервера (`fieldErrors`) отображаются у полей через `form.setError`; общая ошибка — алерт сверху.

9. **`shortcode-toolbar.tsx`** (порт с сокращением): строка кнопок над textarea. Принимает `value`, `onChange`, `targetRef`; вставка в позицию курсора (`selectionStart/End`, восстановление каретки через `requestAnimationFrame`) — функция `spliceAtCursor` как в darom. Кнопки:
   - `H2`, `H3`, **Ж**, *К*, «Список», «Ссылка» — обёртка выделенного текста Markdown-разметкой;
   - **«Картинка из медиатеки»** — открывает `MediaPicker` (task 14), вставляет `![alt](/media/<path>-1280.webp)` (URL строить через `mediaUrl(asset, 1280, 'webp')`; alt берётся из `asset.alt`, а если пуст — из имени файла без расширения);
   - **«Видео»** — диалог с полем URL; перед вставкой `resolveVideoSource(url)`: если `null` — ошибка «Поддерживаются VK Видео и Rutube (vk.ru, vkvideo.ru, vk.com, rutube.ru)»; вставляет `{{Видео: <url>}}`;
   - **«Документ»** — диалог: URL (`/media/...` или `https://`) и подпись → `{{Документ: <url> | <подпись>}}`; другие схемы отклоняются;
   - **«Врезка»** — 4 варианта (`info/success/warning/accent`): оборачивает выделенное в `:::info … :::` (с пустыми строками вокруг маркеров).
   Выбросить всё про товары/коллекции/комплекты/подборки.

10. **`content-preview-button.tsx`** — кнопка «Предпросмотр»: открывает `Dialog` (`sm:max-w-3xl`, `max-h-[85vh] overflow-y-auto`) и **на клиенте** рендерит `<ArticleBody body={getSource()} withToc={showToc} />` (компонент из task 25 изоморфный). Заголовок модалки «Предпросмотр (может отличаться от финальной страницы)». Шорткоды видео/документов отрисовываются настоящими `VideoEmbed`/`DocumentEmbed`. Пустой текст → `toast.info`. Никаких запросов на сервер.

11. **Списки и страницы.**
    - `articles/page.tsx`: `await requireAdmin()`; `PageHeader` («Статьи», кнопка «Новая статья»); фильтр статуса (`Tabs`/`Select`: Все / Черновики / Запланированные / Опубликованные; сохраняется в `?status=`, читать через `searchParams`), поиск по заголовку (`?q=`), пагинация по 25. Таблица (`data-table`): заголовок (ссылка на редактирование), рубрика, автор, статус-бейдж, дата, просмотр. Эффективный статус: `scheduled` с `publishedAt <= now` показывать как «Опубликована (по расписанию)»; `scheduled` в будущем — «Запланирована на 5 дек, 19:00». Кнопка «Открыть на сайте» для опубликованных (`/blog/<slug>`).
    - `articles/new` и `articles/[id]`: серверная страница грузит рубрики, авторов, теги (`blog-queries.ts`), для редактирования — статью, подставляет `publishAt = toLocalInputValue(publishedAt)`; несуществующий id → `notFound()`.
    - `rubrics/page.tsx`: `RubricManager` — таблица/список с inline-редактированием (`name`, `slug` через `SlugField` с проверкой, `description`, изображение через `ImageUploadField` → `imageMediaId`), создание, удаление (запрещено, если есть статьи: сообщение «В рубрике N статей — сначала перенесите их»), порядок (`SortableList` из task 14 → `reorderRubrics`, пишет `rubrics.sortOrder`). Смена slug рубрики пишет редирект так же, как у статьи.
    - `tags/page.tsx`: `TagManager` — список с числом статей, создание, переименование, удаление (с подтверждением; удаление тега снимает его со статей — каскад).
    - `authors/*`: список (фото, имя, роль, число статей) и форма автора: `name`, `slug` (`SlugField` + проверка), `photo` (`ImageUploadField` → `photoMediaId`), `roleInClub`, `rank`, `bio` (Textarea), `sameAs` — динамический список ссылок (`useFieldArray`, только `https://`, до 10), `isActive` (`Switch` «Показывать на сайте»). Удаление: если у автора есть статьи — запретить с сообщением (предложить снять «Показывать на сайте»).
    - После изменений рубрик/тегов/авторов сбрасывать `TAGS.blog`; при смене slug автора — публичные страницы `/authors/<slug>` читаются тем же тегом (`TAGS.blog`).

12. **Медиатека** — не в этой задаче: страница `/admin/media` и `POST/GET /api/admin/media` принадлежат задаче 14. Блог использует только `ImageUploadField` (обложка, фото автора, изображение рубрики → `mediaId`) и `MediaPicker` (вставка картинки в Markdown). Своих маршрутов загрузки и страниц медиатеки не создавать. Если медиатеке задачи 14 нужна проверка использования файла в `articles.body` — сообщить в отчёте, а не реализовывать здесь.

13. **Права и безопасность.** Все страницы: `await requireAdmin()` в начале; все действия через `adminAction`. Входные идентификаторы проверяются zod (`uuid`). `createTagInline` ограничивает длину имени и нормализует регистр (дубликаты по `slug` не создаются — возвращается существующий тег). Тело статьи сохраняется как есть (санитизация происходит при рендере: нет `rehype-raw`, URL ограничены в задаче 25). Не логировать preview-токены и тексты статей.

14. **Тесты (Vitest):** `reading-time.test.ts`, `local-datetime.test.ts`, `blog.test.ts` (zod: slug-регэксп, зарезервированные, `scheduled` без даты, `sameAs` только https), `redirects.test.ts`. Интеграция с БД и UI — в e2e задачи 28 (публикация статьи).

### Code Snippets

Часовой пояс — единственная точка конверсии:

```ts
// сервер: из формы в момент времени
const publishedAt = data.publishAt ? parseLocalDateTime(data.publishAt) : null
// страница редактирования: из БД в значение инпута
const initial = { ...article, publishAt: article.publishedAt ? toLocalInputValue(article.publishedAt) : '' }
```

Эффективный статус для списка:

```ts
export function effectiveStatus(a: { status: 'draft'|'scheduled'|'published'; publishedAt: Date | null }, now: Date) {
  if (a.status === 'scheduled' && a.publishedAt && a.publishedAt <= now) return 'published_scheduled' as const
  return a.status
}
```

### Environment Variables

- `NEXT_PUBLIC_SITE_URL` — база для подписанной ссылки предпросмотра.
- `BETTER_AUTH_SECRET` — подпись preview-токенов (внутри `signPreviewToken`).

### API Endpoints

Новых HTTP-маршрутов нет (только Server Actions). Загрузка — существующий `POST /api/admin/media` (task 14).

## Acceptance Criteria

- [ ] Без входа `/admin/blog/**` недоступны (каждая страница вызывает `await requireAdmin()` → редирект на `/login`); прямой вызов любого из новых Server Actions без сессии админа возвращает `{ ok: false, error: 'Нет доступа' }`, в БД ничего не меняется.
- [ ] Задача не создаёт `/admin/media` и `/api/admin/media` (они из задачи 14); обложки и фото загружаются через `image-upload-field`, картинки в текст — через `media-picker`.
- [ ] Все действия — `adminAction(schema, async (input, ctx) => …, { tags })`; аудит пишется внутри handler через `await audit(ctx.userId, …, ctx.tx)`.
- [ ] Список статей фильтруется по статусу и поиску, `scheduled` показывает дату и признак «уже опубликована по расписанию».
- [ ] Создание и редактирование статьи: Markdown-тело, панель вставок (заголовки, форматирование, картинка из медиатеки, видео, документ, врезка), клиентский предпросмотр (`ArticleBody`) и кнопка «Открыть подписанный предпросмотр» (ссылка открывается с токеном 24 ч, виден черновик).
- [ ] Видео в панели принимает только VK/Rutube (`resolveVideoSource`), документ — только `/media/...` или `https://`; остальное отклоняется с сообщением.
- [ ] Время `datetime-local` интерпретируется как `Asia/Yekaterinburg` (проверено тестами и вручную: статья на 19:00 YEKT публикуется в 14:00 UTC); отображение при редактировании обратно в YEKT.
- [ ] Статусы: `draft` → не виден на сайте; `scheduled` в будущем → не виден, после наступления времени виден в пределах 5 минут (или сразу после cron); `published` → виден сразу после сохранения; `scheduled` с датой в прошлом и `published` с будущей датой — понятные ошибки.
- [ ] Slug: транслитерация из заголовка, ручная правка, дебаунс-проверка уникальности (учитываются и статьи, и рубрики, зарезервированные `preview`/`rss.xml`), ошибка гонки перехватывается.
- [ ] При смене slug существующей статьи/рубрики в `redirects` появляется запись `/blog/old` → `/blog/new` (301), цепочки схлопываются, возврат к старому slug не создаёт петлю; публичный `/blog/old` ведёт на новый адрес.
- [ ] Сохранение статьи, замена тегов и запись редиректа выполняются в одной транзакции; `readingMinutes` пересчитывается при каждом сохранении (слова/200, минимум 1).
- [ ] Теги можно выбирать и создавать «на лету» прямо в форме; рубрики, теги и авторы управляются в своих разделах (CRUD, удаление с проверкой использования).
- [ ] Автор: slug, имя, фото, роль в клубе, звание, bio, список `sameAs` (только `https://`); страница `/authors/<slug>` на сайте отражает изменения.
- [ ] После каждого изменения изменения видны на сайте сразу: сбрасываются `TAGS.blog` и `articleTag(slug)` (для старого и нового slug) через `updateTag`.
- [ ] Нет нативных `<select>`; формы на RHF + zod 4; UI по токенам `DESIGN.md`, на русском; ни одного обращения к файловой системе с пользовательским путём; обложки/фото только через `mediaId`.
- [ ] Vitest для новых чистых модулей проходит; `pnpm lint`, `pnpm typecheck` и `pnpm build:ci` проходят без ошибок.

## Notes

- Все администраторы имеют одну роль `admin`; отдельных прав на блог нет.
- Колонки — ровно из «Context from dependencies» (`rubrics.imageMediaId`, `rubrics.sortOrder`, `authors.sameAs` jsonb `string[]`, `redirects.fromPath/toPath/code`).
- Видео-файлы и документы в медиатеку клуба загрузить нельзя (только изображения), поэтому шорткод документа в основном используется с внешними `https://` ссылками; это ограничение задачи 09.
- Список сидов блога не предусмотрен; для проверки создать статьи через UI.
