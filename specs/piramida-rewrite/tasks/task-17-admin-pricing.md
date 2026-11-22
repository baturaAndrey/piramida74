# Task 17: Админка — залы, тарифы аренды, доп. услуги, штрафы

## Status

complete

## Wave

5

## Description

Раздел `/admin/pricing`, в котором владелец сам редактирует цены аренды: залы (общий, VIP 1–3), тарифы по дням и времени, дополнительные услуги (нарды, прокат кия) и два прайса штрафов (бой посуды, порча имущества). Из этих данных строятся прайс на сайте, страница `/prices` и калькулятор, поэтому сервер строго проверяет тарифы: пересечения интервалов запрещены (сохранение отклоняется), «дыры» (время без тарифа) допустимы, но показываются предупреждением.

## Dependencies

**Depends on:** task-14-admin-shell.md, task-12-public-queries.md (и транзитивно 03, 06, 08)
**Blocks:** task-28-qa-verification.md

**Context from dependencies:**
- task-03 создал `src/lib/schema/pricing.ts`: `halls` (`name`, `slug`, `kind` enum `common|vip`, `tablesCount`, `seatsPerTable` default 4, `description?`, `sortOrder`, `isActive`), `rentalTariffs` (`hallId`, `daysOfWeek smallint[]` где `0 = вс … 6 = сб` и день — это день **операционных суток D**, `startMin`, `endMin` — минуты от 09:00 операционных суток, `0..1440`, `end > start`, `price` целое число рублей, `priceUnit` enum `per_hour|fixed|per_session`, `audience` enum `all|pensioner`, `label`, `validFrom?`, `validTo?`, `isActive`, `sortOrder`), `extraServices` (`name`, `price`, `priceUnit`, `isActive`, `sortOrder`, …), `penaltyItems` (`kind` enum `dishware|property`, `name`, `price`, `priceIsMinimum`, `sortOrder`, `isActive`). **Прочитайте файл схемы перед началом** и подстройте имена колонок и FK (`onDelete`) под факт.
- task-14 создал каркас админки и общие компоненты `src/components/admin/{data-table,sortable-list,confirm-dialog,form-actions,page-header}.tsx`, `src/lib/admin/action.ts`, `src/lib/admin/audit.ts`. **Откройте компоненты** и возьмите их точные пропсы. Контракт `adminAction` (зафиксирован):
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
  Порядок: `requireAdminAction()` (нет админа → `{ ok: false, error: 'Нет доступа' }`) → `schema.safeParse` (ошибка → `fieldErrors`) → `db.transaction(tx => handler(input, { userId, tx }))` → после коммита `updateTag` по тегам → `{ ok: true, data }`. Ошибка для пользователя — `throw new ActionError('текст', fieldErrors?)` (транзакция откатывается, клиент получает `{ ok: false, error }`).
  Аудит обёртка **не пишет** — его вызывает handler в той же транзакции: `import { audit } from '@/lib/admin/audit'`, `audit(userId: string, action: string, entity: string, entityId: string, diff?: unknown, tx?: DbOrTx): Promise<void>` → `await audit(ctx.userId, 'tariff.update', 'tariff', id, diff, ctx.tx)`.
