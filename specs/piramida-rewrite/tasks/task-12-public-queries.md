# Task 12: Публичные запросы к БД и кэш-теги

## Status

pending

## Wave

3

## Description

Слой чтения данных для публичного сайта: кэш-теги, типизированные настройки с дефолтами и все кэшируемые запросы (`'use cache'` + `cacheLife('max')` + `cacheTag`) для настроек, турниров, цен, акций, меню, банкетных сетов, галерей, услуг, юридических документов и каталога калькулятора. Страницы (задачи 13, 20–25) вызывают эти функции внутри `<Suspense>` после `await connection()`; админка (задачи 16–19) инвалидирует теги через `updateTag`. Функции возвращают только простые сериализуемые объекты (строки вместо `Date`), с уже присоединёнными медиа-ассетами.

## Dependencies

**Depends on:** task-01-starter-cleanup-deps.md, task-03-db-schema.md, task-05-calculator-core.md, task-06-shared-utils.md
**Blocks:** task-13-site-layout.md, task-16-admin-tournaments-promotions.md, task-17-admin-pricing.md, task-18-admin-menu-sets.md, task-19-admin-galleries-settings-leads.md, task-20-home-sections-top.md, task-21-home-sections-bottom.md, task-22-pages-menu-prices-tournaments.md, task-23-legal-seo-redirects.md, task-24-calculator-ui.md, task-25-blog-public.md

**Context from dependencies:**
- Task 01 включил в `next.config.ts` `cacheComponents: true` (директива `'use cache'`, `cacheLife`, `cacheTag`, `updateTag` из `next/cache` стабильны без префикса `unstable_`).
- Task 03 создал схему в `src/lib/schema/*.ts`: `siteSettings` (`key` PK, `value` jsonb), `tournamentSeries`, `tournaments`, `halls`, `rentalTariffs`, `extraServices`, `penaltyItems`, `promotions`, `menuCategories`, `priceGroups`, `priceGroupTiers`, `menuItems`, `menuItemVariants`, `menuModifiers`, `banquetSets`, `banquetSetItems`, `galleries`, `galleryItems`, `services`, `legalDocuments`, `mediaAssets`. Поля — по `data/contracts.md`; **точные имена колонок брать из файлов схемы**. Файл `src/lib/db.ts` экспортирует `db`. Для каталога калькулятора и меню важны: `menuCategories` (`id`, `parentId?`, `slug`, `title`, `priceGroupId?`, `sortOrder`, `isActive`), `menuItems` (`id`, `code`, `categoryId`, `name`, `priceGroupId?`, `sortOrder`, `isActive`), `menuItemVariants` (`code`, `itemId`, `label?`, `amount?`, `unit?`, `price`, `sortOrder`, `isActive`), `priceGroupTiers` (`groupId`, **`code varchar(8)` unique** (nanoid 6), `label`, `amount?`, `unit?`, `price`, `sortOrder`); `halls` (`id`, `name`, `slug`, `kind`, `tablesCount`, `seatsPerTable`, …); `galleries.key` — `text` unique (не enum); `legalDocuments` (`type`, `version varchar(32)`, `title`, `body` markdown с плейсхолдерами, `sha256`, `publishedAt`, `createdAt`).
- Task 05 создал `src/lib/calculator/types.ts` с типом `CalculatorCatalog` (`halls: CalcHall[]` где `CalcHall = { id; slug; name; kind; tablesCount; seatsPerTable }`, `tariffs`, `extraServices`, `menuVariants: CalcMenuVariant[]` где `CalcMenuVariant = { code: string; itemName: string; label: string; price: number; categorySlug: string; categoryName: string }`, `sets: { code; title; pricingMode; price; minGuests?; maxGuests? }[]`, `promotions`) и `src/lib/calculator/catalog-mapper.ts`: `buildMenuVariants(rows: MenuVariantSourceRows): CalcMenuVariant[]`, `MenuVariantSourceRows = { categories: { id; slug; title; priceGroupId: string | null; sortOrder }[]; items: { id; code; name; categoryId; priceGroupId: string | null; sortOrder }[]; variants: { code; itemId; label: string | null; price; sortOrder }[]; tiers: { code; groupId; label; price; sortOrder }[] }` (свои варианты → `code = variant.code`; иначе сетка `item.priceGroupId ?? category.priceGroupId` → `code = \`${item.code}-${tier.code}\``, `label = tier.label`; порядок по `sortOrder`). Маппинг в `calculator.ts` должен давать ровно `CalculatorCatalog`.
- Task 06 создал `src/lib/dates.ts` (`getOpDate`, `getToday`, `TZ`) — в `'use cache'` функциях их **не** вызывать, дата приходит аргументом.
- Task 10 (параллельно) заполняет БД seed-данными и пишет в `site_settings` ровно те же ключи, что описаны в `settings-defaults.ts` ниже.

