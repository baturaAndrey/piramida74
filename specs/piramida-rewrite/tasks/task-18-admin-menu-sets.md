# Task 18: Админка — меню, варианты и сетки цен, добавки, массовое изменение цен, банкетные сеты

## Status

pending

## Wave

5

## Description

Админка меню бара и кухни (около 260 позиций из `res/`) и банкетных сетов. Владелец управляет деревом категорий (drag-and-drop), позициями с вариантами объёма и цен или общими сеткой цен (чаи, лимонады), платными добавками, массово меняет цены (+/−N% или +N ₽ с предпросмотром) и собирает банкетные сеты из позиций меню. Эти данные питают `/menu`, калькулятор (через короткие коды позиций) и главную.

## Dependencies

**Depends on:** task-14-admin-shell.md, task-12-public-queries.md (и транзитивно 03, 06, 08, 09)
**Blocks:** task-28-qa-verification.md

**Context from dependencies:**
- task-03 создал `src/lib/schema/menu.ts`: `menuCategories` (`parentId?`, `title`, `slug`, `funFactTitle?`, `funFactText?`, `priceGroupId?`, `sortOrder`, `isActive`), `priceGroups` (`name`, `description?`, `sortOrder`) + `priceGroupTiers` (`groupId`, `code varchar(8) unique`, `label`, `amount?`, `unit?`, `price`, `sortOrder`), `menuItems` (`categoryId`, `code varchar(8) unique`, `name`, `description?`, `choiceNote?`, `originCountry?`, `priceGroupId?`, `imageMediaId?`, `isTakeawayDiscount`, `isActive`, `sortOrder`), `menuItemVariants` (`itemId`, `code varchar(8) unique`, `label?`, `amount numeric?`, `unit measure_unit?` = `g|ml|l|pcs`, `price`, `sortOrder`), `menuModifiers` (`name`, `price`, `categoryId?`, `isActive`, `sortOrder`), `banquetSets` (`code`, `title`, `description`, `coverMediaId?`, `pricingMode` enum `per_person|fixed`, `price`, `minGuests?`, `maxGuests?`, `isActive`, `sortOrder`), `banquetSetItems` (`setId`, `menuItemVariantId?`, `customLabel?`, `qty`, `sortOrder`). Все id — UUID; цены — целые рубли. **Прочитайте файл схемы перед началом**: nullable и `onDelete` берите оттуда.
- **Правило цен позиции (contracts.md):** у позиции **либо** не меньше одного `menuItemVariants` и `priceGroupId = null`, **либо** ноль вариантов и сетка цен `item.priceGroupId ?? category.priceGroupId` (своя сетка позиции или унаследованная от категории). Позиция без вариантов и без сетки (ни своей, ни у категории) недопустима. Проверяется в zod и в Server Action.
- **Калькулятор (task-05 `buildMenuVariants`, task-12 `getCalculatorCatalog`)** включает в `menuVariants` все активные позиции: с вариантами — по записи на вариант (`code = variant.code`); с сеткой и без вариантов — по записи на уровень сетки, `code = \`${item.code}-${tier.code}\``, `label = tier.label`, `price = tier.price`. Поэтому `priceGroupTiers.code` так же стабилен, как коды позиций и вариантов (он входит в URL калькулятора `?i=<item.code>-<tier.code>:2`).
- task-14: каркас админки, `src/components/admin/{data-table,sortable-list,image-upload-field,media-picker,confirm-dialog,form-actions,page-header}.tsx`, `src/lib/admin/action.ts`, `src/lib/admin/audit.ts`. **Откройте компоненты** и возьмите их точные пропсы. Контракт `adminAction` (зафиксирован):
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
  Порядок: `requireAdminAction()` (нет админа → `{ ok: false, error: 'Нет доступа' }`) → `schema.safeParse` (→ `fieldErrors`) → `db.transaction(tx => handler(input, { userId, tx }))` → после коммита `updateTag` по тегам → `{ ok: true, data }`. Ошибка для пользователя — `throw new ActionError('текст', fieldErrors?)`.
  Аудит обёртка **не пишет** — handler сам: `import { audit } from '@/lib/admin/audit'`, `audit(userId: string, action: string, entity: string, entityId: string, diff?: unknown, tx?: DbOrTx): Promise<void>` → `await audit(ctx.userId, 'menu_item.update', 'menu_item', id, diff, ctx.tx)`.