- task-12 создал `src/lib/cache-tags.ts` (`TAGS.pricing`). `src/lib/queries/**` менять нельзя; админка читает БД напрямую из `_queries.ts`.
- task-06: `src/lib/dates.ts` (`minToClock`, `clockToMin`, `getToday`), `src/lib/slug.ts` (`slugify`).
- task-08: `src/lib/session.ts` — `requireAdmin()` (только страницы/layout'ы, redirect на `/login`); `requireAdminAction()` (Server Actions/route handlers, бросает `Error('UNAUTHORIZED')`) вызывается внутри `adminAction`, напрямую не нужен — route handlers задача не создаёт.
- Seed (task-10) заполняет данные из `<section id="price">` старого сайта: Общий зал Вс–Чт 09–16 = 580, 16–02 = 640; Пт–Сб 09–16 = 680, 16–02 = 760; ежедневно 02–09 = 3500 ₽/ч; VIP ежедневно 09–02 = 1400, 02–09 = 4800 ₽/ч; пенсионный 09–12 = 200; прокат нарды/шахматы 250, кий 250 руб/час; 56 штрафов (33 «бой посуды» и 23 «порча имущества»).

## Files to Create

- `src/app/(admin)/admin/pricing/page.tsx` — страница с табами (сервер: `requireAdmin` + загрузка данных)
- `src/app/(admin)/admin/pricing/_components/pricing-tabs.tsx` — клиентские Tabs (`?tab=halls|tariffs|extras|penalties`)
- `src/app/(admin)/admin/pricing/_components/halls-tab.tsx` — таблица залов + диалог формы
- `src/app/(admin)/admin/pricing/_components/tariffs-tab.tsx` — тарифы, сгруппированные по залам
- `src/app/(admin)/admin/pricing/_components/tariff-form-dialog.tsx` — диалог создания/редактирования тарифа
- `src/app/(admin)/admin/pricing/_components/tariff-warnings.tsx` — блок предупреждений (дыры)
- `src/app/(admin)/admin/pricing/_components/time-select.tsx` — Select времени в «операционных» минутах
- `src/app/(admin)/admin/pricing/_components/extras-tab.tsx` — доп. услуги
- `src/app/(admin)/admin/pricing/_components/penalties-tab.tsx` — два списка штрафов с inline-редактированием
- `src/app/(admin)/admin/pricing/_lib/tariff-analysis.ts` — чистые функции `findOverlaps`, `findHoles`, `analyzeTariffs` (без зависимости от БД и React)
- `src/app/(admin)/admin/pricing/_lib/labels.ts` — подписи дней недели, enum'ов, форматтеры «время», «дни»
- `src/app/(admin)/admin/pricing/_schema.ts` — zod-схемы
- `src/app/(admin)/admin/pricing/_queries.ts` — `getPricingAdminData()`
- `src/app/(admin)/admin/pricing/_actions.ts` — `'use server'`, все actions раздела

## Files to Modify

Нет. Не трогать схему, `src/lib/queries/**`, `package.json`, `globals.css`, `src/app/(admin)/admin/layout.tsx`, `src/components/admin/*`, `src/components/ui/*` (если нет `tabs`, `select`, `switch`, `toggle-group`, `alert`, `form` — сообщите, не добавляйте).

## Technical Details

### Общие правила

1. `page.tsx`: синхронный компонент → `<Suspense fallback={<Skeleton/>}><Content searchParams={searchParams}/></Suspense>`; async `Content` вызывает `await requireAdmin()` и `getPricingAdminData()`. Если task-14 задал другой шаблон страниц — следуйте ему.
2. Все мутации — через `adminAction(schema, async (input, ctx) => { … }, { tags: [TAGS.pricing] })` (`updateTag` внутри обёртки; тег `pricing` также сбрасывает каталог калькулятора). Каждый handler сам пишет аудит: `await audit(ctx.userId, '<entity>.<op>', '<entity>', id, diff, ctx.tx)`; сущности `hall`, `tariff`, `extra_service`, `penalty`; операции `create`, `update`, `delete`, `toggle`, `duplicate`, `reorder` (для `reorder` `entityId = '*'`, `diff = { ids }`).
3. Формы — `react-hook-form` + `zodResolver` + shadcn `Form`; успех — `toast.success`, затем `router.refresh()` (страница динамическая, предупреждения пересчитываются); ошибка — `toast.error`.
4. Удаление — через `ConfirmDialog`.
5. Интерфейс на русском, по `DESIGN.md`. Таблицы на мобильных — горизонтальный скролл.
6. Табы: активный таб хранится в URL (`?tab=…`), переключение — `router.replace(`${pathname}?tab=${v}`, { scroll:false })`.

### Модель времени (важно для вкладки «Тарифы»)

Тарифы хранятся в **минутах от 09:00 операционных суток**. Операционные сутки: с 09:00 даты D до 09:00 даты D+1. `daysOfWeek` — день D.

| Часы на стене | startMin / endMin |
|---|---|
| 09:00–16:00 | 0–420 |
| 16:00–02:00 | 420–1020 |
| 02:00–09:00 | 1020–1440 |

Полночь (00:00) = минута **900**. Функции `minToClock(min)` / `clockToMin(hhmm)` из `src/lib/dates.ts`: `minToClock(0) = '09:00'`, `minToClock(960) = '01:00'`, `minToClock(1440) = '09:00'`.

**Ввод времени — `time-select.tsx`**, а не `<input type="time">`: это снимает неоднозначность «09:00 — начало или конец суток». Select с опциями каждые 30 минут в порядке операционных суток:

```tsx
// kind='start': значения 0..1410, kind='end': значения 30..1440
const options = Array.from({ length: 48 }, (_, i) => i * 30)
  .filter(m => (kind === 'start' ? m <= 1410 : m >= 30 && m <= 1440))
  .concat(kind === 'end' ? [1440] : [])           // 1440 подписывается «09:00 (конец суток)»
  .filter((m, i, a) => a.indexOf(m) === i);
// label: minToClock(m) + (m >= 900 && m < 1440 ? ' — ночь' : '') ; для 1440: '09:00 (утро следующего дня)'
```
Подсказка под полем: «Ночные часы (00:00–08:59) считаются частью предыдущего дня. 02:00–09:00 в «Пятнице» — это ночь на субботу».

Пользователь также может ввести нестандартную минуту (например 09:15)? Нет: шаг только 30 мин (калькулятор работает с получасовыми интервалами).

**Подпись «ночь» в таблице:** функция `describeRange(startMin, endMin, days)` в `labels.ts`:
- `startMin >= 900` → «ночь на {дни+1}» (например Пт → «ночь на Сб»; метки дней сдвигаются на +1 по модулю 7);
- `startMin < 900 < endMin` → «через полночь (до {minToClock(endMin)} на {дни+1})»;
- иначе пусто.
Время в ячейке: `${minToClock(startMin)}–${minToClock(endMin)}` (для `endMin = 1440` → `…–09:00`).

**Подпись дней:** `[0,1,2,3,4]` → «Вс–Чт», `[5,6]` → «Пт–Сб», все семь → «Ежедневно», иначе перечисление «Пн, Ср, Пт». Порядок отображения дней: `[1,2,3,4,5,6,0]`.

### Анализ тарифов — `_lib/tariff-analysis.ts`

Чистые функции, пригодные для юнит-тестов:

```ts
export type TariffLike = {
  id?: string; hallId: string; daysOfWeek: number[]; startMin: number; endMin: number;
  audience: 'all' | 'pensioner'; validFrom: string | null; validTo: string | null; isActive: boolean;
};
export type Overlap = { a: TariffLike; b: TariffLike; days: number[] };
export type Hole = { hallId: string; days: number[]; fromMin: number; toMin: number };

const validityIntersects = (a: TariffLike, b: TariffLike) =>
  (a.validFrom ?? '0000-00-00') <= (b.validTo ?? '9999-99-99') &&
  (b.validFrom ?? '0000-00-00') <= (a.validTo ?? '9999-99-99');

/** Пересечения внутри одного зала и одной аудитории (all и pensioner проверяются отдельно друг от друга). */
export function findOverlaps(tariffs: TariffLike[]): Overlap[] {
  const act = tariffs.filter(t => t.isActive);
  const res = new Map<string, Overlap>();
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j];
    if (a.hallId !== b.hallId || a.audience !== b.audience) continue;
    if (!validityIntersects(a, b)) continue;
    if (!(a.startMin < b.endMin && b.startMin < a.endMin)) continue;     // интервалы [start,end) не пересекаются
    const days = a.daysOfWeek.filter(d => b.daysOfWeek.includes(d));
    if (days.length) res.set(`${i}:${j}`, { a, b, days });
  }
  return [...res.values()];
}

/** «Дыры» 0..1440 для audience='all'; учитываются только тарифы, действующие на дату `today`. Пенсионные тарифы не учитываются. */
export function findHoles(tariffs: TariffLike[], hallIds: string[], today: string): Hole[] {
  // для каждого зала и дня 0..6: взять интервалы, отсортировать по startMin, пройти курсором от 0;
  // зазор cursor < start → дыра [cursor,start); в конце cursor < 1440 → дыра [cursor,1440).
  // Затем объединить дни с одинаковыми дырами в одну запись (days: [0,1,2,3,4]).
  // Зал без единого тарифа → одна дыра 0..1440 на все дни.
}

export function analyzeTariffs(all: TariffLike[], activeHallIds: string[], today: string) {
  return { overlaps: findOverlaps(all), holes: findHoles(all, activeHallIds, today) };
}
```
Реализуйте `findHoles` полностью (слияние интервалов, объединение дней по совпадающему набору дыр). Тариф с `priceUnit = 'fixed'` для покрытия считается так же, как и почасовой.

**Отображение предупреждений** (`tariff-warnings.tsx`): `Alert` (желтоватый: `border-amber-300 bg-amber-50 text-amber-900`, иконка `AlertTriangle`) над таблицей тарифов, список строк «Общий зал · Пн–Чт · нет тарифа 02:00–03:00 — калькулятор покажет предупреждение «уточните у администратора»». Если пересечения есть (в БД они возможны только из seed/ручных правок) — `variant="destructive"` Alert с перечислением «Пересечение: …». Если проблем нет — зелёная строка «Тарифы покрывают сутки без дыр и пересечений» (`text-green-600`).

### Server Actions (`_actions.ts`, все с `tags: [TAGS.pricing]`)

**Залы:** `saveHall` (upsert; slug из `slugify(name)`, уникальность с суффиксом `-2`; `kind`; `tablesCount` ≥ 1; для `vip` по умолчанию 1; `seatsPerTable` 1–12), `deleteHall` (если у зала есть тарифы — ошибка «У зала N тарифов. Удалите или перенесите их»), `toggleHall` (isActive), `reorderHalls({ ids })`.

**Тарифы:**

```ts
// import { adminAction, ActionError } from '@/lib/admin/action'; import { audit } from '@/lib/admin/audit';
export const saveTariff = adminAction(tariffSchema, async (input, ctx) => {
  // 1) загрузить остальные тарифы того же зала (кроме input.id)
  const others = await ctx.tx.select().from(rentalTariffs).where(and(eq(rentalTariffs.hallId, input.hallId), input.id ? ne(rentalTariffs.id, input.id) : undefined));
  // 2) пересечения, затрагивающие кандидата
  const candidate = { ...input, id: input.id ?? '__new__' };
  const bad = findOverlaps([...others, candidate]).filter(o => o.a.id === candidate.id || o.b.id === candidate.id);
  if (input.isActive && bad.length) throw new ActionError(formatOverlaps(bad));   // сохранение отклонено, ничего не записано
  // 3) insert/update через ctx.tx → id
  await audit(ctx.userId, input.id ? 'tariff.update' : 'tariff.create', 'tariff', id, { after: input }, ctx.tx);
  // 4) вернуть { id, warnings: formatHoles(findHoles(...)) } — дыры только предупреждение
  return { id, warnings };
}, { tags: [TAGS.pricing] });
```
(`ActionError` экспортируется из `src/lib/admin/action.ts`; обёртка превращает его в `{ ok: false, error }`.) Сообщение об отклонении: «Пересечение с тарифом «{label}» ({дни}, {HH:MM–HH:MM}). Измените время или дни». После сохранения клиент показывает `toast.warning` с предупреждением о дырах, если они есть.

Остальные: `deleteTariff`, `toggleTariff` (isActive; при включении — та же проверка пересечений), `duplicateTariff({ id })` → создаёт копию **неактивной** (`isActive=false`, `label` + « (копия)») — чтобы не нарушить проверку пересечений.

`tariffSchema`:
```ts
z.object({
  id: z.string().uuid().optional(),
  hallId: z.string().uuid(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, 'Выберите хотя бы один день').refine(a => new Set(a).size === a.length),
  startMin: z.number().int().min(0).max(1410).multipleOf(30),
  endMin: z.number().int().min(30).max(1440).multipleOf(30),
  price: z.number().int().min(0).max(1_000_000),
  priceUnit: z.enum(['per_hour', 'fixed']),               // per_session в тарифах не используется
  audience: z.enum(['all', 'pensioner']),
  label: z.string().trim().max(120),
  validFrom: isoDate.nullable(), validTo: isoDate.nullable(),
  isActive: z.boolean(),
}).refine(v => v.endMin > v.startMin, { path: ['endMin'], message: 'Конец должен быть позже начала' })
 .refine(v => !v.validFrom || !v.validTo || v.validTo >= v.validFrom, { path: ['validTo'], message: 'Период задан неверно' });
```

**Доп. услуги:** `saveExtra`, `deleteExtra`, `toggleExtra`, `reorderExtras`. Поля: `name` (до 120), `price` (целое ≥ 0), `priceUnit` (`per_hour` — «руб/час», `per_session` — «руб за раз», `fixed` — «руб»; оставьте только значения enum `price_unit`), `isActive`.

**Штрафы:** `savePenalty` (создание и обновление одной строки: `kind`, `name` до 200, `price` ≥ 0, `priceIsMinimum`, `isActive`), `deletePenalty`, `reorderPenalties({ kind, ids })` (в транзакции проставляет `sortOrder = index` только для переданных id данного `kind`).

### UI вкладок

**Залы** (`halls-tab.tsx`): `sortable-list` строк: название, бейдж `kind` («Общий» / «VIP»), «N столов × M мест», Switch активности, «Изменить» (Dialog с формой), «Удалить». Кнопка «Добавить зал».

**Тарифы** (`tariffs-tab.tsx`): сверху `TariffWarnings` и кнопка «Добавить тариф». Затем для каждого зала (в порядке `sortOrder`) — `Card` с заголовком «Общий зал» и таблицей: Дни | Время (+ серая подпись «ночь на Сб») | Цена («640 ₽/час» или «3 500 ₽ за ночь» для `fixed`; число — `toLocaleString('ru-RU')`) | Аудитория (`all` → «Все», `pensioner` → бейдж «Пенсионный») | Период (`validFrom–validTo` или «Бессрочно») | Switch активности | меню «Изменить / Дублировать / Удалить». Сортировка строк: по первому дню (порядок `[1..6,0]`), затем `startMin`. Тарифы без назначения (пустые залы) — пустое состояние «Тарифов нет».

Форма тарифа (`tariff-form-dialog.tsx`): Select зала; дни — `ToggleGroup type="multiple"` + быстрые кнопки «Вс–Чт», «Пт–Сб», «Ежедневно»; `TimeSelect` «Начало» и «Конец»; цена (Input number, ₽); единица («за час» / «за ночь/сеанс, фиксированно»); аудитория; подпись (`label`, например «Будни, день»); период действия (два date-input, необязательно); Switch «Активен». Под формой — живая подсказка «Это интервал {дни}, {время} {ночь на …}».

**Доп. услуги** (`extras-tab.tsx`): `sortable-list`, строка: название, цена, единица, Switch, изменить/удалить (Dialog).

**Штрафы** (`penalties-tab.tsx`): два блока-`Card` «Бой посуды» и «Порча имущества». Внутри каждого — поле поиска по названию (фильтр на клиенте) и `sortable-list`. Строка редактируется на месте: Input названия (`flex-1`), Input цены (`w-28`, число), Checkbox «от» (`priceIsMinimum`: на сайте цена выводится как «от 500 ₽»), Switch активности, кнопка-иконка «Сохранить» (`Check`, активна только если строка изменена — отслеживайте `dirty` по сравнению с исходным значением), кнопка «Удалить» (`Trash2` + `ConfirmDialog`). Кнопка «Добавить позицию» вставляет в начало пустую черновую строку, которая сохраняется отдельным `savePenalty` (без `id`). При перетаскивании вызывается `reorderPenalties`.

### Запросы (`_queries.ts`)

```ts
export async function getPricingAdminData() {
  const [halls, tariffs, extras, penalties] = await Promise.all([
    db.select().from(halls).orderBy(asc(halls.sortOrder)),
    db.select().from(rentalTariffs).orderBy(asc(rentalTariffs.sortOrder)),
    db.select().from(extraServices).orderBy(asc(extraServices.sortOrder)),
    db.select().from(penaltyItems).orderBy(asc(penaltyItems.sortOrder)),
  ]);
  const warnings = analyzeTariffs(tariffs, halls.filter(h => h.isActive).map(h => h.id), getToday());
  return { halls, tariffs, extras, penalties, warnings };
}
```

## Acceptance Criteria

- [ ] `/admin/pricing` содержит 4 вкладки (Залы, Тарифы, Доп. услуги, Штрафы); активная хранится в `?tab=`; страница вызывает `await requireAdmin()`.
- [ ] Залы: CRUD, drag-and-drop порядок, переключатель активности; удаление зала с тарифами отклоняется понятным сообщением.
- [ ] Тарифы показаны сгруппированно по залам; время выводится обычными часами (`minToClock`), ночные интервалы подписаны («ночь на Сб»); поддерживаются `fixed`, пенсионная аудитория и срок действия.
- [ ] Выбор времени — Select с шагом 30 минут в порядке операционных суток (09:00 → … → 08:30 → 09:00 конец суток); значения сохраняются как минуты 0..1440.
- [ ] Сохранение тарифа, пересекающегося с активным тарифом того же зала и аудитории по дням и времени, **отклоняется на сервере** с описанием конфликта; ничего не записывается.
- [ ] «Дыры» (время 0–1440 без тарифа `audience=all`, по каждому залу и дню) не блокируют сохранение, а выводятся списком предупреждений над таблицей и `toast.warning` после сохранения; сутки без дыр показывают зелёное подтверждение.
- [ ] Пенсионные тарифы не участвуют в расчёте дыр и не конфликтуют с обычными.
- [ ] Доп. услуги и два списка штрафов (inline-редактирование, «от», сортировка, добавление, удаление с подтверждением) работают.
- [ ] Все actions идут через `adminAction` с `tags: [TAGS.pricing]` и пишут `await audit(ctx.userId, …, ctx.tx)` внутри handler; цены на сайте (и в калькуляторе) обновляются сразу после сохранения; без сессии action возвращает `{ ok: false, error: 'Нет доступа' }`.
- [ ] Весь UI на русском, по `DESIGN.md`, пригоден на ширине 375px.
- [ ] Никаких новых npm-пакетов; файлы вне списка не изменены.
- [ ] `pnpm lint` и `pnpm typecheck` проходят без ошибок.

## Notes

- Цены у клуба подтверждает владелец (ночной тариф 3500 ₽/ч и VIP 4800 ₽/ч — см. action-required.md). Админка обязана позволять править их без участия разработчика.
- `tariff-analysis.ts` намеренно не зависит от БД: при желании реализующий агент может добавить рядом `tariff-analysis.test.ts` (Vitest уже установлен в task-01), но обязательным это не является.
- Для VIP-комнат у зала `tablesCount = 1`, цена тарифа — за комнату.
