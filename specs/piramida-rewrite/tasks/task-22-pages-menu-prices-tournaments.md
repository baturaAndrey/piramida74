# Task 22: Страницы сайта — `/menu`, `/prices`, `/tournaments`

## Status

pending

## Wave

5

## Description

Три отдельные публичные страницы клуба «Пирамида»: полное меню бара и кухни (около 260 позиций, варианты объёмов и общие сетки цен), прайс аренды столов с доп. услугами и штрафами, календарь турниров сезона с фильтрами. Данные берутся из БД через готовые кэшируемые запросы; страницы SEO-оптимизированы (`generateMetadata`, JSON-LD, хлебные крошки) и оформлены в стиле главной. Главная страница и админка — в других задачах.

## Dependencies

**Depends on:** task-13-site-layout.md, task-12-public-queries.md, task-11-lead-capture.md, task-09-media-core.md, task-06-shared-utils.md, task-02-design-tokens-layout.md (и транзитивно 03)
**Blocks:** task-28-qa-verification.md

**Context from dependencies:**
- task-02: токены Tailwind v4 (`globals.css`, `DESIGN.md`): основной `#2f6c4a` (hover `#13442e`), текст `#1C1C1C`, фон `#F6F6F6`, приглушённый `#8E8E8E`, красный `#DE2D26`, дата `#D43228`, строки таблиц `#F8FAFB`; шрифт Onest; контейнер сайта — 81vw (86vw на мобильном), максимум 1552px. **Откройте `globals.css` и `DESIGN.md`, используйте реальные имена токенов.**
- task-13: `src/app/(site)/layout.tsx` (шапка закрепляется, футер, cookie-баннер), `src/components/site/{container,section-title,primary-button,reveal}.tsx` (`<Container>`, `<SectionTitle>` H2 60/80 → 20/30, `<PrimaryButton>`, `<Reveal>`). **Откройте файлы и проверьте пропсы**. Высоту закреплённой шапки возьмите из `src/components/site/header.tsx` (ориентир: ~80px) для `sticky top-*` и `scroll-mt-*`.
- task-11: `<LeadDialogTrigger kind block formTitle? promotionId? tournamentId? asChild? className?>{button}</LeadDialogTrigger>` (`src/components/leads/lead-dialog.tsx`), `kind: 'callback' | 'booking' | 'promo' | 'tournament'` — попап формы заявки (`LeadForm` без пропсов `fields`/`extra`; видимые поля задаются типом). `kind="tournament"` — запись на турнир: форма `type="tournament"` (имя + телефон), заголовок по умолчанию «Записаться на турнир», передаёт `tournamentId` в заявку (`leads.tournamentId`).
- task-09: `<Picture asset sizes alt priority className />`, `MediaAsset`, `mediaUrl(asset, w?, fmt?)`.
- task-06: `src/lib/dates.ts` (`getOpDate()`, `getToday()`, `formatEventDate`, `minToClock`, `TZ`), `src/lib/seo/jsonld.ts` (`jsonLdScript(obj)`, `breadcrumbJsonLd(items)`, `sportsEventJsonLd(t)`, `localBusinessJsonLd(settings)`) — **откройте файл и проверьте точные сигнатуры и что возвращает `jsonLdScript`** (строка или `<script>`-пропсы).
- task-12: `src/lib/cache-tags.ts` (`TAGS`), `src/lib/queries/*` — `getMenuTree()` (категории → позиции → варианты/сетки), `getHalls()`, `getTariffs()`, `getExtraServices()`, `getPenalties()`, `getSeasonTournaments(year)`, `getTournamentSeries()`, `getSettings()`. Все `'use cache'` + `cacheLife('max')` + `cacheTag`. **Прочитайте `src/lib/queries/{menu,pricing,tournaments}.ts` и подстройте типы под реальные формы данных.** `src/lib/queries/**` менять нельзя. Ожидаемые формы (предположение):
  - `getMenuTree()` → `MenuTree = { categories: MenuCategoryNode[]; modifiers: { id; name; price; categoryId: string | null }[] }`. Узел категории: `{ id, slug, title, funFactTitle: string | null, funFactText: string | null, priceGroup: { name, tiers: { label, amount, unit, price }[] } | null, items: MenuItemNode[], children: MenuCategoryNode[], modifiers }`; позиция: `{ id, code, name, description, choiceNote, originCountry, isTakeawayDiscount, image: PublicMedia | null, priceGroup: { name, tiers } | null, variants: { code, label: string | null, amount, unit, price }[] }`. У позиции либо свои `variants`, либо сетка: `item.priceGroup` (уже с наследованием сетки категории). Уровни сетки (`tiers`) выводятся как цены позиции («Чайник 600 мл — 450 ₽»). Добавки (`modifiers`) приходят в `getMenuTree()` — отдельный запрос не нужен;
  - `getTariffs()` → `rentalTariffs` (`hallId`, `daysOfWeek`, `startMin`, `endMin`, `price`, `priceUnit`, `audience`, `label`, `validFrom`, `validTo`, `isActive`), минуты — от 09:00 операционных суток (`minToClock(0) = '09:00'`, `minToClock(1440) = '09:00'`);
  - `getPenalties()` → `{ kind: 'dishware'|'property', name, price, priceIsMinimum, sortOrder }[]`;
  - `getSeasonTournaments(year)` → турниры года (опубликованные, по возрастанию `startDate`) с `title`, `slug`, `description`, `startDate`, `endDate`, `discipline`, `level`, `categories`, `entryFee`, `prizeFund`, `registrationOpen`, `stageNumber`, серией (`series.name`) и обложкой (`cover: MediaAsset | null`).