## Files to Create

- `src/lib/cache-tags.ts` — `TAGS`, `articleTag`
- `src/lib/settings-defaults.ts` — тип `SiteSettings`, `SETTINGS_DEFAULTS`, `SETTING_KEYS`, `mergeSettings`
- `src/lib/queries/types.ts` — общие типы (`PublicMedia` и др.) и хелпер присоединения медиа
- `src/lib/queries/settings.ts` — `getSettings`
- `src/lib/queries/tournaments.ts` — `getUpcomingTournaments`, `getSeasonTournaments`, `getTournamentSeries`, `getTournamentYears`
- `src/lib/queries/pricing.ts` — `getHalls`, `getTariffs`, `getExtraServices`, `getPenalties`, `getPriceFrom`
- `src/lib/queries/promotions.ts` — `getActivePromotions`, `getCarouselPromotions`
- `src/lib/queries/menu.ts` — `getMenuTree`, `getBanquetSets`
- `src/lib/queries/galleries.ts` — `getGallery`, `getServices`
- `src/lib/queries/legal.ts` — `getCurrentLegalDocument`
- `src/lib/queries/calculator.ts` — `getCalculatorCatalog`

## Files to Modify

Нет. (Файл `src/lib/queries/blog.ts` пишет задача 25.)

## Technical Details

### Implementation Steps

1. Прочитать `src/lib/schema/*.ts`, `src/lib/db.ts`, `src/lib/calculator/types.ts`.

2. **Правила для всех запросов (PLAN §16.1):**
   - Каждая экспортируемая функция запроса — `async function` с первой строкой `'use cache'`, затем `cacheLife('max')` и один/несколько `cacheTag(...)`. Импорт: `import { cacheLife, cacheTag } from 'next/cache'`.
   - Внутри нельзя `headers()`, `cookies()`, `new Date()` для вычисления «сегодня», `Math.random`. Дата (`opDate`, формат `YYYY-MM-DD`) — **аргумент** (он становится частью ключа кэша). Вызывающие передают `getOpDate()`.
   - Никакого `try/catch → []`: ошибка БД должна пробрасываться, чтобы пустой результат не попал в кэш.
   - Все аргументы и результаты — сериализуемы: `Date` → ISO-строка, `date`-колонки Drizzle уже строки, `bigint` → `number`.
   - Не использовать `generateStaticParams` и не вызывать эти функции вне `<Suspense>` + `await connection()` (это обязанность потребителей; в JSDoc каждой функции добавить пометку «вызывать после `await connection()` внутри `<Suspense>`»).
   - Выбирать только активные/опубликованные строки (`isActive`, `isPublished`), сортировка по `sortOrder`, где поле есть.

3. **`cache-tags.ts`:**

```ts
export const TAGS = {
  tournaments: "tournaments", pricing: "pricing", promotions: "promotions", menu: "menu", sets: "sets",
  galleries: "galleries", services: "services", settings: "settings", blog: "blog", legal: "legal",
} as const
export type CacheTag = (typeof TAGS)[keyof typeof TAGS]
export const articleTag = (slug: string) => `article:${slug}`
```

4. **`settings-defaults.ts`** — не содержит серверных импортов (его читают и админка, и клиентские формы). Тип ниже — канонический: `data/contracts.md` («`SiteSettings` — канонический список ключей») зеркалит его дословно, seed (задача 10), форма настроек (задача 19) и все потребители используют ровно эти ключи; других ключей нет (в частности, не существуют `workingHours`, `mapLat`/`mapLon`, `mapYandexOid`, `mapEmbedUm`, `operatorName`/…, `retentionMonths`, `seo`). `phoneHref` хранит готовый href с префиксом `tel:`. Значения по умолчанию — данные старого сайта (`data/legacy-notes.md`), **без секретов**:

```ts
export type SiteSettings = {
  phone: string               // "+7 (900) 068-50-00"
  phoneHref: string           // "tel:+79000685000"
  email: string               // "biliyard174@yandex.ru"
  address: string             // "г. Челябинск, Орджоникидзе 58а к3"
  addressNote: string         // "Горсад им. А.С. Пушкина"
  hours: string               // "Ежедневно 09:00–02:00"
  telegramUrl: string         // "https://t.me/bkpiramida"
  vkUrl: string               // "https://vk.ru/piramida.billiard"
  mapConstructorId: string    // значение um= конструктора карты, с префиксом "constructor:"
  mapOrgId: string            // "47911977113"
  geo: { lat: number; lon: number }          // 55.153739, 61.404441
  heroTitle: string
  heroSubtitle: string
  heroBadgePhrases: string[]
  aboutTitle: string
  aboutPoints: { title: string; text: string }[]
  seoDefaults: { title: string; description: string; ogImageMediaId: string | null }
  operator: { name: string; inn: string; ogrn: string; address: string; email: string }
  telegramIncludePii: boolean // по умолчанию false
  leadRetentionMonths: number // по умолчанию 12
}
export const SETTING_KEYS = Object.keys(SETTINGS_DEFAULTS) as (keyof SiteSettings)[]
export const SETTINGS_DEFAULTS: SiteSettings = { /* значения из legacy-notes, как в таблице seed задачи 10 */ }
export function mergeSettings(rows: { key: string; value: unknown }[]): SiteSettings // известные ключи перекрывают дефолты; неизвестные игнорируются; значение с неверным типом — дефолт
```

   Тексты `heroTitle`, `heroSubtitle`, `heroBadgePhrases`, `aboutTitle`, `aboutPoints`, `seoDefaults.title/description` взять дословно из `data/legacy-notes.md` и `/index.php` секции hero/«О клубе» (строки приведены в задаче 10, раздел 3.6 — значения совпадают). `operator` по умолчанию — пустые строки, `email` = `biliyard174@yandex.ru`. Проверка типа в `mergeSettings` — простые `typeof`/`Array.isArray`-проверки по форме дефолта (zod не обязателен).

5. **`queries/types.ts`:**

```ts
/** Структурно совпадает с PictureAsset из src/lib/media/url.ts (задача 09). */
export type PublicMedia = {
  id: string; path: string; width: number; height: number; blurDataUrl: string; alt: string
  variants: { w: number; format: "avif" | "webp"; file: string }[]
}
export function toPublicMedia(row: typeof mediaAssets.$inferSelect | null | undefined): PublicMedia | null
/** Загружает ассеты одним запросом по списку id → Map (для присоединения без N+1). */
export async function loadMedia(ids: (string | null | undefined)[]): Promise<Map<string, PublicMedia>>
```

   Это **не** `'use cache'` модуль: функции вызываются изнутри кэшируемых запросов. Объекты должны содержать `id`.

6. **`queries/settings.ts`:** `getSettings(): Promise<SiteSettings>` — `'use cache'`, `cacheLife('max')`, `cacheTag(TAGS.settings)`; читает все строки `siteSettings`, возвращает `mergeSettings(rows)`. При пустой таблице вернутся дефолты — это нормальное поведение (не ошибка).

7. **`queries/tournaments.ts`** (тег `TAGS.tournaments`; обложки через `loadMedia`):
   - тип `PublicTournament { id; slug; title; seriesName: string | null; seriesSlug: string | null; stageNumber: number | null; discipline: …|null; level; categories: string[]; startDate: string; endDate: string; entryFee: number | null; prizeFund: string | null; description: string | null; registrationOpen: boolean; cover: PublicMedia | null }` (типы `entryFee`/`prizeFund` — как в схеме);
   - `getUpcomingTournaments(opDate: string, limit = 5)`: `isPublished = true AND endDate >= opDate`, сортировка `startDate asc, endDate asc`, `limit`. **Условие по `endDate`, а не по `startDate`** (баг старого сайта). Так как `opDate = getOpDate()` — операционная дата (до 09:00 считается вчера), турнир остаётся в списке до 09:00 дня, следующего за `endDate`; **это намеренно** (решение 17 в `contracts.md`), «исправлять» на календарную дату не нужно;
   - `getSeasonTournaments(year: number)`: `isPublished = true` и `startDate` в пределах года (`${year}-01-01 … ${year}-12-31`), сортировка по `startDate`; тот же тип;
   - `getTournamentSeries()`: `{ id; slug; name; description: string | null; tournamentsCount: number }[]`;
   - `getTournamentYears(): Promise<number[]>` — различные годы `startDate` опубликованных турниров по убыванию (нужна странице `/tournaments` для архива; добавлено сверх контракта).

