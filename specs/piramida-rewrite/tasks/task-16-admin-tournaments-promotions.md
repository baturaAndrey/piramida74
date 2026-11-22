# Task 16: Админка — турниры, серии турниров, акции

## Status

complete

## Wave

5

## Description

Раздел админки, в котором владелец сам ведёт календарь турниров (даты, афиши, серии, категории) и акции клуба (карусель на главной). Это замена потерянной таблицы `plan` старого сайта: после сохранения изменения сразу видны на сайте через `updateTag`. Задача создаёт страницы `/admin/tournaments`, `/admin/tournaments/series`, `/admin/promotions` со всеми формами и Server Actions. Язык интерфейса — русский.

## Dependencies

**Depends on:** task-14-admin-shell.md, task-12-public-queries.md (и транзитивно 03, 06, 08, 09)
**Blocks:** task-28-qa-verification.md

**Context from dependencies:**
- task-03 создал схему Drizzle (`src/lib/schema/club.ts`: `tournamentSeries`, `tournaments`, `promotions`; `src/lib/schema/menu.ts`: `menuCategories`). Enum'ы: `discipline` (`free_pyramid`, `combined_pyramid`, `dynamic_pyramid`, `moscow_pyramid`, `free_pyramid_continuation`, `pool`, `other`), `tournament_level` (`regional_championship`, `regional_youth`, `club`, `other`), `promotion_target` (`table_rental`, `menu_category`, `takeaway`, `other`). Перед работой **прочитайте `src/lib/schema/club.ts`**: точные типы колонок (`entryFee`, `prizeFund`, поля `tournamentSeries`) берите оттуда. В тексте ниже предположено: `tournamentSeries(id, name, description?, sortOrder)`, `entryFee`/`prizeFund` — целые рубли или text; подстройте zod под реальный тип.
- task-14 создал каркас админки: `src/app/(admin)/admin/layout.tsx` (sidebar уже содержит пункты «Турниры» и «Акции»), общие компоненты `src/components/admin/{data-table,sortable-list,image-upload-field,media-picker,confirm-dialog,form-actions,page-header}.tsx`, `src/lib/admin/action.ts`, `src/lib/admin/audit.ts`, `POST /api/admin/media`. **Перед работой откройте компоненты** и возьмите их точные пропсы. Контракт `adminAction` (зафиксирован):
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
  Порядок внутри: `requireAdminAction()` (нет админа → `{ ok: false, error: 'Нет доступа' }`) → `schema.safeParse` (ошибка → `fieldErrors`) → `db.transaction(tx => handler(input, { userId, tx }))` → после коммита `updateTag` для каждого тега → `{ ok: true, data }`. `throw new ActionError(msg, fieldErrors?)` в handler → `{ ok: false, error, fieldErrors }`.
  Аудит **обёртка не пишет** — handler вызывает его сам в той же транзакции: `import { audit } from '@/lib/admin/audit'`, сигнатура `audit(userId: string, action: string, entity: string, entityId: string, diff?: unknown, tx?: DbOrTx): Promise<void>`, вызов `await audit(ctx.userId, 'tournament.update', 'tournament', id, diff, ctx.tx)`.