- Данные из seed (task-10): меню из `res/` (19 страниц), тарифы со старого сайта, 30 турниров 2026 года.
- Правила данных: цены — целые рубли; тарифы в «операционных минутах» (день D — с 09:00 до 09:00 следующего дня, ночные часы относятся к предыдущему дню); `daysOfWeek`: `0 = вс … 6 = сб`.

## Files to Create

`/menu`:
- `src/app/(site)/menu/page.tsx`
- `src/app/(site)/menu/_components/menu-catalog.tsx` — клиент: поиск, scroll-spy, разделы
- `src/app/(site)/menu/_components/menu-nav.tsx` — клиент: sticky-навигация по категориям
- `src/app/(site)/menu/_components/menu-item-row.tsx` — строка позиции
- `src/app/(site)/menu/_components/price-group-table.tsx` — шапка общей сетки цен
- `src/app/(site)/menu/_components/fun-fact.tsx` — карточка «Интересный факт»
- `src/app/(site)/menu/_lib/format.ts` — форматирование цены, выхода, единиц
- `src/app/(site)/menu/_lib/menu-jsonld.ts` — JSON-LD `Menu`

`/prices`:
- `src/app/(site)/prices/page.tsx`
- `src/app/(site)/prices/_components/tariff-matrix.tsx` — таблица «дни × интервалы времени»
- `src/app/(site)/prices/_components/extras-table.tsx`
- `src/app/(site)/prices/_components/penalties-list.tsx`
- `src/app/(site)/prices/_lib/matrix.ts` — чистая функция построения матрицы тарифов
- `src/app/(site)/prices/_lib/format.ts`

`/tournaments`:
- `src/app/(site)/tournaments/page.tsx`
- `src/app/(site)/tournaments/_components/tournament-filters.tsx` — фильтры-ссылки (серверные, без JS)
- `src/app/(site)/tournaments/_components/tournament-card.tsx`
- `src/app/(site)/tournaments/_components/past-tournaments.tsx`
- `src/app/(site)/tournaments/_lib/labels.ts` — подписи `discipline`/`level`
- `src/app/(site)/tournaments/_lib/group.ts` — группировка по месяцам, фильтрация

## Files to Modify

Нет. Не менять `src/lib/queries/**`, схему, `globals.css`, `package.json`, `src/components/ui/*`, `src/app/(site)/layout.tsx`, `src/app/(site)/page.tsx`, `sitemap.ts` (им владеет task-23). Если нужного shadcn-компонента (`badge`, `input`, `skeleton`, `table`) нет — сообщите в отчёте.

## Technical Details

