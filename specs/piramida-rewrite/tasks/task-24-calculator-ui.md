# Task 24: UI калькулятора стоимости

## Status

complete

## Wave

5

## Description

Страница `/calculator` — интерактивный калькулятор стоимости визита: аренда столов (общий зал или VIP-комната), позиции меню, банкетные сеты и доп. услуги на N гостей. Расчёт выполняется на клиенте чистой функцией `calculateQuote` из задачи 05, всё состояние живёт в URL (`nuqs`), поэтому ссылкой можно поделиться, и она воспроизводит расчёт. Кнопка «Отправить расчёт в клуб» открывает форму заявки (`LeadForm` из задачи 11) с типом `calculator`; сервер пересчитывает сумму сам. Дополнительно создаётся мини-блок для главной (`HomeCalculatorTeaser`), который ведёт на `/calculator` с предзаполненными параметрами.

## Dependencies

**Depends on:** task-05-calculator-core.md, task-11-lead-capture.md, task-12-public-queries.md, task-13-site-layout.md
**Blocks:** task-27-home-assembly.md, task-28-qa-verification.md

**Context from dependencies:**
- task-05 создала `src/lib/calculator/` (чистые функции, без React):
  - `types.ts`: `CalcHall { id; slug; name; kind; tablesCount; seatsPerTable }`, `CalcMenuVariant { code: string; itemName: string; label: string; price: number; categorySlug: string; categoryName: string }`, `CalculatorCatalog { halls: CalcHall[]; tariffs; extraServices; menuVariants: CalcMenuVariant[]; sets: { code; title; pricingMode; price; minGuests?; maxGuests? }[]; promotions }`, `QuoteInput { opDate; startMin; durationMin; guests; hallId; tables; pensioner; extras: {id; qty}[]; sets: {code; qty}[]; items: {code; qty}[] }`, `Quote { lines: {kind; label; qty; unitPrice; total}[]; rentalTotal; foodTotal; total; perGuest; warnings: string[]; promoHints: string[] }`;
  - `calculate.ts`: `calculateQuote(input, catalog): Quote`;
  - `menuVariants` строит `buildMenuVariants` (`catalog-mapper.ts`): у позиции с собственными вариантами — запись на вариант (`code = variant.code`, `label = variant.label ?? ''`); у позиции без вариантов с сеткой цен (`item.priceGroupId ?? category.priceGroupId`) — запись на каждый уровень сетки: ``code = `${item.code}-${tier.code}` `` (например `abc123-x9y8z7`), `label = tier.label` («Чайник 600 мл»), `price = tier.price`. Порядок — категория, позиция, вариант/уровень по `sortOrder`. Коды в `i=` могут содержать `-`.
  - `url-state.ts` (импорт только из `nuqs/server`), параметры `?d=&t=&h=&g=&hall=&tables=&p=&x=&s=&i=` (`d` дата визита `YYYY-MM-DD`, `t` время начала `HH:MM`, `h` длительность в часах с шагом 0.5, `g` гости, `hall` — **slug зала**, `tables` число столов, `p` пенсионер, `x` доп. услуги, `s` сеты `code:qty,…`, `i` позиции меню `code:qty,…`). Экспорты:
    - `calculatorParsers` — объект парсеров для `useQueryStates` / `createSerializer`;
    - `CalculatorUrlState` — тип состояния URL;
    - `toQuoteInput(state: CalculatorUrlState, catalog: CalculatorCatalog, todayOpDate: string): QuoteInput` — перевод состояния URL в `QuoteInput`;
    - `parseKeyQtyList`, `serializeKeyQtyList`;
    - `serializeCalculator(input: Partial<QuoteInput>, catalog?: Pick<CalculatorCatalog, 'halls'>): string` — строка запроса (`?…` или `''`) для ссылки на `/calculator`; `hallId` переводится в slug по `catalog`, без `catalog` параметр `hall` не пишется;
    - `parseCalculatorSearchParams(sp, catalog?): Partial<QuoteInput>` — разбор параметров URL (невалидные отбрасываются).
    Файлы задачи 05 не менять.