- task-12: `TAGS.menu`, `TAGS.sets` из `src/lib/cache-tags.ts`. Каталог калькулятора (`getCalculatorCatalog`) помечен тегами `pricing`, `menu`, `sets`, `promotions` — любая мутация с `TAGS.menu` или `TAGS.sets` обновляет и калькулятор. `src/lib/queries/**` менять нельзя; админка читает БД напрямую из `_queries.ts`.
- task-06: `nanoCode()` из `src/lib/slug.ts` (6 символов `0-9a-z`), `slugify`.
- task-08: `src/lib/session.ts` — `requireAdmin()` (страницы/layout'ы, redirect на `/login`); `requireAdminAction()` (Server Actions/route handlers, бросает `Error('UNAUTHORIZED')`) — здесь напрямую нужен только в `previewBulkPrice` (см. §5). task-09: `mediaAssets`, `<Picture>`.
- Код (`code`) позиций, вариантов, уровней сеток и сетов используется в URL калькулятора (`?i=<code>:2`, `?i=<item.code>-<tier.code>:1`, `?s=<code>:8`), поэтому он стабилен: **никогда не перегенерируется** при редактировании.

## Files to Create

Меню:
- `src/app/(admin)/admin/menu/page.tsx` — дерево категорий слева + позиции выбранной категории справа (`?cat=<id>`)
- `src/app/(admin)/admin/menu/items/new/page.tsx` — новая позиция (`?cat=<id>`)
- `src/app/(admin)/admin/menu/items/[id]/page.tsx` — редактирование позиции
- `src/app/(admin)/admin/menu/price-groups/page.tsx` — сетки цен
- `src/app/(admin)/admin/menu/modifiers/page.tsx` — платные добавки
- `src/app/(admin)/admin/menu/bulk-price/page.tsx` — массовое изменение цен
- `src/app/(admin)/admin/menu/_components/menu-nav.tsx` — под-навигация: Позиции | Сетки цен | Добавки | Массовое изменение цен
- `src/app/(admin)/admin/menu/_components/category-tree.tsx` — дерево с сортировкой (клиент)
- `src/app/(admin)/admin/menu/_components/category-dialog.tsx` — форма категории
- `src/app/(admin)/admin/menu/_components/items-list.tsx` — список позиций категории (сортировка, активность, быстрая цена)
- `src/app/(admin)/admin/menu/_components/item-form.tsx` — форма позиции
- `src/app/(admin)/admin/menu/_components/variants-table.tsx` — inline-таблица вариантов (`useFieldArray` + сортировка)
- `src/app/(admin)/admin/menu/_components/price-groups-manager.tsx` — CRUD сеток цен с тарифами
- `src/app/(admin)/admin/menu/_components/modifiers-manager.tsx`
- `src/app/(admin)/admin/menu/_components/bulk-price-form.tsx` — форма, предпросмотр, применение
- `src/app/(admin)/admin/menu/_lib/labels.ts` — подписи единиц (`g` «г», `ml` «мл», `l` «л», `pcs` «шт»), форматтеры цены/выхода
- `src/app/(admin)/admin/menu/_lib/bulk-price.ts` — чистая функция расчёта новых цен и округления
- `src/app/(admin)/admin/menu/_schema.ts` — zod-схемы
- `src/app/(admin)/admin/menu/_queries.ts` — чтение для админки
- `src/app/(admin)/admin/menu/_actions.ts` — `'use server'`, actions меню

Банкетные сеты:
- `src/app/(admin)/admin/banquet-sets/page.tsx` — список (сортируемый)
- `src/app/(admin)/admin/banquet-sets/new/page.tsx`
- `src/app/(admin)/admin/banquet-sets/[id]/page.tsx`
- `src/app/(admin)/admin/banquet-sets/_components/sets-list.tsx`
- `src/app/(admin)/admin/banquet-sets/_components/set-form.tsx`
- `src/app/(admin)/admin/banquet-sets/_components/composition-editor.tsx` — состав: строки «позиция меню × кол-во» или «свой текст × кол-во»
- `src/app/(admin)/admin/banquet-sets/_components/variant-picker.tsx` — поиск и выбор варианта позиции меню (Popover + Input-фильтр; без зависимости от `command`)
- `src/app/(admin)/admin/banquet-sets/_schema.ts`
- `src/app/(admin)/admin/banquet-sets/_queries.ts` — `listSets`, `getSet`, `listVariantOptions` (id, code, `itemName`, `label`, `price`)
- `src/app/(admin)/admin/banquet-sets/_actions.ts` — `'use server'`

## Files to Modify

Нет. Не трогать схему, `src/lib/queries/**`, `package.json`, `globals.css`, admin layout, `src/components/admin/*`, `src/components/ui/*`. Если нужного shadcn-компонента (`form`, `select`, `switch`, `tabs`, `popover`, `radio-group`, `alert`, `table`, `badge`, `checkbox`) нет — сообщите в отчёте, не добавляйте.

## Technical Details

### Общие правила

1. Каждая страница: синхронный компонент → `<Suspense fallback=…>` → async `Content` с `await requireAdmin()` и запросами из `_queries.ts` (cacheComponents требует Suspense вокруг обращений к БД). Следуйте шаблону task-14, если он отличается.
2. Мутации меню: `adminAction(schema, async (input, ctx) => { … }, { tags: [TAGS.menu] })` (категории, позиции, сетки цен и их уровни, добавки — всё `TAGS.menu`, этот же тег сбрасывает каталог калькулятора). Мутации, затрагивающие варианты (цены, удаление) и сеты: `tags: [TAGS.menu, TAGS.sets]`. Мутации сетов: `tags: [TAGS.sets]` (+ `TAGS.menu` не нужен). Каждый handler пишет аудит сам: `await audit(ctx.userId, '<entity>.<op>', '<entity>', id, diff, ctx.tx)`; сущности `menu_category`, `menu_item`, `price_group`, `menu_modifier`, `banquet_set`, `menu_bulk_price`; операции `create`, `update`, `delete`, `toggle`, `reorder`, `price`, `apply` (для `reorder` и массовых операций `entityId = '*'`).
3. Формы — `react-hook-form` + `zodResolver` + shadcn `Form`. Успех — `toast.success`, `router.refresh()` или переход на список. Ошибки — `toast.error` + `setError`.
4. Удаление — `ConfirmDialog`.
5. Интерфейс на русском, по `DESIGN.md`; на 375px списки и формы пригодны.
6. Сортировка: `sortable-list` (dnd-kit + кнопки ↑/↓). Actions переупорядочивания принимают массив id в новом порядке и в транзакции проставляют `sortOrder = index`.
7. **Генерация кодов.** Только при создании строки:

```ts
async function newCode(tx, table: typeof menuItems | typeof menuItemVariants | typeof banquetSets | typeof priceGroupTiers) {
  for (let i = 0; i < 8; i++) {
    const code = nanoCode();
    const [hit] = await tx.select({ id: table.id }).from(table).where(eq(table.code, code)).limit(1);
    if (!hit) return code;
  }
  throw new ActionError('Не удалось сгенерировать код');
}
// вызов: const code = await newCode(ctx.tx, menuItems)
```
Коды генерируются для `menuItems`, `menuItemVariants`, `priceGroupTiers` и `banquetSets`. Код показывается в формах только для чтения (серым моноширинным шрифтом, `font-mono text-xs`) с кнопкой «Копировать».

### 1. Страница `/admin/menu`

Двухколоночная раскладка: слева (`md:w-80`) `CategoryTree`, справа список позиций выбранной категории (`?cat=<id>`, по умолчанию первая). На мобильных — колонки друг под другом, выбор категории — Select над списком. Сверху `PageHeader` + `MenuNav`.

**Дерево категорий.** Два уровня (категория → подкатегория). Рендер: вложенные списки; в каждом уровне `sortable-list` (перетаскивание только внутри своего родителя). Строка: название, число позиций, бейдж «сетка цен: {название}» если задана, Switch `isActive`, меню (Изменить, Добавить подкатегорию, Удалить). Кнопка «Добавить категорию». Действие `reorderCategories({ parentId: string | null, ids: string[] })`. Перенос между родителями — через форму категории (поле «Родитель»).

**Форма категории (`category-dialog.tsx`)**: `title`, `slug` (автоген., уникальный; при коллизии суффикс `-2`), `parentId` (Select: «Без родителя» + только категории верхнего уровня; категорию, у которой есть дочерние, нельзя сделать дочерней — глубина максимум 2; сама на себя ссылаться нельзя), `funFactTitle` («Интересный факт»), `funFactText` (Textarea ≤ 400), `priceGroupId` (Select «Без общей сетки» + список сеток; подсказка: «Для чая, лимонадов: заголовок сетки (объёмы и цены) показывается над позициями на /menu»), `isActive`. `saveCategory` отклоняет снятие/смену `priceGroupId` на `null`, если в категории есть позиции без своих вариантов и без своей сетки (сообщение «N позиций берут цены из сетки категории — задайте им сетку или варианты»). Actions: `saveCategory`, `deleteCategory` (запрещено, пока есть позиции или подкатегории: сообщение «В категории N позиций — перенесите или удалите их»), `toggleCategory`, `reorderCategories`.

**Список позиций (`items-list.tsx`)**: `sortable-list`; строка: название (+ серый `description`), сводка цены:
- один вариант: поле быстрого редактирования цены — `Input type="number"` `w-24` с суффиксом «₽»; сохранение по Enter или blur (если значение изменилось) через `quickSetPrice({ variantId, price })`; рядом `Loader2` во время сохранения и `Check` на 1.5 секунды;
- несколько вариантов: текст «от 120 ₽ · 3 варианта» (read-only, кнопка «Изменить»);
- общая сетка: бейдж «Сетка: Teatone»;
Далее: Switch `isActive` (`toggleMenuItem`, оптимистично), «Изменить» (→ `/admin/menu/items/[id]`), «Удалить». Кнопка «Добавить позицию» → `/admin/menu/items/new?cat=<id>`. Поиск по названию в категории (клиентский фильтр, DnD при активном фильтре отключается). Action `reorderMenuItems({ categoryId, ids })`.

### 2. Форма позиции (`item-form.tsx`)

Поля: `categoryId` (Select с отступом подкатегорий), `name` (1–160), `description` (состав, Textarea ≤ 400), `choiceNote` («выбор подачи», Input ≤ 120, например «кляр / чесночный соус»), `originCountry` (Input ≤ 60), `isTakeawayDiscount` (Switch «Скидка 10% на вынос», по умолчанию вкл), `imageMediaId` (`image-upload-field`, `folder="menu"`, необязательно), `isActive`, `code` (read-only).

**Блок «Цены» — взаимоисключающий.** `RadioGroup` «Как задаются цены»: «Свои варианты» | «Общая сетка цен». Модель формы:

```ts
pricingMode: 'variants' | 'group'
priceGroupId: string | null          // только при 'group'
variants: { id?: string; code?: string; label: string|null; amount: number|null; unit: 'g'|'ml'|'l'|'pcs'|null; price: number }[]
```
- В режиме `variants` блок «Общая сетка» скрыт, `priceGroupId = null`, требуется минимум 1 вариант (по умолчанию форма новой позиции содержит одну пустую строку).
- В режиме `group` таблица вариантов скрыта и очищается; Select сетки содержит пункт «Как у категории: {название}» (`priceGroupId = null`, доступен, только если у категории задана сетка) и список сеток (своя сетка позиции). Если у категории сетки нет — своя сетка обязательна. Под Select показывается предпросмотр уровней действующей сетки (label — price — код уровня серым). При создании позиции в категории, у которой задан `priceGroupId`, режим по умолчанию — `group` с пунктом «Как у категории».
- Переключение режима с `variants` на `group` при уже введённых вариантах — через `ConfirmDialog` («Варианты позиции будут удалены при сохранении»).

zod (в `_schema.ts`):
```ts
export const itemSchema = z.object({ …базовые поля…, pricingMode: z.enum(['variants','group']), priceGroupId: z.string().uuid().nullable(), variants: z.array(variantSchema) })
  .superRefine((v, ctx) => {
    if (v.pricingMode === 'group') {
      // priceGroupId = null допустим (наследуется сетка категории); наличие сетки у категории проверяет action по БД
      // → иначе throw new ActionError('Выберите сетку цен', { priceGroupId: ['Выберите сетку цен'] })
      if (v.variants.length) ctx.addIssue({ code: 'custom', path: ['variants'], message: 'У позиции с общей сеткой не бывает своих вариантов' });
    } else {
      if (v.priceGroupId) ctx.addIssue({ code: 'custom', path: ['priceGroupId'], message: 'Нельзя одновременно сетку и варианты' });
      if (v.variants.length < 1) ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Добавьте хотя бы один вариант цены' });
    }
  });
const variantSchema = z.object({
  id: z.string().uuid().optional(), code: z.string().optional(),
  label: z.string().trim().max(60).nullable(),            // «0,3 л», «Малая», или null для единственного
  amount: z.number().positive().max(100000).nullable(),   // numeric в БД: передавайте строкой `String(amount)` в insert
  unit: z.enum(['g','ml','l','pcs']).nullable(),
  price: z.number().int().min(0).max(1_000_000),
}).refine(v => (v.amount == null) === (v.unit == null), { message: 'Укажите и количество, и единицу' });
```
Тот же `itemSchema` повторно валидируется в action; дополнительно в action проверяется взаимоисключение по фактическим данным БД.

**Таблица вариантов (`variants-table.tsx`)**: колонки «Подпись», «Кол-во», «Ед.», «Цена, ₽», перетаскивание (через `sortable-list` или кнопки ↑/↓ + `useFieldArray.move`), удаление строки. Кнопка «+ Вариант». Колонка «Код» — серым read-only для сохранённых вариантов.

**Action `saveMenuItem`** (`tags: [TAGS.menu, TAGS.sets]`), в транзакции:
1. upsert `menuItems` (новый → `code = await newCode(...)`);
2. режим `group`: удалить все варианты позиции, предварительно проверив, что ни один не используется в `banquetSetItems.menuItemVariantId` (иначе ошибка «Вариант «…» используется в сете «…». Уберите его из сета»);
3. режим `variants`: сравнить с текущими вариантами по `id`: существующие обновить (код не трогать), новые вставить с новым `code`, отсутствующие в форме — удалить (с той же проверкой использования в сетах), `sortOrder = index`;
4. `priceGroupId` проставить/обнулить; в режиме `group` с `priceGroupId = null` проверить, что у категории (`menuCategories.priceGroupId`) сетка есть, иначе `ActionError`;
5. `await audit(ctx.userId, input.id ? 'menu_item.update' : 'menu_item.create', 'menu_item', id, { after: input }, ctx.tx)`.
Дополнительные actions: `deleteMenuItem` (проверка использования вариантов в сетах как выше), `toggleMenuItem`, `quickSetPrice`, `reorderMenuItems`.

### 3. Сетки цен (`/admin/menu/price-groups`)

Список сеток (`PriceGroupsManager`): карточка на сетку — название, таблица уровней (с кодом), «Используют: N категорий, M позиций». Диалог создания/редактирования: `name`, `description?` и inline-таблица уровней: `label` («0,3 л»), `amount`, `unit`, `price`, сортировка, удаление строки, колонка «Код» — read-only (`font-mono text-xs`, у новых строк «будет создан»); минимум 1 уровень. zod уровня: `{ id?: uuid; code?: string; label: string 1–60; amount: number|null; unit: enum|null; price: int ≥ 0 }` (`code` с клиента игнорируется). Actions: `savePriceGroup` (в транзакции синхронизирует уровни по `id`: существующие обновляются **без изменения `code`**, новые вставляются с `code = await newCode(ctx.tx, priceGroupTiers)`, отсутствующие удаляются, `sortOrder = index`; аудит `price_group.create|update`), `deletePriceGroup` — запрещено, пока на сетку ссылаются категории или позиции (сообщение со счётчиками). Теги `[TAGS.menu]` (сбрасывают и `/menu`, и каталог калькулятора, где уровни — это позиции `${item.code}-${tier.code}`). Подсказка в диалоге: «Удалённый уровень пропадёт из калькулятора; старые ссылки на расчёт с ним перестанут его учитывать».

### 4. Добавки (`/admin/menu/modifiers`)

Таблица + Dialog: `name` (до 120), `price` (целое ≥ 0), `categoryId` (Select «Для всех» / категория), `isActive`; сортировка. Actions: `saveModifier`, `deleteModifier`, `toggleModifier`, `reorderModifiers`. В калькулятор добавки не входят (показываются текстом).

### 5. Массовое изменение цен (`/admin/menu/bulk-price`)

Форма (`bulk-price-form.tsx`):
- «Область»: Select категории (пункт «Всё меню»; при выборе категории с подкатегориями — Checkbox «Включая подкатегории», по умолчанию вкл);
- «Как менять»: RadioGroup — «Процент» (Input −90…+300, шаг 0.5, например 5 или −10) | «Фиксированная сумма» (Input целое, −10000…+10000 ₽);
- Checkbox «Округлять до 10 ₽» (по умолчанию вкл, **округление до ближайших 10**);
- Checkbox «Также менять общие сетки цен (price groups) в области» (по умолчанию вкл) — при включении показывается предупреждение, если сетка используется в категориях вне выбранной области.
- Кнопка «Показать изменения» → таблица предпросмотра (позиция/вариант или «Сетка: … — тариф», старая цена → новая цена, разница), счётчик «Изменится N цен», подсветка: рост — `text-green-600`, снижение — `text-destructive`. Затем кнопка «Применить» (disabled до предпросмотра, сбрасывается при изменении параметров) → `ConfirmDialog` («Изменить N цен? Действие нельзя отменить автоматически») → apply.

Чистая функция `_lib/bulk-price.ts` (используется и в preview, и в apply):

```ts
export type BulkMode = { kind: 'percent'; value: number } | { kind: 'amount'; value: number };
export const roundTo10 = (n: number) => Math.round(n / 10) * 10;
export function newPrice(old: number, mode: BulkMode, round: boolean): number {
  const raw = mode.kind === 'percent' ? old * (1 + mode.value / 100) : old + mode.value;
  const v = round ? roundTo10(raw) : Math.round(raw);
  return Math.max(v, round ? 10 : 1);       // цена не опускается ниже 10 ₽ (1 ₽ без округления)
}
```
Actions: `previewBulkPrice(input)` — **не мутация**: `try { await requireAdminAction() } catch { return { ok: false, error: 'Нет доступа' } }`, затем zod-валидация (без `adminAction`, без audit и тегов), возвращает массив `{ kind: 'variant'|'tier', id, itemName, label, oldPrice, newPrice }`. `applyBulkPrice(input)` — через `adminAction(schema, …, { tags: [TAGS.menu, TAGS.sets] })`: **пересчитывает всё заново на сервере** (не доверяет предпросмотру клиента), в **одной транзакции** обновляет `menuItemVariants.price` и (если включено) `priceGroupTiers.price`; позиции с `isActive = false` тоже меняются; пропускает строки, у которых цена не изменилась; пишет аудит внутри handler: `await audit(ctx.userId, 'menu_bulk_price.apply', 'menu_bulk_price', '*', { scope, mode, round, count, sample: первые 20 строк }, ctx.tx)`. Максимум за раз — 2000 строк (защита).

### 6. Банкетные сеты (`/admin/banquet-sets`)

**Список (`sets-list.tsx`)**: `sortable-list`; строка: миниатюра обложки, название, «{цена} ₽ / человека» или «{цена} ₽ фиксированно», «от N до M гостей», число позиций состава, Switch `isActive`, «Изменить», «Удалить». Action `reorderSets`.

**Форма сета (`set-form.tsx`)**: `title` (1–120), `description` (Textarea ≤ 1000, markdown допускается), `coverMediaId` (`image-upload-field`, `folder="sets"`, подсказка 4:3), `pricingMode` (RadioGroup «За человека» / «Фиксированная цена за сет»), `price` (целое ≥ 0), `minGuests`/`maxGuests` (необязательные, `max ≥ min`), `isActive`, `code` (read-only).

**Состав (`composition-editor.tsx`)**: `useFieldArray` строк состава, сортировка. Строка — один из двух типов (переключатель «Из меню» / «Свой текст»):
- «Из меню»: `VariantPicker` — Popover с Input поиска и прокручиваемым списком `«{itemName} — {label} · {price} ₽»` (данные `listVariantOptions()` загружаются на сервере и передаются пропсом; фильтр на клиенте по подстроке без учёта регистра, показывать первые 50 совпадений);
- «Свой текст»: Input `customLabel` (до 160), например «Соус на выбор»;
- общее поле `qty` (целое 1–99).
Под редактором — информативная сумма «Стоимость состава по меню: N ₽» (сумма `price × qty` по позициям из меню; для сравнения с ценой сета, **только подсказка**).

zod: строка состава — `z.union` из `{ menuItemVariantId: uuid, customLabel: null, qty }` и `{ menuItemVariantId: null, customLabel: nonempty, qty }`.

Actions (`tags: [TAGS.sets]`): `saveSet` (upsert сета, новый → `code = newCode`; состав синхронизируется заменой: удалить старые `banquetSetItems` сета и вставить новые с `sortOrder = index`, в одной транзакции), `deleteSet`, `toggleSet`, `reorderSets`.

### Запросы (`_queries.ts`)

Обычные `db.select()`; не использовать `'use cache'` (админка всегда должна видеть актуальные данные). Для дерева: все категории одним запросом + `count(menuItems)` группировкой, собираемые в дерево в JS.

## Acceptance Criteria

- [ ] `/admin/menu` показывает дерево категорий (2 уровня) с drag-and-drop внутри родителя и кнопками ↑/↓; категорию можно создать, переименовать, перенести в другого родителя, задать `funFact*` и `priceGroupId`, скрыть и удалить (удаление непустой категории отклоняется с сообщением).
- [ ] Список позиций категории: сортировка, переключатель активности, быстрое редактирование цены у позиций с одним вариантом (сохранение по Enter/blur, видна индикация), поиск.
- [ ] Форма позиции: режимы «Свои варианты» / «Общая сетка цен» взаимоисключающи на клиенте и в Server Action (сервер отклоняет `priceGroupId` + варианты одновременно и позицию без цен); inline-таблица вариантов (подпись, количество, единица, цена, порядок); коды позиций и вариантов генерируются `nanoCode()` один раз и не меняются.
- [ ] Удаление варианта/позиции, используемых в банкетном сете, блокируется сообщением с названием сета.
- [ ] Сетки цен: CRUD с уровнями; у нового уровня `code` генерируется `nanoCode()`, при редактировании сохраняется, в форме показан read-only; удаление используемой сетки отклоняется.
- [ ] Позиции с сеткой (своей или унаследованной от категории) появляются в каталоге калькулятора как `${item.code}-${tier.code}` сразу после сохранения (тег `menu`).
- [ ] Добавки: CRUD, сортировка.
- [ ] Массовое изменение цен: предпросмотр до применения, +/−N% и +/−N ₽, округление до 10 ₽, область «категория (с подкатегориями) / всё меню», опционально сетки цен; применение пересчитывается на сервере и выполняется в одной транзакции; в `audit_log` пишется запись с количеством изменённых цен.
- [ ] `/admin/banquet-sets`: CRUD сетов, сортировка, режимы цены `per_person`/`fixed`, min/max гостей, состав из вариантов меню (с поиском) и произвольных строк с количеством, сумма состава показывается как подсказка.
- [ ] Каждая страница вызывает `await requireAdmin()`; все мутации идут через `adminAction` (кроме `previewBulkPrice`, использующего `requireAdminAction` в try/catch) с тегами `menu`/`sets` и пишут `await audit(ctx.userId, …, ctx.tx)` внутри handler; после сохранения изменения сразу видны на `/menu` и в калькуляторе.
- [ ] Интерфейс на русском, по `DESIGN.md`, пригоден на 375px; новых npm-пакетов нет; файлы вне списка не изменены.
- [ ] `pnpm lint` и `pnpm typecheck` проходят без ошибок.

## Notes

- Если `category.priceGroupId` задана, то она задаёт **заголовок сетки на `/menu`**, предзаполняет режим цены у новых позиций и действует для всех позиций категории без своих вариантов и без своего `priceGroupId` (`item.priceGroupId ?? category.priceGroupId`). Смена сетки у категории меняет цены таких позиций и их коды в калькуляторе (`${item.code}-${tier.code}`) — показывайте об этом подсказку в форме категории. Не переписывайте `priceGroupId` позиций автоматически.
- `amount` в БД — `numeric` (Drizzle возвращает строку): в формах приводите к `number`, в insert передавайте строку.
- Позиции каталога около 260; не делайте N+1 запросов — грузите варианты одним запросом `inArray(itemId, ids)`.