### Общие правила для трёх страниц

1. **Кэш и Suspense.** Сборка проходит без БД. Страница строится так:

```tsx
// page.tsx
export const metadata: Metadata = { … };              // статические title/description/canonical/openGraph
export default function Page(props: { searchParams?: Promise<…> }) {
  return (
    <Container className="py-8 …">
      {/* статичная оболочка: хлебные крошки, H1, вступление — пререндерится */}
      <Suspense fallback={<PageSkeleton />}><Content … /></Suspense>
    </Container>
  );
}
async function Content() {
  await connection();                                   // next/server — до обращения к кэшируемым функциям
  const opDate = getOpDate();                           // «сегодня» передаётся аргументом
  const [a, b] = await Promise.all([getX(opDate), getY()]);
  …
}
```
Никаких `try/catch → []` (в кэш запекаются пустые данные), `generateStaticParams` не используется. Для `/tournaments` `searchParams` читаются **только внутри** `Content` (`await props.searchParams`), чтобы оболочка оставалась статичной.
2. **Metadata.** Статический `export const metadata` на каждой странице (динамические `searchParams` в `generateMetadata` не использовать): `title`, `description`, `alternates.canonical` (`/menu`, `/prices`, `/tournaments`), `openGraph` (`type: 'website'`, `locale: 'ru_RU'`, `siteName`), `metadataBase` задан в root layout. Тексты:
   - `/menu` — «Меню бильярдного клуба «Пирамида» в Челябинске — кухня и бар» / «Холодные и горячие закуски, пицца, паста, десерты, чай, кофе, пиво, коктейли и крепкие напитки. Цены и составы блюд».
   - `/prices` — «Цены на бильярд в Челябинске — прайс клуба «Пирамида»» / «Стоимость часа игры в русскую пирамиду и американский пул, VIP-комнаты, пенсионный тариф, прокат и штрафы».
   - `/tournaments` — «Календарь турниров по бильярду в Челябинске — «Пирамида»» / «Расписание соревнований по русскому бильярду: чемпионаты и первенства области, «Марафон-Промнефтегаз», «Сеньоры Челябинска»».
   Фильтры в `searchParams` не индексируются отдельно — canonical указывает на базовый URL.
3. **JSON-LD** через `jsonLdScript(...)` из `src/lib/seo/jsonld.ts` (рендер `<script type="application/ld+json">` — по сигнатуре из файла) + `breadcrumbJsonLd([{ name: 'Главная', url: '/' }, { name: '…', url: '/…' }])`.
4. **Хлебные крошки** над H1: «Главная / Меню» (`text-sm text-muted-foreground`, ссылка на `/`).
5. **Макет**: `<Container>`; `py-8 md:py-12`; H1 `font-bold text-[clamp(26px,3.4vw,55px)] leading-tight`; вводный абзац `text-muted-foreground text-base md:text-lg max-w-3xl`. Секции — белые карточки `rounded-[12px] bg-white`, таблицы с чередованием строк `#F8FAFB`/`#fff`, шапка таблицы `#1C1C1C` белым текстом (стиль прайса главной). Скругление 12px, шрифт Onest, только светлая тема.
6. Все `Skeleton` — `@/components/ui/skeleton`, с высотами, близкими к итоговым.
7. Доступность: таблицы — `<table>` с `<caption className="sr-only">`, `<th scope>`; интерактивные элементы с `focus-visible`; не использовать `user-select:none`/`outline:none`.
8. CTA в конце каждой страницы: «Забронировать стол» — `<LeadDialogTrigger kind="booking" block="…" formTitle="Бронирование стола" asChild><PrimaryButton>Забронировать стол</PrimaryButton></LeadDialogTrigger>` и ссылка на `/calculator` «Рассчитать стоимость вечера»; `block`: `Меню` / `Прайс` / `Календарный план` соответственно.

---

### 1. `/menu`

**Данные.** Только `getMenuTree()` → `{ categories, modifiers }` (добавки уже входят в результат; собственных запросов к БД страница не делает):

```ts
const { categories, modifiers } = await getMenuTree();
```
Скрывать категории без позиций (в т. ч. после фильтрации подкатегорий).