- task-11 создала `src/components/leads/lead-form.tsx`: `LeadFormProps = { type: LeadType; block: string; formTitle: string; promotionId?: string; tournamentId?: string; hidden?: Record<string, string>; submitLabel?: string; onSuccess?: (number: number) => void; className?: string }` (пропсов `fields`/`extra` нет; для `type="calculator"` видимые поля — имя + телефон). Server Action `submitLead` (`src/lib/actions/leads.ts`) для `type === 'calculator'` читает скрытое поле `quote` (JSON-строка `QuoteInput`), валидирует zod-схемой, пересчитывает расчёт по актуальному каталогу и пишет `quoteSnapshot`/`quoteTotal`. Метрика: `window.ym?.(ID, 'reachGoal', 'lead_submit')` (калькулятор — `calculator_submit`).
- task-12 дала `getCalculatorCatalog(): Promise<CalculatorCatalog>` (`'use cache'`, теги `TAGS.pricing/menu/sets/promotions`; `menuVariants` через `buildMenuVariants`). Вызывать после `await connection()` внутри `<Suspense>`. `getMenuTree()` калькулятору не нужен.
- task-13 дала `Container`, `SectionTitle`, `PrimaryButton` (`src/components/site/*`) и layout сайта.
- task-06: `src/lib/dates.ts` — `getOpDate()`, `minToClock(min)`, `clockToMin(hhmm)` (минуты от 09:00 операционных суток), `TZ`.

## Files to Create

- `src/app/(site)/calculator/layout.tsx` — оборачивает поддерево в `NuqsAdapter`.
- `src/app/(site)/calculator/page.tsx` — серверная страница: каталог в `<Suspense>` → `<CalculatorClient>`.
- `src/components/calculator/calculator-client.tsx` — клиентский корень (состояние URL, расчёт, раскладка).
- `src/components/calculator/date-time-step.tsx` — дата, время начала, длительность, гости.
- `src/components/calculator/hall-step.tsx` — зал, столы, пенсионер, доп. услуги.
- `src/components/calculator/menu-picker.tsx` — выбор позиций меню.
- `src/components/calculator/sets-picker.tsx` — банкетные сеты.
- `src/components/calculator/extras-picker.tsx` — доп. услуги.
- `src/components/calculator/quote-summary.tsx` — итоговая смета (sticky).
- `src/components/calculator/send-quote-dialog.tsx` — диалог с `LeadForm`.
- `src/components/calculator/calculator-helpers.ts` (+ `calculator-helpers.test.ts`) — `groupMenuVariants` и прочие чистые хелперы UI.
- `src/components/calculator/time-slots.ts` — слоты времени (см. Code Snippets).
- `src/components/calculator/stepper.tsx` — общий `Stepper` (−/значение/+) для гостей, столов, длительности, количеств.
- `src/components/calculator/home-calculator-teaser.tsx` — мини-форма для главной (использует задача 27).
- `src/components/calculator/calculator-skeleton.tsx` — скелетон страницы для `<Suspense fallback>`.

## Files to Modify

Нет. Файлы задачи 05 (`src/lib/calculator/**`), задачи 11 и 12 не менять. Если чего-то не хватает в их API — описать в отчёте.

## Technical Details

### Implementation Steps

1. **Прочитать** `src/lib/calculator/{types,calculate,url-state}.ts`, `src/components/leads/lead-form.tsx`, `DESIGN.md` (токены клуба). Список shadcn-компонентов, которые должны быть установлены задачей 01 (если какого-то нет — не ставить, сообщить): `button`, `calendar`, `popover`, `select`, `input`, `checkbox`, `label`, `badge`, `dialog`, `sheet`, `separator`, `scroll-area`, `skeleton`, `toggle-group` (необязательно), `sonner`.