8. **`queries/pricing.ts`** (тег `TAGS.pricing`):
   - `getHalls()` → `{ id; name; slug; kind; tablesCount; seatsPerTable; description }[]` (активные, `sortOrder`);
   - `getTariffs()` → активные тарифы с `hallId`, `hallName`, `hallKind`, `daysOfWeek: number[]`, `startMin`, `endMin`, `price`, `priceUnit`, `audience`, `label`, `validFrom: string | null`, `validTo: string | null`, `sortOrder`; **все** активные (в т.ч. пенсионные), фильтрацию по дате действия делают потребители;
   - `getExtraServices()` → активные доп. услуги (`id; name; price; priceUnit; description?` — по схеме);
   - `getPenalties()` → активные штрафы `{ id; kind; name; price; priceIsMinimum }[]`, порядок: `kind`, затем `sortOrder`;
   - `getPriceFrom(hallKind: "common" | "vip"): Promise<number | null>` — минимальная цена среди активных тарифов `priceUnit = 'per_hour'`, `audience = 'all'` залов указанного вида; `null`, если тарифов нет. Единица — ₽/час (для «От 580₽/час» в карточках услуг).

9. **`queries/promotions.ts`** (теги `TAGS.promotions`, обложки):
   - тип `PublicPromotion { id; slug; title; shortText; description; discountPercent: number | null; daysOfWeek: number[] | null; startMin: number | null; endMin: number | null; target; targetMenuCategoryId: string | null; audienceNote: string | null; validFrom: string | null; validTo: string | null; showInCarousel: boolean; cover: PublicMedia | null }`;
   - `getActivePromotions(opDate: string)`: `isActive` и (`validFrom` null или ≤ `opDate`) и (`validTo` null или ≥ `opDate`), сортировка `sortOrder`;
   - `getCarouselPromotions(opDate: string)`: то же + `showInCarousel = true`.

10. **`queries/menu.ts`** (тег `TAGS.menu`; `getBanquetSets` — теги `TAGS.sets` и `TAGS.menu`):
    - `getMenuTree(): Promise<MenuTree>`, `MenuTree = { categories: MenuCategoryNode[]; modifiers: { id; name; price; categoryId: string | null }[] }`. Узел категории: `{ id; slug; title; funFactTitle: string | null; funFactText: string | null; priceGroup: { name: string; tiers: { code?: string; label; amount: number; unit: "g"|"ml"|"l"|"pcs"; price: number }[] } | null; items: MenuItemNode[]; children: MenuCategoryNode[]; modifiers: …[] }`; позиция: `{ id; code; name; description: string | null; choiceNote: string | null; originCountry: string | null; isTakeawayDiscount: boolean; image: PublicMedia | null; priceGroup: … | null; variants: { code; label: string | null; amount: number | null; unit: … | null; price: number }[] }`. Если у позиции `priceGroupId` — она берёт сетку своей группы; иначе наследует сетку категории. Уровни сетки могут нести `code` (`priceGroupTiers.code`) — необязательное поле, безвредно для потребителей; калькулятор (задача 24) группирует позиции по `categorySlug`/`categoryName` из `getCalculatorCatalog`, а не по `getMenuTree`.
    - Загрузка: несколько плоских запросов (категории, позиции, варианты, сетки+уровни, добавки, ассеты) и сборка дерева в JS. Только активные категории/позиции; порядок — `sortOrder`. Дерево — два уровня (категория → подкатегории).
    - `getBanquetSets()`: активные сеты `{ id; code; title; description; pricingMode; price; minGuests: number | null; maxGuests: number | null; cover: PublicMedia | null; items: { label: string; qty: number }[] }`; `label` — `customLabel` либо `«<название позиции> <метка варианта>»`.

11. **`queries/galleries.ts`** (теги `TAGS.galleries`, для `getServices` ещё `TAGS.services`):
    - `getGallery(key: string)` (`galleries.key` — `text` unique, не enum; код сайта опирается на ключи seed: `hero`, `service_russian`, `service_pool`, `service_vip`, `service_training`, `bar`, `about`, `cta`): `{ key; title; items: { id; caption: string | null; media: PublicMedia }[] } | null` (элементы по `sortOrder`); пустая галерея возвращает `items: []`, неизвестный ключ — `null`;
    - `getServices()`: активные услуги по `sortOrder` со всеми полями вкладки (`id; key; title; subtitle: string | null; bullets: string[]; priceFrom: number | null; priceFromHallKind: "common" | "vip" | null; priceNote: string | null; ctaType: "booking" | "callback"; ctaBlock: string; galleryKey: string | null`; `ctaType` — колонка `varchar` (default `'booking'`), приводится к union; колонки `description` в `services` нет — описание лежит во второй строке `subtitle`) и вложенным `gallery: { id; caption; media }[]` (элементы галереи по `galleryKey`; один дополнительный запрос на все ключи).