**Структура страницы.**
- Шапка: H1 «Меню», вводный абзац, плашка «При заказе любого блюда на вынос скидка 10%» (`inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-2 text-sm font-semibold`, иконка `ShoppingBag`).
- Клиентский `MenuCatalog` получает дерево (сериализуемые данные) и добавки.

**`menu-catalog.tsx` (`'use client'`).**
- Состояние: `query` (поиск), `activeId` (scroll-spy).
- **Поиск**: `Input` «Найти блюдо или напиток» (иконка `Search`, кнопка очистки `X`), фильтр без учёта регистра по `name`, `description`, `choiceNote`, `originCountry` позиций; категории без совпадений скрываются, раздел без результатов — сообщение «Ничего не найдено. Попробуйте другое слово». Дебаунс не нужен (≈260 позиций), `useDeferredValue` для плавности. При непустом запросе scroll-spy отключается, а навигация показывает только категории с результатами.
- **Scroll-spy**: `IntersectionObserver` по заголовкам категорий (`id="cat-{slug}"`), `rootMargin: '-25% 0px -65% 0px'`; активная категория подсвечивается в навигации; на мобильных активный чип прокручивается в видимую область (`scrollIntoView({ inline: 'center', block: 'nearest' })`).
- **Разметка**: на `lg+` — две колонки: слева sticky-навигация `lg:sticky lg:top-24 lg:w-[260px] shrink-0 lg:max-h-[calc(100vh-7rem)] overflow-y-auto`, справа контент `min-w-0 flex-1`; на мобильном — навигация сверху одной строкой: `sticky top-20 z-30 -mx-[7vw] px-[7vw] bg-background/90 backdrop-blur border-b` с горизонтальной прокруткой чипов (`flex gap-2 overflow-x-auto [scrollbar-width:none]`), поиск над ней (не sticky).
- **`menu-nav.tsx`**: категории верхнего уровня; подкатегории — вложенный список (на десктопе отступ `pl-4`, на мобильном — отдельные чипы после родителя). Ссылки `<a href="#cat-{slug}">` (плавный скролл через CSS `scroll-behavior: smooth` уже в `globals.css`; иначе `onClick` + `scrollIntoView`), `aria-current="true"` у активной. Активная — `bg-primary text-white`, остальные `bg-white text-[#8E8E8E] hover:text-foreground`, `rounded-[12px] px-3 py-2 text-sm font-medium`.
- **Категория** (`<section id="cat-{slug}" className="scroll-mt-40 mb-10">`): H2 `font-semibold text-[clamp(22px,2.1vw,40px)]`; подкатегории — H3 `text-xl font-semibold` внутри родителя (`id="cat-{subslug}"`, `scroll-mt-40`). Карточка со списком позиций `rounded-[12px] bg-white divide-y divide-[#EEF0F2]`.
- **Общая сетка цен** (`price-group-table.tsx`): если у категории `priceGroup` — над позициями выводится таблица-шапка: название сетки (при наличии) и тарифы в строку (`label` + «выход» + цена), стиль: `rounded-[12px] bg-[#1C1C1C] text-white p-4`, тарифы `flex flex-wrap gap-x-8 gap-y-2` («0,3 л — 250 ₽»). Позиции без собственных `variants`, у которых `item.priceGroup` совпадает с сеткой категории (по `name`), цены **не** дублируют и показывают вместо цены серую подпись «цена по сетке» (`text-xs text-muted-foreground`); позиции с собственными вариантами — обычная цена. Если у позиции своя сетка, отличная от сетки категории (или у категории сетки нет) — уровни `item.priceGroup.tiers` выводятся в блоке цен строки позиции так же, как варианты («Чайник 600 мл — 450 ₽»).
- **Строка позиции (`menu-item-row.tsx`)**: слева — `name` (`font-semibold text-base md:text-lg`), `description` (`text-sm text-[#8E8E8E] leading-relaxed`), `choiceNote` (`text-xs italic text-muted-foreground`, префикс «Подача на выбор: »), `originCountry` (бейдж `rounded-full bg-muted text-xs px-2 py-0.5`), опционально миниатюра `image` (`Picture`, `w-20 h-20 rounded-[10px] object-cover`, `sizes="80px"`, на мобильном ниже названия). Справа — блок цен (`text-right shrink-0`):
  - один вариант: «520 ₽» (`font-bold text-lg tabular-nums`) и ниже серым выход «300 г»;
  - несколько вариантов: столбик строк «`{label}` / `{amount unit}` — **цена ₽**» (например «0,3 л — 250 ₽», «0,5 л — 350 ₽»);
  - при `isTakeawayDiscount` — значок `ShoppingBag h-3.5 w-3.5 text-primary` с `title="Скидка 10% на вынос"` и `sr-only` текстом.
  - На мобильном блок цен под названием (`flex-col`), цены выровнены влево.