2. **Серверная страница `page.tsx`.** Каталог читается из БД (только `getCalculatorCatalog()`), поэтому всё внутри `<Suspense>` после `connection()`. `opDate` вычисляется после `connection()` и передаётся пропсом (дефолт даты в калькуляторе = операционная дата, до 09:00 это «вчера»).

```tsx
import { Suspense } from 'react'
import { connection } from 'next/server'
import { Container } from '@/components/site/container'
import { SectionTitle } from '@/components/site/section-title'
import { getCalculatorCatalog } from '@/lib/queries/calculator'
import { getOpDate } from '@/lib/dates'
import { CalculatorClient } from '@/components/calculator/calculator-client'
import { CalculatorSkeleton } from '@/components/calculator/calculator-skeleton'

export const metadata = {
  title: 'Калькулятор стоимости',
  description: 'Рассчитайте стоимость аренды бильярдного стола, VIP-комнаты, меню и банкетных сетов на любое число гостей.',
  alternates: { canonical: '/calculator' }, // metadataBase задаёт root layout (task 02)
}

export default function CalculatorPage() {
  return (
    <Container className="py-8">
      <SectionTitle>Калькулятор</SectionTitle>
      <Suspense fallback={<CalculatorSkeleton />}>
        <CalculatorContent />
      </Suspense>
    </Container>
  )
}

async function CalculatorContent() {
  await connection()
  const opDate = getOpDate()
  const catalog = await getCalculatorCatalog()
  return <CalculatorClient catalog={catalog} defaultDate={opDate} />
}
```

   (`SectionTitle`/`Container` — подогнать под их реальные пропсы из задачи 13; если `Container` уже даёт вертикальные отступы, `py-8` убрать.) Данные передаются клиенту только как простые JSON-значения (без функций и классов).

3. **`layout.tsx`** — NuqsAdapter только вокруг калькулятора (остальной сайт не оборачивается):

```tsx
import { NuqsAdapter } from 'nuqs/adapters/next/app'

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return <NuqsAdapter>{children}</NuqsAdapter>
}
```

   Клиентское чтение query-параметров (`useQueryStates` использует `useSearchParams`) обязано находиться под `<Suspense>`: он уже есть в `page.tsx`.

4. **Группы меню для пикера.** `menu-picker.tsx` строит группы прямо из `catalog.menuVariants` (через `useMemo`): группировка по `categorySlug`/`categoryName`, внутри — по `itemName`; порядок категорий, позиций и вариантов сохраняется таким, как пришёл в `menuVariants` (уже отсортировано `buildMenuVariants`). Уровни сеток цен приходят как обычные варианты (код вида `abc123-x9y8z7`, `label` = подпись уровня) — отдельной обработки не требуют. Пустой `label` (единственный вариант без подписи) показывать как просто цену.

```ts
interface MenuPickerGroup {
  categorySlug: string
  categoryName: string
  items: { name: string; variants: { code: string; label: string; price: number }[] }[]
}
function groupMenuVariants(variants: CalcMenuVariant[]): MenuPickerGroup[] { /* ... */ }
```

   `groupMenuVariants` лежит в `src/components/calculator/calculator-helpers.ts` (чистая функция, покрывается тестом).

5. **`calculator-client.tsx`** (`'use client'`). Состояние — `useQueryStates(calculatorParsers, { history: 'replace', shallow: true })` (shallow: обновление URL без запросов на сервер; `replace`, чтобы не засорять историю). Значения по умолчанию в URL **не записываются** (`withDefault` + `clearOnDefault` по умолчанию в nuqs 2): дата по умолчанию = `defaultDate` (пропс), время `19:00`, длительность 2, гости 4, зал — первый общий зал, столы — авто.

   Алгоритм:

```tsx
'use client'
const [state, setState] = useQueryStates(calculatorParsers, { history: 'replace' })
const input = useMemo(() => toQuoteInput(state, catalog, defaultDate), [state, catalog, defaultDate])
const quote = useMemo(() => calculateQuote(input, catalog), [input, catalog])
```

   `calculatorParsers`, `CalculatorUrlState`, `toQuoteInput` импортируются из `@/lib/calculator/url-state`. `toQuoteInput` (задача 05) сам переводит `state.hall` (slug) в `hallId`, считает `startMin`/`durationMin`, `tables` по умолчанию, клампит значения и отбрасывает неизвестные коды — локальную копию этой логики не писать. Изменения записываются через `setState` в ключи `calculatorParsers` (`hall` — slug зала: `setState({ hall: hall.slug })`).

   Раскладка: контейнер `grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]`; слева шаги (карточки `Card`, `space-y-6`), справа `QuoteSummary` в `lg:sticky lg:top-24 self-start`. На мобильном смета выводится после шагов (`id="quote-summary"`), а снизу `fixed inset-x-0 bottom-0` панель с итогом и кнопкой, при нажатии прокручивает к `#quote-summary` (панель скрыть на `lg:`). Добавить `pb-24 lg:pb-0` контейнеру.

6. **`date-time-step.tsx`** (props: `state`, `onChange`, `defaultDate`):
   - **Дата визита** — shadcn `Popover` + `Calendar` (локаль `ru` из `date-fns/locale`, `weekStartsOn={1}`), кнопка с датой «5 декабря 2026, сб». Хранится как `YYYY-MM-DD` (строка; не `Date`, чтобы не ловить сдвиг часового пояса). Прошедшие даты раньше `defaultDate` недоступны.
   - **Время начала** — shadcn `Select` с шагом 30 минут в порядке **операционных суток**: 09:00 … 23:30, затем 00:00 … 08:30. Для времён 00:00–08:30 подпись: `«00:30 — ночь на {D+1}»`, где `D+1` — день после выбранной даты визита («ночь на 6 дек»). Значение в URL — `HH:MM`. Если выбрано ночное время, показывать под селектом подсказку «Это ночь после выбранной даты».
   - **Длительность** — `Stepper` ±0.5 ч, диапазон 0.5–12, показ «2 ч», «2,5 ч» (десятичная запятая).
   - **Гости** — `Stepper` 1–100.
   - Вывод «Окончание: {HH:MM}» (рассчитать из `startMin + durationMin` через `minToClock`, с пометкой «на следующий день», если конец после 00:00).

7. **`hall-step.tsx`**:
   - **Зал**: `Select` из `catalog.halls` (только активные; подпись «Общий зал» / «VIP 1» и т. д.).
   - Общий зал (`kind === 'common'`): `Stepper` «Столов» — по умолчанию `min(tablesCount, ceil(guests / seatsPerTable))`; пока пользователь не менял, в URL параметр `tables` отсутствует (режим «авто»), после ручного изменения — записывается; кнопка-ссылка «Сбросить на авто». Максимум — `hall.tablesCount`; при превышении — `Stepper` упирается в максимум и показывает «Максимум столов в зале: N».
   - VIP-комната (`kind === 'vip'`): число столов не показывать, всегда 1; пояснение «Цена за комнату».
   - **Чекбокс «Пенсионер»** (`p`): показывать, если для выбранного зала есть хотя бы один тариф с `audience === 'pensioner'`; с подсказкой «Пенсионный тариф действует только в указанные часы».
   - Доп. услуги выносятся в `extras-picker.tsx`, он вставляется в этот же шаг.

8. **`extras-picker.tsx`** — список `catalog.extraServices` (название, цена, единица `per_hour`/`fixed`/`per_session`: подписи «₽/час», «₽», «₽/сеанс»). Чекбокс-строка с `Stepper` количества (0 = не выбрано). Значение в URL — `x=<id>:<qty>,…` (как определено в `url-state.ts`).