12. **`queries/legal.ts`** (теги `TAGS.legal` и `TAGS.settings`): `getCurrentLegalDocument(type: "policy" | "consent")` → `{ id: string; type: "policy" | "consent"; version: string; title: string; text: string; publishedAt: string; sha256: string } | null` — запись последней опубликованной версии типа (`WHERE publishedAt IS NOT NULL ORDER BY publishedAt DESC LIMIT 1`; `publishedAt = null` — черновик админки; `version` — строка, колонка `varchar(32)`; `publishedAt` — ISO-строка; `text` получается из колонки `body`). Поле `text` возвращается **с подставленными плейсхолдерами** из `getSettings()` (вызвать её внутри). Полный список плейсхолдеров (других нет):

| Плейсхолдер | Значение |
|---|---|
| `{{operator_name}}` | `settings.operator.name` |
| `{{operator_inn}}` | `settings.operator.inn` |
| `{{operator_ogrn}}` | `settings.operator.ogrn` |
| `{{operator_address}}` | `settings.operator.address` |
| `{{operator_email}}` | `settings.operator.email` |
| `{{phone}}` | `settings.phone` |
| `{{site_url}}` | `process.env.NEXT_PUBLIC_SITE_URL` |
| `{{retention_months}}` | `settings.leadRetentionMonths` |

    Незаполненное значение подставляется как «[не указано]» (чтобы документ не публиковался с пустыми местами незаметно). `title` — из колонки `title`, если пустая — по типу («Политика обработки персональных данных» / «Согласие на обработку персональных данных»). **Это единственное место подстановки плейсхолдеров во всём проекте:** потребители (футер/`PolicyDialog` задач 13/11, страницы `/politika`/`/soglasie` задачи 23) рендерят `text` как есть и повторно не подставляют.

13. **`queries/calculator.ts`** (теги `pricing`, `menu`, `sets`, `promotions`): `getCalculatorCatalog(): Promise<CalculatorCatalog>` — активные залы (`{ id, slug, name, kind, tablesCount, seatsPerTable }`, `slug` обязателен: по нему работает параметр `?hall=`), тарифы, доп. услуги; `sets`: активные банкетные сеты; `promotions`: активные акции в форме `CalcPromotion` из task 05 (с `daysOfWeek`, `startMin`, `endMin`, `discountPercent`, `validFrom/validTo`, `title`). Без фильтра по дате (дата приходит позже в `calculateQuote`). `menuVariants` собирается **только** через `buildMenuVariants` из `@/lib/calculator/catalog-mapper` по четырём плоским выборкам (та же функция и те же выборки, что в `loadCatalogForQuote` задачи 11 — коды совпадают с серверным пересчётом):

```ts
import { buildMenuVariants } from "@/lib/calculator/catalog-mapper"

const [categories, items, variants, tiers] = await Promise.all([
  db.select({ id: menuCategories.id, slug: menuCategories.slug, title: menuCategories.title,
              priceGroupId: menuCategories.priceGroupId, sortOrder: menuCategories.sortOrder })
    .from(menuCategories).where(eq(menuCategories.isActive, true)),
  db.select({ id: menuItems.id, code: menuItems.code, name: menuItems.name, categoryId: menuItems.categoryId,
              priceGroupId: menuItems.priceGroupId, sortOrder: menuItems.sortOrder })
    .from(menuItems).where(eq(menuItems.isActive, true)),
  db.select({ code: menuItemVariants.code, itemId: menuItemVariants.itemId, label: menuItemVariants.label,
              price: menuItemVariants.price, sortOrder: menuItemVariants.sortOrder })
    .from(menuItemVariants).where(eq(menuItemVariants.isActive, true)),
  db.select({ code: priceGroupTiers.code, groupId: priceGroupTiers.groupId, label: priceGroupTiers.label,
              price: priceGroupTiers.price, sortOrder: priceGroupTiers.sortOrder })
    .from(priceGroupTiers),
])
const menuVariants = buildMenuVariants({ categories, items, variants, tiers })
```

    Позиции с общей сеткой цен (Teatone, фирменные чаи, лимонады) входят в `menuVariants` — по записи на уровень сетки с кодом `${item.code}-${tier.code}` и `label = tier.label`.