- **Форматирование (`_lib/format.ts`)**:

```ts
export const UNIT_LABEL = { g: 'г', ml: 'мл', l: 'л', pcs: 'шт' } as const;
export const formatPrice = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;      // неразрывный пробел внутри toLocaleString
export function formatAmount(amount: number | string | null, unit: keyof typeof UNIT_LABEL | null) {
  if (amount == null || unit == null) return '';
  const n = Number(amount);
  return `${Number.isInteger(n) ? n : String(n).replace('.', ',')} ${UNIT_LABEL[unit]}`;
}
```
- **Интересный факт** (`fun-fact.tsx`): если у категории есть `funFactText` — карточка в конце категории: `rounded-[12px] border border-primary/20 bg-primary/5 p-4 md:p-5`, иконка `Lightbulb text-primary`, заголовок `funFactTitle` (по умолчанию «Интересный факт») `font-semibold`, текст `text-sm md:text-base`.
- **Заметка о выносе**: в конце каждой категории, где есть хотя бы одна позиция с `isTakeawayDiscount`, мелкая строка `text-xs text-muted-foreground`: «При заказе любого блюда на вынос скидка 10%».
- **Добавки** (`modifiers` из `getMenuTree()`, если есть): финальный раздел «Дополнительно» `id="cat-extras"` в навигации: список «название — цена» (двухколоночный на `md+`), подпись «Платные добавки к блюдам. Уточняйте у официанта».
- Нижний CTA (см. общие правила, `block="Меню"`).

**JSON-LD `Menu`** (`_lib/menu-jsonld.ts`): функция `menuJsonLd(tree, siteUrl)` возвращает объект `{ '@context': 'https://schema.org', '@type': 'Menu', name: 'Меню бильярдного клуба «Пирамида»', url: `${siteUrl}/menu`, inLanguage: 'ru', hasMenuSection: [...] }`; категории → `MenuSection` (`name`, `hasMenuItem`, вложенные `hasMenuSection` для подкатегорий); позиции → `MenuItem` (`name`, `description`, `offers: { '@type': 'Offer', price: String(minPrice), priceCurrency: 'RUB' }`, где `minPrice` — минимальная цена среди вариантов, для позиций с сеткой — минимальная цена сетки; если цены нет — без `offers`). Подключается в серверном `Content` через `jsonLdScript`.

---

### 2. `/prices`

**Данные.** `getHalls()`, `getTariffs()`, `getExtraServices()`, `getPenalties()`; `opDate` из `getOpDate()` для отбора действующих тарифов: `isActive && (!validFrom || validFrom <= opDate) && (!validTo || validTo >= opDate)`.

**Структура.**
1. H1 «Цены на бильярд», вводный абзац («Стоимость часа игры. Время после полуночи относится к предыдущему дню: 02:00–09:00 в ночь с пятницы на субботу считается по тарифу пятницы»).
2. **Аренда** — для каждой группы залов отдельная карточка с таблицей «дни × интервалы времени»:
   - группа «Общий зал» (залы `kind = 'common'`; описание `description`, строка «N столов · M мест за столом»);
   - VIP-комнаты: залы с одинаковым набором тарифов (одинаковая «подпись» — отсортированный список `days|start|end|price|unit`) объединяются в одну таблицу с заголовком «VIP-комнаты (VIP 1, VIP 2, VIP 3)»; если тарифы у комнат разные — отдельная таблица на каждую («VIP 3»).
   - раздел «Пенсионный тариф» (`audience = 'pensioner'`): отдельная таблица с пометкой «для гостей пенсионного возраста».