9. **`sets-picker.tsx`** — карточки сетов `catalog.sets` (название, цена, подпись «за человека» для `per_person` / «за сет» для `fixed`, ограничения гостей «от X до Y гостей» при наличии). Кнопка «Добавить»: для `per_person` начальное количество = текущее число гостей, для `fixed` = 1; дальше — `Stepper`. Количество сетов пишется явно в `s`; при смене числа гостей уже добавленные количества **не пересчитываются автоматически** (пользователь мог их менять). Предупреждения про `minGuests/maxGuests` приходят из `calculateQuote` (`quote.warnings`) — UI их только показывает. Семантику количества (порции) определяет `calculateQuote`, UI лишь пишет `qty`.

10. **`menu-picker.tsx`** (props `menuVariants: CalcMenuVariant[]` из `catalog`, `items: Record<code, qty>`, `onChange`; группы — `groupMenuVariants(menuVariants)` из шага 4): поле поиска (клиентский фильтр по названию, регистронезависимо, `normalize('NFKD')` не нужен), горизонтальные чипы категорий (прокручиваемая строка, `aria-pressed`, «Все»), список позиций: название, под ним варианты в виде кнопок `variant="outline"` («0,5 л — 250 ₽»); нажатие на вариант добавляет 1 шт, у выбранных вариантов показывается `Stepper` (− 1 +, при 0 вариант удаляется). Позиции без вариантов не показывать. Для 250+ позиций список разбивать на категории с `details/summary` (свёрнуты по умолчанию, кроме отфильтрованных поиском) либо рендерить первые 30 позиций категории с кнопкой «Показать ещё»; требование — не рендерить сразу 250 карточек с интерактивными кнопками. Ссылка «Всё меню» на `/menu`.

11. **`quote-summary.tsx`** (props `quote`, `input`, `catalog`, `onSend`, `onCopyLink`):
   - Заголовок «Ваш расчёт»; таблица строк `quote.lines` (название, количество × цена, сумма) сгруппирована по `kind` (аренда / доп. услуги / сеты / меню — порядок и значения `kind` см. `types.ts`); отдельно «Аренда» (`rentalTotal`), «Еда и услуги» (`foodTotal`), крупно «Итого» (`total`, формат `Intl.NumberFormat('ru-RU')` + « ₽», `font-bold`, цвет `text-primary`), «≈ N ₽ на гостя» (`perGuest`).
   - `quote.warnings` — блок с иконкой `AlertCircle`, цвет `text-destructive`/`bg-destructive/10`.
   - `quote.promoHints` — блок-подсказка «В этот день действует акция: …» (нейтральный фон `bg-accent`, иконка `Tag`/`Sparkles`), с пометкой «Скидка не входит в расчёт».
   - Пустая смета (`lines.length === 0`) — текст «Выберите зал, время и позиции — мы посчитаем».
   - Платные добавки к блюдам (modifiers) в калькулятор не входят; в подписи указать «Платные добавки в расчёт не включены».
   - Дисклеймер внизу мелким `text-xs text-muted-foreground`: **«Расчёт предварительный, итог подтверждает администратор»**.
   - Кнопки: **«Отправить расчёт в клуб»** (`PrimaryButton`/`Button` размером lg; блокируется, если `total === 0`) и **«Скопировать ссылку»** (`variant="outline"`, иконка `Link2`): `navigator.clipboard.writeText(window.location.href)` → `toast.success('Ссылка скопирована')` (sonner); при ошибке clipboard — `toast.error` и выделение URL в поле.

12. **`send-quote-dialog.tsx`** — shadcn `Dialog`; внутри `LeadForm`:

```tsx
<LeadForm
  type="calculator"
  block="Калькулятор"
  formTitle="Расчёт из калькулятора"
  submitLabel="Отправить расчёт в клуб"
  hidden={{ quote: JSON.stringify(input) }}
  onSuccess={() => {
    window.ym?.(Number(process.env.NEXT_PUBLIC_YM_ID), 'reachGoal', 'calculator_submit')
    setOpen(false)
  }}
/>
```

   - `input` — это именно `QuoteInput` (не `Quote`): сервер сам пересчитает сумму по актуальному каталогу и сохранит `quoteSnapshot`. Скрытое поле — ровно `quote` (JSON-строка `QuoteInput`), передаётся через `hidden`.
   - Под заголовком диалога показать краткую сводку: «{N} гостей, {дата}, {время}, итого ≈ {total} ₽». Дата/время/гости уже есть в `quote`, отдельных полей в форме нет (видимые поля — имя + телефон).
   - `window.ym` — объявлен глобально задачей 13 (`Metrika`); если типа нет, добавить локальное объявление `declare global`. Метрика сработает, только если пользователь дал согласие на cookie (это решает компонент Metrika, здесь ничего не проверять).
   - Успех: если LeadForm сам делает переход на `/spasibo`, цель Метрики должна быть отправлена **до** навигации (в `onSuccess`); не терять `quote` при ошибке (диалог остаётся открытым, значения формы сохраняются).

13. **`home-calculator-teaser.tsx`** (`'use client'`, props `{ opDate: string }`; вне `NuqsAdapter`!): карточка «Рассчитайте стоимость вечера» с тремя полями: гости (`Stepper` 1–100, по умолчанию 8), дата (`<input type="date" min={opDate}>` со стилем `Input`, по умолчанию `opDate`), часы (`Select`: 1, 1.5, 2, 2.5, 3, 4, 5, 6; по умолчанию 3), кнопка «Рассчитать» → `router.push` на `/calculator?g=8&d=2026-12-05&h=3`. Строить query через `serializeCalculator` (задача 05), чтобы формат точно совпал с парсерами калькулятора:

```ts
import { serializeCalculator } from '@/lib/calculator/url-state'
router.push(`/calculator${serializeCalculator({ guests, opDate: date, durationMin: Math.round(hours * 60) })}`)
```

   (`serializeCalculator` возвращает `?…` или `''`; зал не передаётся, поэтому `catalog` не нужен.) Запросов к БД не делает (`opDate` приходит из главной), поэтому не требует Suspense. Использовать токены (`bg-card`, `rounded-lg`, `shadow-sm`, `PrimaryButton`), `Container`/`SectionTitle` на главной ставит задача 27.

14. **`calculator-skeleton.tsx`** — две колонки из `Skeleton` (лево: 4 карточки, право: смета).

15. **Доступность и UX:** все поля — `Label` + `id`; `Stepper` — кнопки с `aria-label` («Уменьшить»/«Увеличить») и `aria-live="polite"` у значения; ночное время подписано словами; смета с `aria-live="polite"` у итога. Размеры тач-целей ≥ 40px. Только светлая тема, цвета — токены (`DESIGN.md`).

16. **Тесты.** Логика расчёта и парсеры уже покрыты в задаче 05. Здесь добавить Vitest для чистой логики UI (`calculator-helpers.test.ts`): `groupMenuVariants` (группировка по `categorySlug`/`itemName` с сохранением порядка; уровни сетки с кодами `abc123-x9y8z7` попадают в свою позицию), список слотов времени и подписи «ночь на …»: число слотов = 48, первый 09:00, последний 08:30, подпись ночи содержит дату D+1. UI-поток проверит e2e задачи 28.

### Code Snippets

Подписи времени (вынести в `src/components/calculator/time-slots.ts`):

```ts
import { minToClock } from '@/lib/dates'

/** 48 слотов по 30 минут от 09:00 до 08:30 следующих суток (минуты от 09:00: 0..1410). */
export function buildTimeSlots(visitDate: string): { value: string; label: string; night: boolean }[] {
  return Array.from({ length: 48 }, (_, i) => {
    const min = i * 30
    const value = minToClock(min) // «09:00» … «08:30»
    const night = min >= 15 * 60 // с 00:00 (15 часов после 09:00) и далее
    return { value, night, label: night ? `${value} — ночь на ${formatShortDate(addDays(visitDate, 1))}` : value }
  })
}
```