- task-12 создал `src/lib/cache-tags.ts` (`TAGS.tournaments`, `TAGS.promotions` и др.). `src/lib/queries/**` менять нельзя. Админка читает БД напрямую (без `'use cache'`) из своих `_queries.ts`.
- task-06: `src/lib/dates.ts` (`getToday()`, `formatEventDate`, `minToClock`, `clockToMin`, `TZ`), `src/lib/slug.ts` (`slugify`, `nanoCode`).
- task-08: `src/lib/session.ts` — `requireAdmin()` (только для страниц/layout'ов, redirect на `/login`); `requireAdminAction()` (для Server Actions и route handlers, бросает `Error('UNAUTHORIZED')`) — в этой задаче напрямую не нужен: все мутации идут через `adminAction`, своих route handlers задача не создаёт.
- task-09: `mediaAssets`, `<Picture>`, `mediaUrl(asset, w?, fmt?)`.

## Files to Create

Турниры:
- `src/app/(admin)/admin/tournaments/page.tsx` — список (сервер) + фильтры
- `src/app/(admin)/admin/tournaments/new/page.tsx` — создание (поддерживает `?from=<id>` для «Дублировать»)
- `src/app/(admin)/admin/tournaments/[id]/page.tsx` — редактирование
- `src/app/(admin)/admin/tournaments/_components/tournaments-table.tsx` — клиентская таблица, фильтры, кнопки действий
- `src/app/(admin)/admin/tournaments/_components/tournament-form.tsx` — форма (клиент)
- `src/app/(admin)/admin/tournaments/_components/categories-field.tsx` — мультивыбор категорий чипами
- `src/app/(admin)/admin/tournaments/_components/date-range-field.tsx` — выбор диапазона дат (Popover + Calendar)
- `src/app/(admin)/admin/tournaments/_lib/labels.ts` — русские подписи enum'ов, пресеты категорий
- `src/app/(admin)/admin/tournaments/_schema.ts` — zod-схемы (без `'use server'`, общие для клиента и сервера)
- `src/app/(admin)/admin/tournaments/_queries.ts` — чтение из БД для админки
- `src/app/(admin)/admin/tournaments/_actions.ts` — `'use server'`: `saveTournament`, `deleteTournament`, `togglePublishTournament`
- `src/app/(admin)/admin/tournaments/series/page.tsx`
- `src/app/(admin)/admin/tournaments/series/_components/series-manager.tsx` — список + диалог создания/редактирования
- `src/app/(admin)/admin/tournaments/series/_actions.ts` — `'use server'`: `saveSeries`, `deleteSeries`

Акции:
- `src/app/(admin)/admin/promotions/page.tsx` — список с drag-and-drop сортировкой
- `src/app/(admin)/admin/promotions/new/page.tsx`
- `src/app/(admin)/admin/promotions/[id]/page.tsx`
- `src/app/(admin)/admin/promotions/_components/promotions-list.tsx` — сортируемый список (клиент)
- `src/app/(admin)/admin/promotions/_components/promotion-form.tsx` — форма (клиент)
- `src/app/(admin)/admin/promotions/_components/days-of-week-field.tsx` — ToggleGroup дней недели
- `src/app/(admin)/admin/promotions/_components/time-window-field.tsx` — окно времени (через `clockToMin`/`minToClock`)
- `src/app/(admin)/admin/promotions/_lib/labels.ts` — подписи `promotion_target`, дни недели
- `src/app/(admin)/admin/promotions/_schema.ts`
- `src/app/(admin)/admin/promotions/_queries.ts`
- `src/app/(admin)/admin/promotions/_actions.ts` — `'use server'`: `savePromotion`, `deletePromotion`, `togglePromotion`, `reorderPromotions`

## Files to Modify

Нет. Не трогать: схему, `src/lib/queries/**`, `package.json`, `globals.css`, `src/app/(admin)/admin/layout.tsx`, общие компоненты `src/components/admin/*`, `src/components/ui/*`. Если нужного shadcn-компонента (`form`, `select`, `switch`, `toggle-group`, `calendar`, `popover`, `badge`, `tabs`) нет в `src/components/ui`, сообщите об этом в отчёте, не добавляйте сами.

## Technical Details

### Общие правила (для всех страниц этой задачи)

1. Каждая страница вызывает `await requireAdmin()` в серверной части. Так как включён `cacheComponents`, страница строится так: синхронный `export default function Page({ searchParams })` рендерит `<Suspense fallback={<TableSkeleton/>}><Content .../></Suspense>`, а async `Content` вызывает `requireAdmin()` и обращается к БД. Если task-14 задал другой шаблон — следуйте ему.
2. Все мутации — только через `adminAction(schema, async (input, ctx) => { … }, { tags })` (`tags: [TAGS.tournaments]` / `[TAGS.promotions]`). В Server Actions инвалидация `updateTag` делается внутри обёртки, вручную не дублировать. Аудит каждый handler пишет сам: `await audit(ctx.userId, '<entity>.<op>', '<entity>', id, diff, ctx.tx)` — сущности `tournament`, `tournament_series`, `promotion`; операции `create`, `update`, `delete`, `toggle`, `reorder` (для `reorder` `entityId` = `'*'`, `diff = { ids }`).
3. Формы: `react-hook-form` + `zodResolver` + shadcn `Form`. Схема лежит в `_schema.ts` и используется и в форме, и в action. После успеха — `toast.success('Сохранено')` (sonner) и `router.push` на список; при ошибке — `toast.error(msg)` и `form.setError` для `fieldErrors`.
4. Удаление — всегда через `ConfirmDialog` («Удалить турнир «…»? Действие необратимо»).
5. Даты — строки `YYYY-MM-DD`. Никогда не использовать `toISOString()` для даты из календаря (сдвиг по поясу): собирайте строку из локальных `getFullYear/getMonth/getDate` (`date-fns` `format(d, 'yyyy-MM-dd')`).
6. «Сегодня» для фильтров списка — `getToday()` (календарная дата в `Asia/Yekaterinburg`).
7. Весь UI по `DESIGN.md` (shadcn new-york, `rounded-md` у инпутов, `rounded-lg` у карточек, Lucide-иконки `h-4 w-4`, `space-y-4` в формах, контейнер страницы `max-w-4xl` для форм, таблицы на всю ширину).

### 1. `/admin/tournaments` — список

`searchParams` (все необязательные): `when=upcoming|past|all` (по умолчанию `upcoming`), `year=2026` (по умолчанию — все годы для `past/all`, для `upcoming` игнорируется), `q` (поиск по названию, `ilike`).

`_queries.ts`:

```ts
import { and, asc, desc, gte, lt, ilike, sql, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tournaments, tournamentSeries } from '@/lib/schema';
import { getToday } from '@/lib/dates';

export async function listTournaments(p: { when: 'upcoming'|'past'|'all'; year?: number; q?: string }) {
  const today = getToday();
  const conds = [];
  if (p.when === 'upcoming') conds.push(gte(tournaments.endDate, today));   // end_date >= сегодня
  if (p.when === 'past') conds.push(lt(tournaments.endDate, today));
  if (p.year) conds.push(sql`extract(year from ${tournaments.startDate}) = ${p.year}`);
  if (p.q) conds.push(ilike(tournaments.title, `%${p.q}%`));
  return db.select({ t: tournaments, seriesName: tournamentSeries.name })
    .from(tournaments).leftJoin(tournamentSeries, eq(tournaments.seriesId, tournamentSeries.id))
    .where(and(...conds))
    .orderBy(p.when === 'past' ? desc(tournaments.startDate) : asc(tournaments.startDate));
}
export async function listTournamentYears(): Promise<number[]> { /* distinct extract(year from start_date) desc */ }
```

Список (`tournaments-table.tsx`, использует `data-table`): колонки — Даты (`formatEventDate(startDate, endDate)` + год серым), Название (+ бейдж серии и «N тур»), Дисциплина (подпись из labels), Уровень, Опубликован (Switch, мгновенное `togglePublishTournament`), Регистрация (бейдж «открыта»), Действия (DropdownMenu: Редактировать, Дублировать, Удалить). Над таблицей: Tabs/ToggleGroup «Предстоящие / Прошедшие / Все», Select года, поле поиска (фильтры меняют URL через `router.replace` с `useTransition`), кнопки «Создать турнир» → `/admin/tournaments/new` и «Серии» → `/admin/tournaments/series`. Пустое состояние: «Турниров нет. Создайте первый или продублируйте прошлый тур».

### 2. Форма турнира (`tournament-form.tsx`)

Поля (порядок сверху вниз, группы в `Card`):

| Поле | Контрол | Правила |
|---|---|---|
| `title` | Input | 3–200 симв., обязательно |
| `slug` | Input + кнопка «Сгенерировать» | автогенерация `slugify(title)` пока пользователь не правил поле вручную; regex `^[a-z0-9-]+$`; уникальность проверяется в action |
| `seriesId` | Select «Без серии» + пункты серий + кнопка «+ Новая серия» | «+» открывает Dialog (поле «Название») → вызывает `saveSeries` и подставляет созданную серию в Select без перезагрузки (`router.refresh()` + локальный state) |
| `stageNumber` | Input number | только если выбрана серия; 1–99, `null` если пусто |
| `discipline` | Select (enum, подписи из labels) + «Не указана» | nullable |
| `level` | Select (enum) | обязательно, по умолчанию `club` |
| `categories` | `categories-field.tsx` | чипы, см. ниже |
| `startDate`/`endDate` | `date-range-field.tsx` | см. ниже |
| `entryFee`, `prizeFund` | Input (число, ₽) | nullable, ≥ 0 (если колонка text — обычный Input) |
| `description` | Textarea (до 600 симв., счётчик) | показывается на главной как подпись под названием |
| `coverMediaId` | `image-upload-field` | см. ниже |
| `registrationOpen` | Switch «Открыта регистрация» | по умолчанию `false` |
| `isPublished` | Switch «Опубликован на сайте» | по умолчанию `true` для нового, **`false` для дубля** |

**Категории (`categories-field.tsx`).** Пресеты-чипы (переключаются кликом, выбранные — залитые `variant="default"`, остальные `outline`): `Мужчины`, `Женщины`, `до 13`, `до 16`, `до 19`, `60+`, `Сеньоры`, `Команды`. Ниже — Input «Своя категория» + Enter/кнопка «Добавить» добавляет произвольную строку (trim, 1–40 символов, без дублей без учёта регистра). Выбранные пользовательские значения тоже выводятся чипами с крестиком. Значение поля — `string[]` (`text[]` в БД), максимум 12.

**Диапазон дат (`date-range-field.tsx`).** Кнопка-триггер показывает `formatEventDate(start, end)` или «Выберите даты». Popover → shadcn `Calendar mode="range"` с `locale={ru}` из `date-fns/locale`, `numberOfMonths={2}` на `md+`, 1 на мобильных, `weekStartsOn={1}`. Один клик без второго = однодневный турнир (`endDate = startDate`). Возвращает пару строк `YYYY-MM-DD`. Дополнительно под триггером — два обычных `<Input type="date">` («Начало», «Конец») для ручного ввода, связаны с тем же состоянием (для мобильных и клавиатуры). Ошибка `endDate < startDate` — «Дата окончания раньше начала».

**Афиша (`image-upload-field`).** Передайте `folder="tournaments"` и текущий `mediaId`; компонент возвращает `mediaId` в поле `coverMediaId`. Библиотеки кропа нет и не добавляется. Рядом с полем — подсказка: «Рекомендуемый размер 1600×600 (соотношение 16:6). На сайте афиша обрезается по центру под это соотношение». Над полем показать предпросмотр кадра: контейнер `aspect-[16/6] w-full max-w-xl overflow-hidden rounded-lg border bg-muted` с `<Picture asset={cover} className="h-full w-full object-cover" sizes="576px" alt="" />` — администратор видит, как будет обрезана картинка. Если компонент `image-upload-field` уже рисует превью — оберните его так, чтобы предпросмотр был именно 16:6 (если у него есть проп `aspect`, передайте `"16/6"`).

**Slug-уникальность.** В action: если слуг занят другим турниром — добавить суффикс `-2`, `-3`… (цикл до 20), а не падать; итоговый slug вернуть в результате.

### 3. Дублирование

Пункт меню «Дублировать» в строке списка и кнопка «Дублировать» на странице редактирования → ссылка `/admin/tournaments/new?from=<id>`. Страница `new/page.tsx` при наличии `from` грузит исходный турнир и передаёт в форму `defaultValues`:

- `title`: заменить номер тура на следующий, если в названии есть `/(\d+)\s*тур/i` (например «Марафон-Промнефтегаз 3 тур» → «… 4 тур»), иначе без изменений;
- `stageNumber`: `stageNumber + 1` (если был);
- `seriesId`, `discipline`, `level`, `categories`, `entryFee`, `prizeFund`, `description`, `coverMediaId`: копируются;
- `startDate`/`endDate`: **пустые** (форма не пройдёт валидацию, пока администратор не выберет даты — в БД столбцы NOT NULL, поэтому дубль создаётся только при сохранении формы, а не заранее);
- `slug`: пустой (генерируется из нового названия);
- `isPublished: false`, `registrationOpen: false`.
Вверху формы показать `Alert`: «Копия турнира «…». Укажите даты — остальное можно оставить».

### 4. Server Actions турниров (`_actions.ts`)

```ts
'use server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { adminAction, ActionError } from '@/lib/admin/action';
import { audit } from '@/lib/admin/audit';
import { TAGS } from '@/lib/cache-tags';
import { tournaments } from '@/lib/schema';
import { tournamentSchema } from './_schema';

export const saveTournament = adminAction(
  tournamentSchema,                       // id?: uuid — есть → update, нет → insert
  async (input, ctx) => {
    const { id: inputId, ...values } = input;
    const slug = await uniqueSlug(ctx.tx, values.slug || values.title, inputId);
    if (inputId) {
      const [before] = await ctx.tx.select().from(tournaments).where(eq(tournaments.id, inputId));
      await ctx.tx.update(tournaments).set({ ...values, slug }).where(eq(tournaments.id, inputId));
      await audit(ctx.userId, 'tournament.update', 'tournament', inputId, { before, after: { ...values, slug } }, ctx.tx);
      return { id: inputId, slug };
    }
    const [row] = await ctx.tx.insert(tournaments).values({ ...values, slug }).returning({ id: tournaments.id });
    await audit(ctx.userId, 'tournament.create', 'tournament', row!.id, { after: { ...values, slug } }, ctx.tx);
    return { id: row!.id, slug };
  },
  { tags: [TAGS.tournaments] },
);
export const togglePublishTournament = adminAction(
  z.object({ id: z.string().uuid(), value: z.boolean() }),
  async (input, ctx) => {
    await ctx.tx.update(tournaments).set({ isPublished: input.value }).where(eq(tournaments.id, input.id));
    await audit(ctx.userId, 'tournament.toggle', 'tournament', input.id, { isPublished: input.value }, ctx.tx);
  },
  { tags: [TAGS.tournaments] },
);
export const deleteTournament = adminAction(
  z.object({ id: z.string().uuid() }),
  async (input, ctx) => {
    // delete + перехват 23503 → throw new ActionError('Нельзя удалить: …')
    await audit(ctx.userId, 'tournament.delete', 'tournament', input.id, undefined, ctx.tx);
  },
  { tags: [TAGS.tournaments] },
);
```

`_schema.ts`:

```ts
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Укажите дату');
export const DISCIPLINES = ['free_pyramid','combined_pyramid','dynamic_pyramid','moscow_pyramid','free_pyramid_continuation','pool','other'] as const;
export const LEVELS = ['regional_championship','regional_youth','club','other'] as const;
export const tournamentSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().max(120).regex(/^[a-z0-9-]*$/),          // пустой → сгенерировать на сервере
  seriesId: z.string().uuid().nullable(),
  stageNumber: z.number().int().min(1).max(99).nullable(),
  discipline: z.enum(DISCIPLINES).nullable(),
  level: z.enum(LEVELS),
  categories: z.array(z.string().trim().min(1).max(40)).max(12),
  startDate: isoDate, endDate: isoDate,
  entryFee: z.number().int().min(0).nullable(),
  prizeFund: z.number().int().min(0).nullable(),
  description: z.string().trim().max(600).nullable(),
  coverMediaId: z.string().uuid().nullable(),
  registrationOpen: z.boolean(),
  isPublished: z.boolean(),
}).refine(v => v.endDate >= v.startDate, { path: ['endDate'], message: 'Дата окончания раньше начала' });
```

В форме числовые поля Input → `number | null` (пустая строка → `null`).

Удаление: если `deleteTournament` падает на FK (на турнир ссылаются заявки `leads.tournamentId`) — поймать ошибку Postgres `23503` и вернуть понятное «Нельзя удалить: на турнир есть заявки. Снимите публикацию». Если FK в схеме `ON DELETE SET NULL` — удаление просто пройдёт.

`labels.ts` (подписи): `free_pyramid` «Свободная пирамида», `combined_pyramid` «Комбинированная пирамида», `dynamic_pyramid` «Динамичная пирамида», `moscow_pyramid` «Московская пирамида», `free_pyramid_continuation` «Свободная пирамида с продолжением», `pool` «Американский пул», `other` «Другое»; `regional_championship` «Чемпионат области», `regional_youth` «Первенство области (юноши)», `club` «Клубный турнир», `other` «Другое».

### 5. `/admin/tournaments/series` — серии

Простой CRUD в одной странице: список (название, описание, число турниров), кнопка «Добавить серию» → Dialog с полями `name` (обязательно, до 100), `description` (до 300, необязательно). Редактирование — тот же Dialog. Удаление — `ConfirmDialog`; если у серии есть турниры, перед удалением показать «У серии N турниров, они останутся без серии» (если FK `set null`) либо заблокировать с сообщением (если `restrict`) — проверьте `onDelete` в схеме. Actions `saveSeries`/`deleteSeries` с `tags: [TAGS.tournaments]` (серии читаются через `getTournamentSeries()`, тег тот же). Если в `tournamentSeries` есть `sortOrder` — добавить `sortable-list` и action `reorderSeries`.

### 6. `/admin/promotions` — акции

**Список (`promotions-list.tsx`)** — `sortable-list` (dnd + кнопки ↑/↓) в порядке `sortOrder`. Строка: миниатюра обложки 64×48, название, строка-описание условий («Пн · −50%», «Ежедневно 09:00–12:00»), бейджи «В карусели» / «Выключена» / «Истекла» (если `validTo < getToday()`), Switch `isActive`, кнопки «Изменить», «Удалить». `onReorder(ids)` → `reorderPromotions({ ids })` (в транзакции проставляет `sortOrder = index`).

**Форма (`promotion-form.tsx`)**:

| Поле | Контрол | Правила |
|---|---|---|
| `title` | Input | 3–120 |
| `slug` | Input + автогенерация | уникальность как у турниров |
| `shortText` | Textarea до 220 симв. | показывается в карточке карусели |
| `description` | Textarea (markdown) | до 4000, необязательно |
| `coverMediaId` | `image-upload-field`, `folder="promotions"` | подсказка «Рекомендуется 1200×1200, на сайте обрезается до квадрата-прямоугольника 4:3»; предпросмотр `aspect-[4/3]` |
| `discountPercent` | Input number 0–100 | nullable |
| `daysOfWeek` | `days-of-week-field.tsx` | ToggleGroup `type="multiple"`; пусто = каждый день |
| время `startMin`/`endMin` | `time-window-field.tsx` | см. ниже |
| `target` | Select (`promotion_target`) | подписи: `table_rental` «Аренда стола», `menu_category` «Категория меню», `takeaway` «Заказ на вынос», `other` «Другое» |
| `targetMenuCategoryId` | Select категорий меню | виден **только** при `target = menu_category`, там обязателен; иначе `null` |
| `audienceNote` | Input | «Девушкам», «Студентам по студенческому» |
| `validFrom`/`validTo` | два `<Input type="date">` | nullable, `validTo >= validFrom` |
| `showInCarousel` | Switch «Показывать в карусели на главной» | по умолчанию `true` |
| `isActive` | Switch «Включена» | по умолчанию `true` |

**Дни недели.** `daysOfWeek` — `number[]`, `0 = Вс … 6 = Сб`. Кнопки показываются в порядке `[1,2,3,4,5,6,0]` с подписями `Пн Вт Ср Чт Пт Сб Вс`. Подсказка: «Дни считаются по операционным суткам: ночные часы (00:00–08:59) относятся к предыдущему дню». Если выбраны все 7 или ни одного — сохранять `null` (каждый день).

**Окно времени (`time-window-field.tsx`).** Чекбокс «Только в определённые часы» (по умолчанию выкл → `startMin = endMin = null`). Если вкл — два `<Input type="time" step="1800">` «С» и «До». Тарифы и окна акций хранятся в **минутах от 09:00 операционных суток** (`0..1440`, `end > start`). Преобразование:

```ts
import { clockToMin, minToClock } from '@/lib/dates';
// clockToMin('09:00') = 0, clockToMin('16:00') = 420, clockToMin('02:00') = 1020, minToClock(960) = '01:00'
function toWindow(startClock: string, endClock: string) {
  const startMin = clockToMin(startClock);
  let endMin = clockToMin(endClock);
  if (endClock === '09:00') endMin = 1440;           // «до 09:00 следующего дня» = конец суток
  return { startMin, endMin };
}
```
Валидация: `endMin > startMin`, иначе ошибка «Время окончания должно быть позже начала (операционные сутки: с 09:00 до 09:00)». Под полем — пояснение в клоках: «16:00–02:00 = ночные часы после полуночи» (если `endMin > 900`, показывать «до HH:MM следующей ночи»). При загрузке формы значения выводятся через `minToClock(startMin)` / `minToClock(endMin)` (для `endMin = 1440` показать `09:00`). Оба поля заполнены или оба пусты — иначе ошибка.

`_schema.ts` акции: `startMin`/`endMin` — `z.number().int().min(0).max(1440).nullable()` + `superRefine`: оба `null` или оба заданы и `end > start`; `target === 'menu_category' ⇒ targetMenuCategoryId` обязателен; `daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable()`.

`_queries.ts`: `listPromotions()` (с `coverMedia` через join на `mediaAssets` для миниатюры), `getPromotion(id)`, `listMenuCategoryOptions()` (`id`, `title`, `parentTitle`).

Actions (все `tags: [TAGS.promotions]`): `savePromotion` (upsert + уникальный slug), `deletePromotion`, `togglePromotion` (`isActive`), `reorderPromotions({ ids: string[] })`. Если акция выводится в меню — тег `TAGS.menu` не нужен.

### Структура страницы редактирования

Заголовок через `PageHeader` (`title`, `description`, `actions`): на странице турнира — кнопки «Дублировать» (ссылка) и «Удалить»; внизу формы `FormActions` («Сохранить», «Отмена»). Кнопка «Сохранить» блокируется на время отправки (`Loader2 animate-spin`).

## Acceptance Criteria

- [ ] `/admin/tournaments` показывает предстоящие по условию `endDate >= getToday()`; переключатели «Предстоящие / Прошедшие / Все», выбор года и поиск работают через `searchParams`.
- [ ] Турнир можно создать, отредактировать, снять с публикации, удалить (с подтверждением); при сохранении вызывается `updateTag('tournaments')` (через `adminAction`) и изменение сразу видно на главной и `/tournaments`.
- [ ] В форме: slug автогенерируется (транслитерация), серия выбирается или создаётся inline, категории выбираются чипами + произвольная, диапазон дат задаётся календарём и вручную (без сдвига на сутки), афиша загружается через `image-upload-field` с предпросмотром 16:6.
- [ ] «Дублировать» открывает форму с номером тура +1, пустыми датами, `isPublished=false`; сохранить без дат нельзя.
- [ ] Серии: создание, редактирование, удаление в `/admin/tournaments/series` работают.
- [ ] `/admin/promotions`: CRUD, drag-and-drop порядок (и кнопки ↑/↓) сохраняется, переключатель `isActive` работает; `targetMenuCategoryId` обязателен только для `menu_category`; окно времени хранится в минутах от 09:00 и отображается обратно в обычных часах; невалидные окна отклоняются на клиенте и на сервере.
- [ ] Каждая страница вызывает `await requireAdmin()`, каждый action проходит через `adminAction` (проверка роли, zod, транзакция, `updateTag`) и внутри handler пишет `await audit(ctx.userId, …, ctx.tx)`; без сессии вызов action возвращает `{ ok: false, error: 'Нет доступа' }`.
- [ ] Весь интерфейс на русском, стилизован по `DESIGN.md`; на мобильной ширине 375px формы и таблицы пригодны для использования (таблица скроллится по горизонтали).
- [ ] Ни один файл вне списка «Files to Create» не изменён; новых npm-пакетов нет.
- [ ] `pnpm lint` и `pnpm typecheck` проходят без ошибок.

## Notes

- Строка в БД для однодневного турнира: `startDate = endDate`.
- Формат даты на русском выводится только через `formatEventDate` («5 марта», «5–7 марта», «30 марта – 2 апреля») — свой форматтер не писать.
- `adminAction` не бросает исключений наружу: форма проверяет `res.ok`; при `ok: false` — `toast.error(res.error)` и `form.setError` по `res.fieldErrors`. Ошибки бизнес-логики в handler — `throw new ActionError(msg, fieldErrors?)`.
- Старые турниры сайта (30 событий 2026 года) заводит seed (task-10); эта задача их не создаёт.