3. **Дополнительные услуги** (`extras-table.tsx`): таблица «Услуга / Стоимость» (нарды и шахматы, прокат кия и др.): цена `per_hour` → «250 ₽/час», `per_session`/`fixed` → «250 ₽».
4. **Штрафы** (`penalties-list.tsx`): два списка рядом на `lg+` (колонки `grid lg:grid-cols-2 gap-6`), на мобильном друг под другом: «Штрафы за бой посуды» (`kind = 'dishware'`) и «Штрафы за порчу имущества» (`kind = 'property'`); строка: название — цена (`priceIsMinimum` → «от 500 ₽»), чередование фона `#F8FAFB`/`#fff`, порядок по `sortOrder`.
5. Примечание: «*Стоимость может отличаться от указанной. Точную стоимость уточняйте у администратора.» и CTA (`block="Прайс"`).

**Матрица тарифов (`_lib/matrix.ts`)** — чистая функция, на вход тарифы одного зала (или группы), на выход структура таблицы:

```ts
export type Matrix = {
  columns: { key: string; label: string; days: number[] }[];       // группы дней, порядок — по первому появлению в отсортированных тарифах
  rows: { key: string; startMin: number; endMin: number; label: string; night: boolean }[];   // уникальные интервалы, по startMin
  cells: Record<string /* rowKey */, Record<string /* colKey */, { price: number; unit: 'per_hour'|'fixed'|'per_session'; note?: string } | null>>;
};
export function buildMatrix(tariffs: TariffRow[]): Matrix { /* см. правила ниже */ }
```
Правила: (а) `columns` — уникальные наборы `daysOfWeek` (ключ — отсортированная строка `'0,1,2,3,4'`); (б) `label` набора: `[0,1,2,3,4]` → «Вс–Чт», `[5,6]` → «Пт–Сб», все 7 → «Ежедневно», иначе перечисление в порядке `1..6,0` («Пн, Ср»); столбцы сортируются так, чтобы будни/«Вс–Чт» шли раньше «Пт–Сб»; (в) `rows` — уникальные пары `startMin–endMin`, подпись `${minToClock(startMin)}–${minToClock(endMin)}` (для `endMin = 1440` → `…–09:00`), `night = endMin > 900` (пересекает полночь, т.е. включает часы после 00:00) — для таких строк под временем серым «ночные часы относятся к предыдущему дню» (только один раз в сноске, не в каждой строке: в строке достаточно иконки `Moon`); (г) ячейка — тариф, у которого набор дней и интервал совпадают; нет тарифа — «—» (`text-muted-foreground`); (д) цена `per_hour` — «580 ₽/час», `fixed` — «3 500 ₽ за ночь», `per_session` — «… ₽ за сеанс»; (е) если у тарифа есть `validFrom/validTo` — к ячейке добавляется `note` «до 31.12» / «с 01.12».

Рендер (`tariff-matrix.tsx`): `<table>` на всю ширину карточки, шапка `bg-[#1C1C1C] text-white` с колонками «Время» + столбцы групп дней; строки чередуются `#F8FAFB`/`#fff`; ячейка цены `font-bold tabular-nums text-center`; контейнер `overflow-x-auto`, первый столбец `sticky left-0 bg-inherit` (на мобильном таблица не ломается).

Нижний CTA и ссылка «Прайс с акциями и скидками» не нужны.

---

### 3. `/tournaments`

**Параметры** (`searchParams`, все необязательные): `year` (по умолчанию — год из `opDate`), `discipline` (значение enum `discipline`), `category` (строка из `categories`), `past=1` (раскрыть прошедшие).

**Данные.** `getSeasonTournaments(year)`; `opDate` — для разделения: предстоящие = `endDate >= opDate`, прошедшие = `endDate < opDate`. Фильтры применяются в JS в `_lib/group.ts`: `discipline` (равенство) и `category` (регистронезависимое равенство элемента `categories`). Список доступных значений фильтров — из **неотфильтрованных** данных года (чтобы чипы не исчезали при выборе).