`formatShortDate` («6 дек») и `addDays` (строки `YYYY-MM-DD`, без `Date` в локальном поясе браузера: считать в UTC) — маленькие локальные функции с тестом.

### Environment Variables

- `NEXT_PUBLIC_YM_ID` — ID Метрики для цели `calculator_submit` (задан build-arg).

### API Endpoints

Нет собственных. Отправка — Server Action `submitLead` (задача 11).

## Acceptance Criteria

- [ ] `/calculator` открывается без БД при `pnpm build:ci` (чтение каталога `getCalculatorCatalog()` — после `connection()` в `<Suspense>`), на сервере в HTML есть скелетон/оболочка.
- [ ] `NuqsAdapter` подключён только в `src/app/(site)/calculator/layout.tsx`; остальной сайт не обёрнут.
- [ ] Состояние калькулятора целиком хранится в URL; открытие ссылки вида `/calculator?d=...&t=...&h=...&g=...` воспроизводит ту же смету; значения по умолчанию в URL не пишутся; мусорные параметры не ломают страницу.
- [ ] Время начала выбирается с шагом 30 минут, ночные слоты подписаны «ночь на <D+1>»; длительность 0.5–12 ч с шагом 0.5; гости 1–100.
- [ ] Общий зал: число столов по умолчанию `ceil(guests / seatsPerTable)` (не больше `tablesCount`), можно изменить вручную, есть «сбросить на авто»; VIP-комната: столы не выбираются, всегда 1.
- [ ] Чекбокс «Пенсионер» показывается только если для зала есть пенсионный тариф и корректно влияет на расчёт.
- [ ] Сеты `per_person` по умолчанию добавляются с количеством = гостям; позиции меню выбираются по категориям (группировка `catalog.menuVariants` по `categorySlug`/`categoryName`) с поиском, вариантами (объёмы и уровни сеток цен, коды вида `abc123-x9y8z7` в `i=`) и количеством; 250 позиций не рендерятся одним куском.
- [ ] Смета показывает строки, итоги аренды/еды, «Итого», «на гостя», предупреждения (`warnings`), подсказки акций (`promoHints`), дисклеймер «Расчёт предварительный, итог подтверждает администратор»; на мобильном есть нижняя панель с итогом.
- [ ] Кнопка «Скопировать ссылку» копирует текущий URL и показывает toast.
- [ ] «Отправить расчёт в клуб» открывает диалог с `LeadForm` (`type="calculator"`), в форму передаётся `hidden={{ quote: JSON.stringify(input) }}` с `QuoteInput` (не готовая сумма), по успеху срабатывает `reachGoal 'calculator_submit'`; сервер сохраняет лид с пересчитанным снимком (проверяется вручную: в админке «Заявки» виден расчёт).
- [ ] `HomeCalculatorTeaser` строит ссылку `/calculator?g=..&d=..&h=..` через `serializeCalculator` и открывает калькулятор с теми же значениями; не требует БД и `NuqsAdapter`.
- [ ] Весь UI на токенах `DESIGN.md`, без хардкод-цветов, без тёмной темы, корректно на 375/768/1440/1920.
- [ ] Vitest для новых чистых модулей проходит; `pnpm lint`, `pnpm typecheck` и `pnpm build:ci` проходят без ошибок.

## Notes

- Платные добавки к блюдам (`menuModifiers`) в калькулятор не входят (PLAN §16.2).
- Акции — только подсказка, в сумму не входят.
- `NEXT_PUBLIC_YM_ID` может быть пустым в dev — `window.ym` тогда отсутствует, вызов безопасен благодаря `?.`.
- Помнить о `Asia/Yekaterinburg`: «сегодня» для клиента — это `defaultDate` с сервера; не вычислять дату в браузере (`new Date()` даст пояс пользователя).
