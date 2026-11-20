# Task 14: Каркас админки (layout, сводка, общие компоненты, загрузка, аудит, медиатека)

## Status

pending

## Wave

4

## Description

Основа админ-панели: layout с боковым меню (shadcn `sidebar`) и защитой доступа, страница-сводка (новые заявки и ближайшие турниры), общие компоненты для всех разделов (таблица данных, сортируемый список, поле загрузки картинки, выбор из медиатеки, подтверждение, панель действий формы, шапка страницы), обёртка `adminAction` для Server Actions (проверка роли → zod → транзакция с handler'ом, который сам пишет аудит → инвалидация кэша), helper аудита, маршруты `POST/GET /api/admin/media` и простая страница медиатеки (сетка, загрузка, редактирование alt, удаление с проверкой использования). Все последующие задачи админки (16–19, 26) строятся на этом каркасе, поэтому имена и сигнатуры ниже — контракт.

## Dependencies

**Depends on:** task-01-starter-cleanup-deps.md, task-02-design-tokens-layout.md, task-03-db-schema.md, task-06-shared-utils.md, task-08-auth-admin.md, task-09-media-core.md, task-12-public-queries.md (только `TAGS` из `src/lib/cache-tags.ts`)
**Blocks:** task-16-admin-tournaments-promotions.md, task-17-admin-pricing.md, task-18-admin-menu-sets.md, task-19-admin-galleries-settings-leads.md, task-26-blog-admin.md

**Context from dependencies:**
- Task 01 установил все shadcn-компоненты (`sidebar`, `table`, `dialog`, `alert-dialog`, `sheet`, `select`, `tabs`, `badge`, `card`, `skeleton`, `form`, `checkbox`, `tooltip`, `dropdown-menu`, …) и пакеты: `@tanstack/react-table`, `@dnd-kit/{core,sortable,utilities}`, `react-dropzone`, `react-hook-form`, `zod` 4, `date-fns`. Новых зависимостей не ставить.
- Task 02 переписал `DESIGN.md` и токены; **админка использует стандартные токены shadcn/Tailwind из `DESIGN.md`** (не брендовые стили публичного сайта): страницы `container`/`max-w-*`, `space-y-*`, `rounded-lg border bg-card`, иконки lucide (`h-4 w-4`).
- Task 03 создал таблицы `leads`, `tournaments`, `auditLog` (`userId`, `action`, `entity`, `entityId`, `diff jsonb`, `createdAt`), `mediaAssets` и др. (`src/lib/schema/*.ts`).
- Task 06 дал `src/lib/dates.ts` (`getOpDate`, `formatEventDate`, `TZ`).
- Task 08 дал `src/lib/session.ts`: `requireAdmin()` (для страниц; redirect на `/login`), `requireAdminAction()` (для actions и route handlers; бросает `Error('UNAUTHORIZED')`), `getSession()`, `isAdminSession`; `src/lib/auth-client.ts` (`signOut`, `useSession`); `proxy.ts` редиректит `/admin/*` без cookie. Под cacheComponents `requireAdmin()`/`getSession()` используют `headers()` и должны вызываться внутри `<Suspense>` — его обеспечивает **этот layout**.
- Task 09 дал `saveImage`, `deleteMedia` (возвращает `{ ok: true } | { ok: false; reason: 'not_found' | 'in_use'; usages }`), `MediaValidationError`, `mediaUrl`, тип `PictureAsset`, компонент `<Picture>`.

## Files to Create

Задача 14 — **владелец** (см. таблицу владения в README): `src/app/(admin)/admin/layout.tsx`, общие `src/components/admin/*`, `src/lib/admin/*`, `/admin/media`, `/api/admin/media`. Другие задачи (в т. ч. 26) эти файлы и свои маршруты загрузки не создают.

Layout и страницы:
- `src/app/(admin)/admin/layout.tsx` — SidebarProvider, Suspense, noindex
- `src/app/(admin)/admin/page.tsx` — сводка
- `src/app/(admin)/admin/loading.tsx`, `src/app/(admin)/admin/error.tsx` — скелетон и граница ошибок
- `src/app/(admin)/admin/media/page.tsx` — медиатека
- `src/app/(admin)/admin/media/actions.ts` — Server Actions медиатеки (`'use server'`)

API:
- `src/app/api/admin/media/route.ts` — `POST` (загрузка), `GET` (список для пикера)

Общие компоненты:
- `src/components/admin/admin-sidebar.tsx` — меню (client)
- `src/components/admin/admin-user-menu.tsx` — пользователь и выход (client)
- `src/components/admin/data-table.tsx`
- `src/components/admin/sortable-list.tsx`
- `src/components/admin/image-upload-field.tsx`
- `src/components/admin/media-picker.tsx`
- `src/components/admin/media-library.tsx` — клиентский UI медиатеки (используется страницей media)
- `src/components/admin/confirm-dialog.tsx`
- `src/components/admin/form-actions.tsx`
- `src/components/admin/page-header.tsx`

Библиотеки:
- `src/lib/admin/audit.ts` — `audit(...)`
- `src/lib/admin/action.ts` — `adminAction`, `ActionError`, `ActionResult`, `ActionCtx`
- `src/lib/admin/media-dto.ts` — `MediaDto`, `toMediaDto(row)`

## Files to Modify

Нет.

## Technical Details

### Implementation Steps

1. Прочитать `src/components/ui/sidebar.tsx` (shadcn) и `src/lib/session.ts`, `src/lib/media/storage.ts`, `src/lib/media/url.ts`.

2. **Layout `src/app/(admin)/admin/layout.tsx`.**
   - `export const metadata = { title: { default: "Админка", template: "%s · Админка" }, robots: { index: false, follow: false } }`.
   - Статическая оболочка: `SidebarProvider` → `AdminSidebar` + `SidebarInset` с верхней полосой (`SidebarTrigger`, ссылка «Открыть сайт» `target="_blank"`) и `<div className="flex-1 p-4 md:p-6">`.
   - Все динамические части — внутри `<Suspense>`:

```tsx
<SidebarProvider>
  <AdminSidebar
    leadsBadge={<Suspense fallback={null}><NewLeadsBadge /></Suspense>}
    userMenu={<Suspense fallback={<Skeleton className="h-10 w-full" />}><SidebarUser /></Suspense>}
  />
  <SidebarInset>
    <header …><SidebarTrigger />…</header>
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  </SidebarInset>
</SidebarProvider>
```
   - `AdminGate` (async server): `await requireAdmin(); return <>{children}</>` — защита «в глубину». **Но layout-защита не заменяет проверку на странице** (страница рендерится независимо): каждая страница админки обязана сама вызывать `requireAdmin()` первой строкой.
   - `NewLeadsBadge` (async server): `await connection()`, `count(*)` заявок со статусом `new` (прямой запрос Drizzle, без кэша), возвращает `<Badge>` с числом или `null`, если 0. `SidebarUser`: `const s = await requireAdmin()` → `<AdminUserMenu name email />`.

3. **`admin-sidebar.tsx`** (client, `usePathname` для активного пункта; пропсы `leadsBadge`, `userMenu`: `ReactNode`). Пункты (иконки lucide; активный — по `startsWith` маршрута):

   | Пункт | Маршрут | Иконка (пример) |
   |---|---|---|
   | Сводка | `/admin` | `LayoutDashboard` |
   | Заявки | `/admin/leads` (+ `leadsBadge`) | `Inbox` |
   | Турниры | `/admin/tournaments` | `Trophy` |
   | Акции | `/admin/promotions` | `Percent` |
   | Цены | `/admin/pricing` | `Banknote` |
   | Меню | `/admin/menu` | `UtensilsCrossed` |
   | Банкетные сеты | `/admin/banquet-sets` | `PartyPopper` |
   | Галереи | `/admin/galleries` | `Images` |
   | Блог | `/admin/blog` (подпункты: Статьи `/admin/blog/articles`, Рубрики `/admin/blog/rubrics`, Теги `/admin/blog/tags`, Авторы `/admin/blog/authors`) | `Newspaper` |
   | Медиатека | `/admin/media` | `FileImage` |
   | Настройки | `/admin/settings` | `Settings` |
   | Аккаунт | `/admin/account` | `UserCog` |

   Заголовок сайдбара — бренд-текст «Пирамида · админка»; футер — `userMenu`. Разделы, которые строят следующие задачи, на данном этапе дают 404 — это ожидаемо. На мобильных сайдбар — выезжающая панель (поведение shadcn `Sidebar`).
   `admin-user-menu.tsx` (client): имя, email, кнопка «Выйти» (`authClient.signOut()` → `router.replace("/login")`).

4. **Сводка `page.tsx`.** Первая строка — `await requireAdmin()`, затем `await connection()` не нужен (уже динамика), но допустим. Данные (прямые запросы Drizzle, без кэша): (a) число заявок со статусом `new` и последние 10 заявок `new` — `number`, тип (русская подпись), имя/телефон, время создания (формат `Intl.DateTimeFormat("ru-RU", { timeZone: TZ, dateStyle: "short", timeStyle: "short" })`), ссылка `/admin/leads/<id>` (страницу создаёт задача 19); (b) 5 ближайших опубликованных турниров по условию `endDate >= getOpDate()` (сортировка `startDate`), дата через `formatEventDate(startDate, endDate)`, ссылка `/admin/tournaments/<id>`; (c) быстрые ссылки: «Добавить турнир», «Открыть сайт», «Редактировать цены». Карточки shadcn `Card` в сетке `grid grid-cols-1 gap-6 md:grid-cols-2`, пустые состояния («Новых заявок нет», «Предстоящих турниров нет»). Заголовок через `PageHeader`.

5. **`loading.tsx`** — скелетон (`Skeleton`-блоки). **`error.tsx`** (client): карточка «Что-то пошло не так», кнопка «Повторить» (`reset`), без вывода текста ошибки.

6. **Библиотека `src/lib/admin`:**
   - `audit.ts`:

```ts
import { db } from "@/lib/db"
import { auditLog } from "@/lib/schema"
export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]
export async function audit(userId: string, action: string, entity: string, entityId: string, diff?: unknown, tx: DbOrTx = db): Promise<void> {
  await tx.insert(auditLog).values({ userId, action, entity, entityId, diff: (diff ?? {}) as object })
}
```
     `action` — короткий код вида `tournament.create` / `tournament.update` / `tournament.delete`; `diff` — `{ before?, after? }` или набор изменённых полей (без секретов и паролей).
   - `action.ts`:

```ts
import { z } from "zod"
import { unstable_rethrow } from "next/navigation"
import { updateTag } from "next/cache"
import { db } from "@/lib/db"
import { requireAdminAction } from "@/lib/session"
import type { DbOrTx } from "@/lib/admin/audit"

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

/** Ожидаемая бизнес-ошибка: превращается в { ok: false, error }. */
export class ActionError extends Error {
  constructor(message: string, readonly fieldErrors?: Record<string, string[]>) { super(message) }
}

/** Контекст handler'а. Аудита в ctx НЕТ: handler сам вызывает audit(ctx.userId, …, ctx.tx). */
export type ActionCtx = { userId: string; tx: DbOrTx }

export function adminAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>, ctx: ActionCtx) => Promise<T>,
  opts: { tags: string[] | ((input: z.output<S>, result: T) => string[]) },
): (input: z.input<S>) => Promise<ActionResult<T>>
```
     Порядок внутри: (1) `requireAdminAction()` — при `UNAUTHORIZED` вернуть `{ ok: false, error: "Нет доступа" }` и **не** выполнять ничего дальше; `userId = session.user.id`; (2) `schema.safeParse(input)` → ошибки в `{ ok: false, error: "Проверьте введённые данные", fieldErrors: z.flattenError(err).fieldErrors }`; (3) `const data = await db.transaction((tx) => handler(parsed.data, { userId, tx }))` — handler сам пишет аудит в этой же транзакции: `await audit(ctx.userId, action, entity, entityId, diff, ctx.tx)` (`audit` импортируется из `@/lib/admin/audit`); (4) **после** успешного коммита теги: `typeof opts.tags === "function" ? opts.tags(parsed.data, data) : opts.tags`, для каждого `updateTag(tag)`; (5) `{ ok: true, data }`. В `catch`: сначала `unstable_rethrow(e)` (чтобы `redirect()`/`notFound()` внутри handler работали), затем `ActionError` → `{ ok: false, error: e.message, fieldErrors }`, прочее — `console.error` и `{ ok: false, error: "Внутренняя ошибка. Попробуйте ещё раз." }`.
     Использование в потребителях (`'use server'` файлы экспортируют результат фабрики как константу — это допустимо): `export const saveTournament = adminAction(tournamentSchema, async (input, ctx) => { …; await audit(ctx.userId, "tournament.create", "tournament", id, { after: input }, ctx.tx); … }, { tags: [TAGS.tournaments] })` (запросы — через `ctx.tx`, аудит — явным вызовом `audit` из `@/lib/admin/audit`). Файл `action.ts` сам **не** помечается `'use server'`.
   - `media-dto.ts`: `MediaDto = { id; path; originalName; alt; folder; mime; width; height; size; blurDataUrl; variants; createdAt: string }`; `toMediaDto(row)`; `MediaDto` структурно совместим с `PictureAsset`.

7. **`POST/GET /api/admin/media`** (`route.ts`; не экспортировать `runtime`/`dynamic`). Защита: `try { session = await requireAdminAction() } catch { return Response.json({ error: "UNAUTHORIZED" }, { status: 401 }) }`.
   - `POST` (multipart): поля `file` (File, обязательно), `folder` (по умолчанию `general`), `alt` (необязательно). Проверка `file instanceof File`, ранняя проверка `file.size > 10 * 1024 * 1024` → 413. `saveImage(file, { folder, alt, userId: session.user.id, originalName: file.name })` (сигнатура задачи 09: `saveImage(file: File | Buffer, { folder; alt?; userId?; originalName? }) → Promise<MediaAsset>`); `MediaValidationError` → 400 `{ error: message }`; успех → 201 `{ asset: MediaDto }`. Аудит: `await audit(session.user.id, "media.upload", "media", asset.id, { after: { originalName: asset.originalName, folder: asset.folder } })` (без `tx` — пишется через `db`).
   - `GET`: параметры `q` (поиск по `originalName` и `alt`, `ILIKE` с экранированием), `folder`, `page` (с 1), `pageSize` (по умолчанию 24, максимум 60); ответ `{ items: MediaDto[]; total: number; page: number; pageSize: number }`, сортировка по `createdAt desc`.
   - Загрузка новой картинки не затрагивает кэши страниц, поэтому `revalidateTag` здесь не нужен.

8. **Общие компоненты (все `"use client"`, кроме `page-header`):**
   - `data-table.tsx` — обобщённая таблица на `@tanstack/react-table` + shadcn `Table`:

```ts
type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[]     // колонки определяются в client-файле потребителя (функции нельзя передавать из Server Component)
  data: TData[]
  searchPlaceholder?: string               // если задан — глобальный поиск по строковым значениям
  filters?: { columnId: string; label: string; options: { value: string; label: string }[] }[]  // select-фильтры по колонкам
  pageSize?: number                        // по умолчанию 20
  getRowHref?: (row: TData) => string      // клик по строке → router.push
  emptyText?: string                       // "Ничего не найдено"
  toolbar?: React.ReactNode                // справа от поиска (кнопка «Добавить»)
}
```
     Сортировка по клику на заголовок (иконки `ArrowUpDown`), пагинация («Назад/Вперёд», «Страница X из Y»), на мобильных таблица в `overflow-x-auto`. Утилита `sortableHeader(label)` для колонок — по желанию.
   - `sortable-list.tsx` — сортировка dnd-kit + кнопки ↑/↓ (для мобильных и клавиатуры):

```ts
type SortableListProps<T extends { id: string }> = {
  items: T[]
  onReorder: (orderedIds: string[]) => Promise<void> | void   // вызывается после перестановки; при исключении порядок откатывается и показывается toast
  renderItem: (item: T, ctx: { dragHandle: React.ReactNode; moveUp: () => void; moveDown: () => void; canMoveUp: boolean; canMoveDown: boolean; index: number }) => React.ReactNode
  disabled?: boolean
}
```
     Реализация: `DndContext` (`closestCenter`, сенсоры `PointerSensor` с `activationConstraint: { distance: 6 }` и `KeyboardSensor` с `sortableKeyboardCoordinates`), `SortableContext` с `verticalListSortingStrategy`, элемент через `useSortable` (`CSS.Transform.toString(transform)`, `transition`, `isDragging` → `opacity-60`), ручка-захват `GripVertical` с `aria-label="Перетащить"`; локальное состояние для оптимистичного порядка (`arrayMove`), синхронизация с `items` при изменении пропсов.
   - `confirm-dialog.tsx`: на `AlertDialog` — `ConfirmDialog({ trigger, title, description, confirmLabel = "Удалить", destructive = true, onConfirm: () => Promise<void> | void })`; кнопка подтверждения блокируется на время `onConfirm` (спиннер `Loader2`), диалог закрывается после успеха, при исключении остаётся открытым и показывает toast.
   - `form-actions.tsx`: нижняя панель формы `FormActions({ isSubmitting, submitLabel = "Сохранить", cancelHref?, onDelete?, deleteLabel = "Удалить", extra? })` — `sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6`, кнопки «Сохранить» (`type="submit"`, спиннер), «Отмена» (`Link`), «Удалить» (через `ConfirmDialog`, `destructive`, слева).
   - `page-header.tsx` (может быть серверным): `PageHeader({ title, description?, actions?, backHref?, breadcrumbs? })` — `h1` (`text-2xl font-bold`), описание `text-sm text-muted-foreground`, справа блок действий, слева опциональная стрелка назад (`ArrowLeft`).
   - `image-upload-field.tsx`: контролируемое поле картинки:

```ts
type ImageUploadFieldProps = {
  value: string | null                       // mediaId
  initialAsset?: MediaDto | null             // для превью уже сохранённой картинки
  onChange: (mediaId: string | null, asset: MediaDto | null) => void
  folder: string                             // "tournaments" | "promotions" | "galleries" | "blog" | …
  label?: string
  aspect?: number                            // подсказка пропорции превью (например 16/6), только CSS object-cover; кадрирования нет
  disabled?: boolean
}
```
     Превью — `<Picture>`/`<img src={mediaUrl(asset, 640)}>`. Кнопки «Загрузить» (скрытый `input[type=file]` или `react-dropzone`), «Выбрать из медиатеки» (`MediaPicker`), «Убрать». Загрузка: `fetch("/api/admin/media", { method: "POST", body: FormData })`, состояние `uploading`, клиентская проверка (тип jpeg/png/webp/avif, ≤ 10 МБ) до отправки, ошибки сервера — через `toast.error`. Поле для alt под превью (`PATCH` не нужен: alt передаётся при загрузке; редактирование alt — в медиатеке).
   - `media-picker.tsx`: `MediaPicker({ open, onOpenChange, onSelect: (assets: MediaDto[]) => void, multiple?: boolean, folder?: string })` — `Dialog` (`max-w-4xl`) с вкладками «Медиатека» (поиск с debounce 300 мс, фильтр папки, сетка миниатюр, «Загрузить ещё», выбор кликом с галочкой, кнопка «Выбрать») и «Загрузить» (dropzone; после загрузки ассет выбирается). Данные — `GET /api/admin/media`.
   - `media-library.tsx`: UI страницы медиатеки (см. ниже); использует тот же `GET`/`POST`.

9. **Страница медиатеки `media/page.tsx`:** `await requireAdmin()`; первую страницу (24 шт.) читать прямым запросом (без кэша) и передавать в `<MediaLibrary initial={...} />`. UI: верхняя область — dropzone (`react-dropzone`, несколько файлов, последовательная загрузка с прогрессом «N из M», отклонение неподходящих типов/размеров с понятным сообщением), поиск, фильтр по папке, сетка карточек (миниатюра, имя, размер); клик по карточке открывает `Dialog` деталей: большая картинка, `originalName`, размеры, вес, папка, дата, поле alt (кнопка «Сохранить alt» → action `updateMediaAlt`), кнопка «Удалить» (через `ConfirmDialog`). Если удаление вернуло `in_use`, показать список использований («Используется в: Акция «…» (1)») и не удалять. «Загрузить ещё» подгружает следующие страницы.
    `media/actions.ts` (`'use server'`):
    - `updateMediaAlt = adminAction(z.object({ id: z.uuid(), alt: z.string().trim().max(300) }), async (input, ctx) => { обновить mediaAssets.alt через ctx.tx (нет строки → ActionError("Файл не найден")); await audit(ctx.userId, "media.update", "media", input.id, { after: { alt: input.alt } }, ctx.tx) }, { tags: [TAGS.galleries, TAGS.tournaments, TAGS.promotions, TAGS.menu, TAGS.sets, TAGS.services, TAGS.blog] })` (alt встроен в кэшируемые данные, поэтому сбрасываются все теги, где есть картинки; константы тегов — `@/lib/cache-tags` задачи 12);
    - `deleteMediaAction = adminAction(z.object({ id: z.uuid() }), async (input, ctx) => { … }, { tags: [] })` (удаляется только неиспользуемый ассет, кэшированных данных он не касается) — внутри вызывает `deleteMedia(input.id)` (собственная транзакция задачи 09); `not_found` → `ActionError("Файл не найден")`; `in_use` → возвращает `{ deleted: false, usages }` как `data` (UI показывает список); успех → `await audit(ctx.userId, "media.delete", "media", input.id, undefined, ctx.tx)` и `{ deleted: true, usages: [] }`.

10. **Стиль и доступность:** все тексты на русском; формы и таблицы по `DESIGN.md` (shadcn, `rounded-md` для полей, `rounded-lg` для карточек); кнопки-иконки имеют `aria-label`; фокус видим; `Toaster` уже в корневом layout (task 02), использовать `toast` из `sonner`.

### Code Snippets

Образец потребителя (для справки; страницы создают задачи 16–19):

```ts
// src/app/(admin)/admin/tournaments/actions.ts
"use server"
import { adminAction } from "@/lib/admin/action"
import { audit } from "@/lib/admin/audit"
import { TAGS } from "@/lib/cache-tags"
import { tournaments } from "@/lib/schema"

export const saveTournament = adminAction(tournamentSchema, async (input, ctx) => {
  const [row] = await ctx.tx.insert(tournaments).values(input).returning({ id: tournaments.id })
  await audit(ctx.userId, "tournament.create", "tournament", row!.id, { after: input }, ctx.tx)
  return { id: row!.id }
}, { tags: [TAGS.tournaments] })
```

### Environment Variables

- `UPLOAD_DIR` (через task 09), `POSTGRES_URL`, `BETTER_AUTH_SECRET` — без новых переменных.

### API Endpoints

- `POST /api/admin/media` — multipart (`file`, `folder`, `alt?`) → `201 { asset: MediaDto }`; `400` ошибка валидации файла; `401` нет админа; `413` файл > 10 МБ.
- `GET /api/admin/media?q=&folder=&page=&pageSize=` → `200 { items: MediaDto[]; total; page; pageSize }`; `401` без админа.

## Acceptance Criteria

- [ ] `/admin` без входа редиректит на `/login` (proxy), с входом показывает сводку внутри layout с боковым меню; в меню все 11 разделов (Блог с подпунктами) и бейдж числа новых заявок; на мобильных меню выезжает панелью.
- [ ] Layout и страница `/admin` вызывают `requireAdmin()`; динамические части обёрнуты в `<Suspense>`, `next build` проходит без БД; на всех страницах админки `noindex`.
- [ ] Сводка показывает число и список новых заявок и 5 ближайших турниров (`endDate >= getOpDate()`), с пустыми состояниями.
- [ ] `adminAction`: без сессии админа возвращает `{ ok: false }` и не выполняет handler; невалидный ввод даёт `fieldErrors`; handler получает `(input, { userId, tx })`, и его запись `audit(ctx.userId, …, ctx.tx)` выполняется в той же транзакции (при исключении откатываются обе); `opts.tags` принимает массив или функцию `(input, result) => string[]`; `updateTag` вызывается для указанных тегов только после успешного коммита; `redirect()` внутри handler работает (`unstable_rethrow`).
- [ ] `POST /api/admin/media` без сессии → 401; загрузка jpeg/png/webp/avif ≤ 10 МБ создаёт ассет (201), SVG/не-картинка → 400, > 10 МБ → 413; `GET` возвращает страницы с поиском и фильтром папки.
- [ ] `DataTable` сортирует, ищет, фильтрует и пагинирует; `SortableList` переставляет мышью, клавиатурой и кнопками ↑/↓ и откатывает порядок при ошибке `onReorder`; `ConfirmDialog` блокирует кнопку на время действия; `FormActions` и `PageHeader` отображаются по DESIGN.md.
- [ ] `ImageUploadField` загружает файл, показывает превью, позволяет выбрать из медиатеки и очистить; `MediaPicker` умеет одиночный и множественный выбор.
- [ ] Страница `/admin/media`: загрузка нескольких файлов (dropzone), сетка с поиском/фильтром, редактирование alt, удаление; удаление используемого файла не выполняется и показывает, где он используется.
- [ ] `pnpm lint` и `pnpm typecheck` проходят; `next build` проходит.

## Notes

- Колонки `DataTable` (содержат функции-рендереры) определяются в client-файлах потребителей; серверная страница передаёт только сериализуемые `data`.
- Страница `/admin/leads` и карточка заявки — задача 19; `/admin/account` — задача 19; разделы блога — задача 26. Ссылки на них в меню остаются, пока страницы не созданы.
- В README-заголовке задачи 26 упомянута «медиатека»: страницу медиатеки (UI и API) делает эта задача, задача 26 использует её API/пикер.
- Кадрирования афиш (PLAN: «кроп 16:6») нет: в `ImageUploadField` только подсказка пропорции превью (`object-cover`).