**Структура.**
1. H1 «Календарь турниров {год}», подзаголовок «Соревнования по бильярдному спорту в Челябинске. Взнос и призовой фонд уточняйте в описании турнира или у администратора».
2. Переключатель года: `Link`-чипы `{год-1}`, `{год}`, `{год+1}` (текущий — активный; `href=?year=…`, остальные фильтры сбрасываются).
3. **Фильтры** (`tournament-filters.tsx`, серверный компонент, чипы-ссылки `next/link` с `scroll={false}`, сохраняют остальные параметры): «Дисциплина: Все · Свободная пирамида · Комбинированная · …» (только присутствующие в данных) и «Категория: Все · Мужчины · Женщины · …». Активный чип — `bg-primary text-white`, прочие `bg-white text-[#8E8E8E] hover:text-foreground border`; ряд `flex flex-wrap gap-2`. Кнопка «Сбросить» при активных фильтрах.
4. **Предстоящие по месяцам** (`group.ts`: `groupByMonth(list)` → `{ monthKey: 'YYYY-MM', title: 'Март 2026', items }[]`; название месяца — `new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${startDate}T00:00:00Z`))` с заглавной буквы). Заголовок месяца H2 `text-2xl font-semibold`, под ним сетка карточек `grid grid-cols-1 md:grid-cols-2 gap-6` (на `xl` — 2 колонки, карточки крупные).
5. **Карточка (`tournament-card.tsx`)**: `rounded-[12px] bg-white overflow-hidden shadow-sm card-interactive` (hover `-translate-y-0.5 shadow-md` по `DESIGN.md`); сверху обложка `aspect-[16/6]` (`Picture`, `object-cover`, `sizes="(min-width:768px) 50vw, 100vw"`, `alt` = `title`), при отсутствии — градиент `bg-gradient-to-br from-primary to-primary-dark` с иконкой `Trophy text-white/70`; **плашка** поверх обложки внизу слева `absolute bottom-3 left-3 rounded-[8px] bg-white/80 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm` — дата красным `text-date` (`formatEventDate(startDate, endDate)`). Ниже `p-4 md:p-5 space-y-3`: название `font-semibold text-lg`; бейджи (`rounded-full text-xs`): серия «Марафон-Промнефтегаз · 3 тур», дисциплина, уровень, категории (`variant="outline"`); `description` (`text-sm text-muted-foreground line-clamp-3`); строка «Взнос: 1 000 ₽ · Призовой фонд: 50 000 ₽» (только если значения есть; формат `formatPrice`); бейдж «Регистрация открыта» (`bg-green-500/10 text-green-600`) при `registrationOpen`; кнопка «Подать заявку» (только для предстоящих) — `<LeadDialogTrigger kind="tournament" tournamentId={t.id} block="Турниры" formTitle={`Запись на турнир: ${t.title}`} asChild><Button variant="outline">Подать заявку</Button></LeadDialogTrigger>`.
6. **Прошедшие турниры** (`past-tournaments.tsx`): нативный `<details>` «Прошедшие турниры ({N})» (по умолчанию закрыт; открыт при `past=1`), внутри компактный список строк (дата красным `text-date`, название, серия/дисциплина серым) в порядке убывания даты. Кнопка-ссылка «Показать прошедшие» не нужна — используется `<details>`.
7. Пустые состояния: нет предстоящих при выбранных фильтрах — «По выбранным фильтрам предстоящих турниров нет» + «Сбросить фильтры»; нет предстоящих вообще — «В {год} году запланированных турниров больше нет».
8. **Блок «Календарный план»** (CTA, `rounded-[12px] bg-primary text-white p-6 md:p-10`): «Хотите участвовать или узнать детали?» + кнопка `LeadDialogTrigger kind="callback" block="Календарный план" formTitle="Календарный план турниров" asChild` (кнопка `variant="secondary"`).

**Подписи (`_lib/labels.ts`)**: `free_pyramid` «Свободная пирамида», `combined_pyramid` «Комбинированная пирамида», `dynamic_pyramid` «Динамичная пирамида», `moscow_pyramid` «Московская пирамида», `free_pyramid_continuation` «Свободная пирамида с продолжением», `pool` «Американский пул», `other` «Другое»; уровни: `regional_championship` «Чемпионат области», `regional_youth` «Первенство области», `club` «Клубный турнир», `other` «Другое».

**JSON-LD.** Для каждого предстоящего турнира выбранного года (до 30) — `sportsEventJsonLd(t)` (передайте то, что требует функция: название, даты, описание, URL страницы `/tournaments`, изображение — абсолютный URL через `mediaUrl`, организатор — клуб); массивом в одном `<script type="application/ld+json">` (`@graph`) либо по одному — как удобнее `jsonLdScript`. Плюс `breadcrumbJsonLd`.

---

## Acceptance Criteria

- [ ] Созданы все файлы из списка; `src/lib/queries/**`, схема и общие файлы не изменены; новых пакетов нет.
- [ ] Каждая из страниц `/menu`, `/prices`, `/tournaments`: статичная оболочка + данные в `<Suspense>` после `await connection()`, «сегодня» передаётся аргументом (`getOpDate()`), статический `metadata` (title, description, canonical, OG), хлебные крошки и JSON-LD; `pnpm build` проходит без БД.
- [ ] `/menu`: все активные категории и подкатегории с позициями из БД; варианты объёмов выводятся списком («0,3 л — 250 ₽»); у категорий с общей сеткой цен виден заголовок-сетка и позиции показывают «цена по сетке»; карточка «Интересный факт»; примечание «скидка 10% на вынос»; клиентский поиск скрывает неподходящие позиции и пустые категории; sticky-навигация (боковая на `lg+`, чипы сверху на мобильном) с scroll-spy; JSON-LD `Menu`.
- [ ] `/prices`: таблицы «дни × интервалы времени» по залам (VIP-комнаты с одинаковыми тарифами объединены), пенсионный тариф, доп. услуги, два списка штрафов (с «от»); ночные интервалы подписаны; на seed цены совпадают со старым сайтом (580/640/680/760, 3500 ₽/ч ночью, VIP 1400/4800, пенсионный 200, прокат 250).
- [ ] `/tournaments`: сезон сгруппирован по месяцам, фильтры по дисциплине и категории через `searchParams` (серверные ссылки, работают без JS), переключатель года, прошедшие свёрнуты в `<details>`, карточки с обложкой 16:6, красной датой `formatEventDate`, плашкой `bg-white/80`, бейджами и кнопкой «Подать заявку» (`kind="tournament"`, заявка с `tournamentId`); блок CTA «Календарный план» (`block="Календарный план"`); JSON-LD `SportsEvent` для предстоящих.
- [ ] Разделение «предстоящие / прошедшие» — по `endDate >= opDate`.
- [ ] Страницы корректно выглядят на 1920, 1440, 768 и 375px (таблицы прайса скроллятся по горизонтали, нет горизонтального скролла страницы), по `DESIGN.md`, с видимым фокусом.
- [ ] `pnpm lint` и `pnpm typecheck` проходят без ошибок.

## Notes

- Добавки берутся из `getMenuTree().modifiers`; собственных запросов к БД (`_data.ts`) страница меню не создаёт. Если `getSeasonTournaments` возвращает и неопубликованные — отфильтруйте `isPublished` на странице.
- Названия месяцев и дни недели выводятся только по-русски; `formatEventDate` — единственный форматтер диапазонов дат.
- Запись на турнир — `LeadDialogTrigger kind="tournament"` с `tournamentId={t.id}`, `block="Турниры"`, `formTitle={`Запись на турнир: ${t.title}`}`; заявка сохраняется с `type='tournament'` и `leads.tournamentId`.
- Граница «предстоящий/прошедший» — `endDate >= opDate`, где `opDate = getOpDate()` (до 09:00 — вчера). Это намеренно и совпадает с `getUpcomingTournaments(opDate)`: турнир остаётся в предстоящих до 09:00 следующего дня после `endDate`.
- Не используйте `next/image` для медиа из `/media` — только `<Picture>`.