### Code Snippets

```ts
// пример шаблона запроса
import { cacheLife, cacheTag } from "next/cache"
import { and, asc, eq, gte } from "drizzle-orm"
import { db } from "@/lib/db"
import { tournaments } from "@/lib/schema"
import { TAGS } from "@/lib/cache-tags"

/** Вызывать после `await connection()` внутри `<Suspense>`. `opDate` — `getOpDate()` (YYYY-MM-DD). */
export async function getUpcomingTournaments(opDate: string, limit = 5): Promise<PublicTournament[]> {
  "use cache"
  cacheLife("max")
  cacheTag(TAGS.tournaments)
  const rows = await db.select(/* … */).from(tournaments)
    .where(and(eq(tournaments.isPublished, true), gte(tournaments.endDate, opDate)))
    .orderBy(asc(tournaments.startDate), asc(tournaments.endDate)).limit(limit)
  // join cover media через loadMedia(...)
  return rows.map(/* → PublicTournament */)
}
```

Потребитель:

```tsx
async function UpcomingTournaments() {
  await connection()
  const items = await getUpcomingTournaments(getOpDate(), 5)
  …
}
<Suspense fallback={<Skeleton />}><UpcomingTournaments /></Suspense>
```

### Environment Variables

- `NEXT_PUBLIC_SITE_URL` — подстановка `{{site_url}}` в юридических документах.

## Acceptance Criteria

- [ ] Все перечисленные функции существуют с указанными именами, `'use cache'`, `cacheLife('max')`, корректными тегами из `TAGS`; ни одна не читает `headers()/cookies()` и не вычисляет текущую дату внутри себя.
- [ ] `getUpcomingTournaments(opDate, limit)` возвращает только опубликованные турниры с `endDate >= opDate`, отсортированные по `startDate`, не более `limit`; многодневный турнир, начавшийся вчера и заканчивающийся завтра, присутствует.
- [ ] `getSettings()` возвращает полный `SiteSettings` с дефолтами при пустой таблице и значениями из БД при их наличии (проверено с seed задачи 10).
- [ ] `getPriceFrom("common")` = 580, `getPriceFrom("vip")` = 1400 на seed-данных; пенсионные и ночные тарифы не искажают минимум.
- [ ] `getMenuTree()` возвращает дерево категорий с позициями, вариантами и сетками цен (Teatone/Фирменные чаи/Лимонады — через `priceGroup` категории), добавками и «интересными фактами» без N+1 запросов.
- [ ] `getCurrentLegalDocument()` возвращает `{ id; type; version: string; title; text; publishedAt; sha256 } | null` последнего по `publishedAt` документа; в `text` подставлены все 8 плейсхолдеров из таблицы; пустые реквизиты видны как «[не указано]»; больше нигде в проекте подстановка не выполняется.
- [ ] `getCalculatorCatalog()` возвращает значение, совместимое с типом `CalculatorCatalog` (проверяется `tsc`); у залов есть `slug`; `menuVariants` построены через `buildMenuVariants` (у каждой записи `categorySlug`/`categoryName`), позиции с сеткой цен присутствуют с кодами `${item.code}-${tier.code}`.
- [ ] `getUpcomingTournaments` фильтрует по `endDate >= opDate` (операционная дата) — турнир виден до 09:00 дня после окончания.
- [ ] Результаты не содержат `Date`/`bigint`/функций (все значения JSON-сериализуемы), у сущностей с картинками присоединены `PublicMedia` (или `null`).
- [ ] `src/lib/settings-defaults.ts` и `src/lib/cache-tags.ts` не импортируют серверные модули (`db`, `next/*`) и безопасны для клиентских компонентов.
- [ ] `next build` проходит без БД (запросы вызываются только потребителями внутри Suspense — в этой задаче сами запросы никуда не подключаются).
- [ ] `pnpm lint` и `pnpm typecheck` проходят.

## Notes

- Теги и инвалидация: админка вызывает `updateTag(TAGS.x)` в Server Actions и `revalidateTag(tag, 'max')` в route handlers. Правка alt у медиа затрагивает все кэши с картинками — админка (задача 14) сбрасывает `galleries`, `tournaments`, `promotions`, `menu`, `sets`, `services`, `blog`.
- Кэш `'use cache'` — в памяти процесса; приложение работает в одной реплике.
- `getTournamentYears` добавлена сверх контракта `contracts.md` (нужна странице `/tournaments` для архива); `getPriceFrom` возвращает число (₽/час).
