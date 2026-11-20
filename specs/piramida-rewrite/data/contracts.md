# Межзадачные контракты (единый источник имён)

Все task-файлы ссылаются на имена отсюда. Если задача меняет контракт, правится этот файл. При расхождении task-файла с этим документом прав этот документ.

## env (задача 01, `src/lib/env.ts`, zod)

| Где задаётся | Переменные |
|---|---|
| Сервер | `POSTGRES_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `UPLOAD_DIR` (по умолчанию `./.data/uploads` в dev и `/data/uploads` в prod), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `LEADS_EMAIL_TO`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET` |
| Build args (публичные) | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_YM_ID` |

- `NEXT_PUBLIC_APP_URL` стартера **не используется**: задача 01 заменяет его на `NEXT_PUBLIC_SITE_URL` везде (`env.example`, `src/lib/env.ts`, `src/lib/auth-client.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`, `README.md`; файлы диагностики стартера удаляются).
- SMTP и Telegram необязательны: если не заданы, уведомление пропускается и пишется `console.warn`.

## Пакеты и конфиг (задача 01)

- Новые зависимости после задачи 01 не ставятся. В числе прочих задача 01 ставит `react-qr-code` (QR для 2FA, задача 19).
- `package.json` scripts (обязательно ровно такие имена и команды; задачи 08/10/15 вызывают их без «запасных» вариантов):
  - `"seed": "tsx --env-file=.env scripts/seed.ts"`
  - `"seed:admin": "tsx --env-file=.env scripts/seed-admin.ts"`
  - `"import:images": "tsx --env-file=.env scripts/import-legacy-images.ts"`
  - а также `test` (`vitest run`), `test:e2e` (Playwright), `build:migrate` (esbuild-бандл `scripts/migrate.ts` → `dist/migrate.cjs`).
- `next.config.ts`: `outputFileTracingIncludes: { '/*': ['node_modules/sharp/**/*', 'src/assets/fonts/**/*'] }`.
- CSP: `frame-src` разрешает `https://yandex.ru https://*.yandex.ru https://vk.com https://vk.ru https://vkvideo.ru https://rutube.ru`; `script-src`, `connect-src`, `img-src` разрешают `https://mc.yandex.ru https://mc.yandex.com https://yastatic.net`.

## Root layout и шрифты (задача 02)

- `src/app/layout.tsx` содержит **только** `<html lang="ru"><body className={<класс шрифта Onest>}>{children}<Toaster /></body></html>` (+ `metadata`/`viewport`). Никаких Header/Footer/`<main>`.
- `<main id="main-content">` живёт в `src/app/(site)/layout.tsx` (задача 13). Админка имеет свой layout `src/app/(admin)/admin/layout.tsx` (задача 14) со своим `<main>`.
- Статические шрифты для OG (`next/og`, Satori не умеет variable и woff2) — ровно 4 файла:
  `src/assets/fonts/onest-cyrillic-400-normal.woff`, `src/assets/fonts/onest-latin-400-normal.woff`, `src/assets/fonts/onest-cyrillic-700-normal.woff`, `src/assets/fonts/onest-latin-700-normal.woff`.
  В `ImageResponse` передаются как 4 шрифта одного семейства `Onest` (weight 400/700).

## Схема (задача 03, `src/lib/schema/*.ts`, реэкспорт из `src/lib/schema/index.ts`; `db` — из `src/lib/db.ts`)

Каждый файл схемы и его таблицы (Drizzle-имена в camelCase, SQL-имена в snake_case):

| Файл | Таблицы |
|---|---|
| `auth.ts` | `user` (+ `role`, `banned`, `banReason`, `banExpires`, `twoFactorEnabled`), `session` (+ `impersonatedBy`), `account`, `verification`, `twoFactor`, `rateLimit` |
| `club.ts` | `tournamentSeries`, `tournaments`, `promotions`, `services`, `galleries`, `galleryItems` |
| `pricing.ts` | `halls`, `rentalTariffs`, `extraServices`, `penaltyItems` |
| `menu.ts` | `menuCategories`, `priceGroups`, `priceGroupTiers`, `menuItems`, `menuItemVariants`, `menuModifiers`, `banquetSets`, `banquetSetItems` |
| `leads.ts` | `leads`, `legalDocuments` |
| `media.ts` | `mediaAssets` |
| `content.ts` | `authors`, `rubrics`, `blogTags`, `articleTags`, `articles`, `redirects` |
| `settings.ts` | `siteSettings`, `auditLog` |

### Enum'ы
| Enum | Значения |
|---|---|
| `discipline` | `free_pyramid`, `combined_pyramid`, `dynamic_pyramid`, `moscow_pyramid`, `free_pyramid_continuation`, `pool`, `other` |
| `tournament_level` | `regional_championship`, `regional_youth`, `club`, `other` |
| `hall_kind` | `common`, `vip` |
| `price_unit` | `per_hour`, `fixed`, `per_session` |
| `tariff_audience` | `all`, `pensioner` |
| `promotion_target` | `table_rental`, `menu_category`, `takeaway`, `other` |
| `measure_unit` | `g`, `ml`, `l`, `pcs` |
| `set_pricing_mode` | `per_person`, `fixed` |
| `penalty_kind` | `dishware`, `property` |
| `lead_type` | `callback`, `booking`, `promo`, `calculator`, `tournament` |
| `lead_status` | `new`, `in_progress`, `done`, `spam` |
| `callback_window` | `now`, `hour`, `day`, `week` |
| `article_status` | `draft`, `scheduled`, `published` |
| `legal_doc_type` | `policy`, `consent` |

### Ключевые поля
- `rentalTariffs`: `hallId`, `daysOfWeek smallint[]` (0 = вс … 6 = сб; день — это день операционных суток D), `startMin`, `endMin` (минуты от 09:00 операционных суток, 0..1440, `end > start`), `price`, `priceUnit`, `audience`, `label`, `validFrom?`, `validTo?`, `isActive`, `sortOrder`.
- `halls`: `name`, `slug`, `kind`, `tablesCount`, `seatsPerTable` (по умолчанию 4), `description?`, `sortOrder`, `isActive`.
- `promotions`: `title`, `slug`, `shortText`, `description`, `coverMediaId?`, `discountPercent?`, `daysOfWeek smallint[]?`, `startMin?`, `endMin?`, `target`, `targetMenuCategoryId?`, `audienceNote?`, `validFrom?`, `validTo?`, `showInCarousel`, `isActive`, `sortOrder`.
- `tournaments`: `title`, `slug`, `seriesId?`, `stageNumber?`, `discipline?`, `level`, `categories text[]`, `startDate date`, `endDate date`, `entryFee?`, `prizeFund?`, `description?`, `coverMediaId?`, `registrationOpen`, `isPublished`. Индекс по `endDate`.
- **Коды (nanoid из 6 символов, алфавит `0-9a-z`, `varchar(8)` unique):** `menuItems.code`, `menuItemVariants.code`, `banquetSets.code`, `priceGroupTiers.code`. Генерируются `nanoCode()` (задача 06) в seed (задача 10) и в админке (задачи 17–18).
- `priceGroups`: `name`, `description?`, `sortOrder`. `priceGroupTiers`: `groupId`, `code`, `label` («Чайник 600 мл»), `amount?`, `unit?`, `price`, `sortOrder`.
- `menuCategories`: `parentId?`, `title`, `slug`, `description?`, `funFactTitle?`, `funFactText?`, `priceGroupId?`, `sortOrder`, `isActive`. `menuItems`: `code`, `categoryId`, `name`, `description?`, `choiceNote?`, `originCountry?`, `priceGroupId?`, `imageMediaId?`, `isTakeawayDiscount`, `sortOrder`, `isActive`. Позиция имеет либо собственные варианты (`menuItemVariants`: `code`, `itemId`, `label?`, `amount?`, `unit?`, `price`, `sortOrder`, `isActive`), либо сетку цен: `menuItems.priceGroupId ?? menuCategories.priceGroupId`.
- `services`: `key` (`russian | american | vip | training`), `title`, `subtitle?` (описание — второй строкой, рендер `whitespace-pre-line`; колонки `description` нет), `bullets text[]`, `priceFrom?`, `priceFromHallKind?`, `priceNote?`, `ctaBlock` (→ `block` попапа / `leads.sourceBlock`), `ctaType` (`booking | callback`, default `booking`; → `kind` у `LeadDialogTrigger`), `galleryKey?` (text → `galleries.key`), `sortOrder`, `isActive`.
- `galleries`: `key text` **unique (не enum)**, `title`. `galleryItems`: `galleryId`, `mediaId`, `caption?`, `variant` (`'default' | 'mobile'`), `sortOrder`.
  Ключи галерей, которые создаёт seed (задача 10): `hero`, `service_russian`, `service_pool`, `service_vip`, `service_training`, `bar`, `about`, `cta`. Админка (задача 19) может создавать и другие ключи, но код сайта опирается только на эти.
- `leads`:
  - `number integer generated always as identity` (unique);
  - `type`, `status`, `sourceBlock`, `formTitle`, `pageUrl`, `name?`, `phone?`, `callbackWindow?`;
  - `preferredDate? date`, `preferredTime? varchar(5)`, `guests?`, `comment?`;
  - `promotionId?`, `tournamentId?`;
  - `quoteSnapshot jsonb?`, `quoteTotal?`;
  - `consentDocumentId`, `consentAt`, `ipHash char(64)` **nullable** (cron обезличивания ставит `null`), `userAgent`, `notifyStatus jsonb`, `anonymizedAt?`.
- `legalDocuments`: `type` (`legal_doc_type`), `version varchar(32)`, `title text` (default `''`), `body text` (markdown, **с плейсхолдерами**), `sha256 char(64)`, `publishedAt timestamptz` **nullable** (`null` = черновик, задача 19), `createdAt`. Уникальность `(type, version)`; текущий документ — последний по `publishedAt` среди `publishedAt IS NOT NULL`. Опубликованные версии неизменяемы (на них ссылается `leads.consentDocumentId`).
- `mediaAssets`: `path` (относительно `UPLOAD_DIR`, например `2026/11/<uuid>`), `originalName`, `mime`, `width`, `height`, `size`, `blurDataUrl`, `variants jsonb` (`{ w: number; format: 'avif'|'webp'; file: string }[]`), `alt`, `folder`, `createdBy?`.
- FK на `mediaAssets` — `onDelete: 'restrict'`.
- `siteSettings`: `key` text PK, `value jsonb`, `updatedAt`.
- `auditLog`: `userId?`, `action`, `entity`, `entityId`, `diff jsonb`, `createdAt`.

### Блог (`content.ts`) — точные колонки
- `authors`: `id`, `slug`, `name`, `photoMediaId?`, `roleInClub?`, `rank?`, `bio?` (markdown), `sameAs jsonb string[]` (default `[]`), `sortOrder`, `isActive`, `createdAt`, `updatedAt`.
- `rubrics`: `id`, `slug`, `name`, `description?`, `imageMediaId?`, `sortOrder`, `createdAt`, `updatedAt`.
- `blogTags`: `id`, `slug`, `name`, `createdAt`.
- `articleTags`: `articleId`, `tagId` (составной PK, `cascade`).
- `articles`: `id`, `slug`, `title`, `excerpt` (default `''`), `body` (markdown, default `''`), `coverMediaId?`, `authorId?`, `rubricId?`, `isFeatured`, `showToc`, `status` (`article_status`), `publishedAt?` (timestamptz), `readingMinutes`, `seoTitle?`, `seoDescription?`, `noindex`, `createdAt`, `updatedAt`. Публичная выдача: `status in ('published','scheduled') and publishedAt <= now`.
- `redirects`: `id`, `fromPath` (unique), `toPath`, `code smallint` (301/302/307/308, default 301), `createdAt`.

## Утилиты (задача 06)
- `src/lib/dates.ts`:
  - `TZ = 'Asia/Yekaterinburg'`;
  - `getOpDate(now?: Date): string` — `YYYY-MM-DD` операционных суток: до 09:00 считается предыдущий день;
  - `getToday(now?): string` — календарная дата в TZ;
  - `formatEventDate(start: string, end?: string|null): string` — «5 марта», «5–7 марта», «30 марта – 2 апреля»;
  - `minToClock(min: number): string` — 0 → «09:00», 960 → «01:00»;
  - `clockToMin(hhmm: string): number`;
  - `parseLocalDateTime(value: string): Date` — `datetime-local` в TZ.
- `src/lib/slug.ts`: `slugify(text)` с транслитерацией кириллицы, `nanoCode()` — 6 символов.
- `src/lib/request-ip.ts`: `getClientIp(headers)` (берёт `x-real-ip`, fallback — последний элемент `x-forwarded-for`), `hashIp(ip)` (sha256 с `BETTER_AUTH_SECRET`).
- `src/lib/seo/jsonld.ts`: `jsonLdScript(obj)`, `localBusinessJsonLd(input: LocalBusinessInput)`, `sportsEventJsonLd(t)`, `articleJsonLd(a)`, `breadcrumbJsonLd(items)`. Маппинг `SiteSettings` → `LocalBusinessInput` делает задача 23.
- `src/lib/rate-limit.ts`: `rateLimit(key, { limit, windowMs })` — in-memory LRU, возвращает `{ ok, retryAfter }`.

## Уведомления (задача 07)
- `src/lib/notify/email.ts`: `sendEmail({ to?, subject, html, text }) → Promise<{ ok: boolean; error?: string }>`.
- `src/lib/notify/telegram.ts`: `sendTelegram(html: string) → Promise<{ ok, error? }>`, `escapeHtml(s)`.
- `src/lib/notify/lead-templates.ts`: `leadEmail(lead)`, `leadTelegram(lead, { includePii: boolean })`. Ссылка в админку: `${NEXT_PUBLIC_SITE_URL}/admin/leads/${id}`.

## Auth (задача 08, `src/lib/session.ts`)
- `getSession()` — сессия или `null`.
- `requireAdmin()` — **только для страниц и layout'ов** админки: без сессии админа делает `redirect('/login')`; возвращает сессию.
- `requireAdminAction()` — **для Server Actions и route handlers**: без сессии админа бросает `Error('UNAUTHORIZED')`; возвращает сессию.
- Server Actions админки оборачиваются в `adminAction` (задача 14), который ловит `UNAUTHORIZED` и возвращает `{ ok: false, error: 'Нет доступа' }`.
- Route handlers `/api/admin/*`: `try { session = await requireAdminAction() } catch { return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 }) }`.
- Маршруты: `/login`, `/forgot-password`, `/reset-password`. `proxy.ts` — matcher `['/admin/:path*']`, оптимистичный редирект по cookie.

## Медиа (задача 09)
- `src/lib/media/storage.ts`: `saveImage(file: File | Buffer, opts: { folder: string; alt?: string; userId?: string; originalName?: string }) → Promise<MediaAsset>` (`originalName` обязателен по смыслу для `Buffer`, для `File` по умолчанию `file.name`), `deleteMedia(id)` (проверяет использование), `resolveMediaPath(rel)` (защита от traversal).
- Варианты: ширины `[640, 1280, 1920]` (не больше исходной), форматы `avif` (quality 55) и `webp` (quality 75), файлы `<uuid>-<w>.<fmt>`, blur — webp шириной 16 в base64.
- `src/lib/media/url.ts`: `mediaUrl(asset, w?, fmt?)` → `/media/<path>-<w>.<fmt>`.
- `src/components/media/picture.tsx`: `<Picture asset sizes alt priority className />` — рендерит `<picture>` с srcset для avif и webp.
- Маршрут `GET /media/[...path]`.
- Медиатека и загрузка — задача 14: `POST/GET /api/admin/media` (multipart, `requireAdminAction` → 401), страница `/admin/media`, компоненты `image-upload-field.tsx` и `media-picker.tsx`. Другие задачи (в т. ч. 26) свои маршруты загрузки не создают.

## Кэш-теги и публичные запросы (задача 12)
- `src/lib/cache-tags.ts`: `TAGS = { tournaments, pricing, promotions, menu, sets, galleries, services, settings, blog, legal } as const`, `articleTag(slug)`.
- `src/lib/queries/*.ts`, все функции `'use cache'` + `cacheLife('max')` + `cacheTag`:

| Файл | Функции |
|---|---|
| `settings.ts` | `getSettings(): Promise<SiteSettings>` (типизированный объект с дефолтами из `src/lib/settings-defaults.ts`) |
| `tournaments.ts` | `getUpcomingTournaments(opDate, limit=5)`, `getSeasonTournaments(year)`, `getTournamentSeries()`, `getTournamentYears()` |
| `pricing.ts` | `getHalls()`, `getTariffs()`, `getExtraServices()`, `getPenalties()`, `getPriceFrom(hallKind)` |
| `promotions.ts` | `getActivePromotions(opDate)`, `getCarouselPromotions(opDate)` |
| `menu.ts` | `getMenuTree()` (категории → позиции → варианты/сетки), `getBanquetSets()` |
| `galleries.ts` | `getGallery(key)`, `getServices()` |
| `legal.ts` | `getCurrentLegalDocument(type)` |
| `calculator.ts` | `getCalculatorCatalog(): Promise<CalculatorCatalog>` (тип из задачи 05, маппинг через `buildMenuVariants`) |

- `getUpcomingTournaments(opDate)` фильтрует `isPublished AND endDate >= opDate`, где `opDate = getOpDate()` (операционная дата, до 09:00 — вчера). **Это намеренно:** турнир остаётся в списке до 09:00 следующего дня после `endDate`.
- Блог (задача 25) пишет только `src/lib/queries/blog.ts`.

### `SiteSettings` (задача 12, `src/lib/settings-defaults.ts`) — канонический список ключей

Каждый ключ — отдельная строка `siteSettings` (`key` = имя поля, `value` = jsonb-значение). Seed (задача 10), форма настроек (задача 19) и все потребители используют **ровно эти** имена; других ключей нет.

```ts
export type SiteSettings = {
  phone: string               // "+7 (900) 068-50-00" — текст для показа
  phoneHref: string           // "tel:+79000685000" — ГОТОВЫЙ href (с префиксом tel:), использовать как href={settings.phoneHref}
  email: string               // "biliyard174@yandex.ru"
  address: string             // "г. Челябинск, Орджоникидзе 58а к3"
  addressNote: string         // "Горсад им. А.С. Пушкина"
  hours: string               // "Ежедневно 09:00–02:00"
  telegramUrl: string         // "https://t.me/bkpiramida"
  vkUrl: string               // "https://vk.ru/piramida.billiard"
  mapConstructorId: string    // значение um= конструктора Яндекс Карт, с префиксом "constructor:"
  mapOrgId: string            // "47911977113" — oid организации в Яндекс Картах
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
```
Также экспортируются `SETTINGS_DEFAULTS: SiteSettings`, `SETTING_KEYS`, `mergeSettings(rows)`. Модуль без серверных импортов (безопасен для клиента).

Не существуют (не использовать): `workingHours`, `mapLat`, `mapLon`, `mapYandexOid`, `mapEmbedUm`, `operatorName`/`operatorInn`/…, `retentionMonths`, `seo`.

### Юридические документы и плейсхолдеры
- Seed (задача 10) пишет тексты `legalDocuments.body` с плейсхолдерами; админка (задача 19) сохраняет новые версии тоже с плейсхолдерами.
- Подстановка выполняется **только** в `getCurrentLegalDocument(type)` (задача 12): возвращает `{ id; type; version; title; text; publishedAt; sha256 } | null`, где `text` — уже с подставленными значениями. Потребители (задачи 13, 23, 11) **не** подставляют повторно.
- Список плейсхолдеров (других нет):

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

Пустое значение подставляется как «[не указано]».

## Калькулятор (задача 05, `src/lib/calculator/`)
- `types.ts`:
  - `CalcHall { id; slug; name; kind; tablesCount; seatsPerTable }`;
  - `CalcMenuVariant { code: string; itemName: string; label: string; price: number; categorySlug: string; categoryName: string }`;
  - `CalculatorCatalog { halls: CalcHall[]; tariffs; extraServices; menuVariants: CalcMenuVariant[]; sets: { code; title; pricingMode; price; minGuests?; maxGuests? }[]; promotions }`;
  - `QuoteInput { opDate: string; startMin: number; durationMin: number; guests: number; hallId: string; tables: number; pensioner: boolean; extras: { id; qty }[]; sets: { code; qty }[]; items: { code; qty }[] }`;
  - `Quote { lines: { kind; label; qty; unitPrice; total }[]; rentalTotal; foodTotal; total; perGuest; warnings: string[]; promoHints: string[] }`.
- `catalog-mapper.ts` (задача 05, чистая функция, без импорта схемы/БД): `buildMenuVariants(rows: MenuVariantSourceRows): CalcMenuVariant[]`. Входные типы определяет задача 05:
  - `categories: { id; slug; title; priceGroupId: string | null; sortOrder }[]` (только активные; позиции неактивной категории в калькулятор не попадают);
  - `items: { id; code; name; categoryId; priceGroupId: string | null; sortOrder }[]` (только активные);
  - `variants: { code; itemId; label: string | null; price; sortOrder }[]` (только активные);
  - `tiers: { code; groupId; label; price; sortOrder }[]`.
  Правила: у позиции есть свои варианты → по записи на вариант, `code = variant.code`, `label = variant.label ?? ''`. Нет вариантов и есть сетка (`item.priceGroupId ?? category.priceGroupId`) → по записи на уровень сетки, `code = \`${item.code}-${tier.code}\``, `label = tier.label`, `price = tier.price`. `categorySlug`/`categoryName` — категория позиции (`menuCategories.slug`/`title`). Порядок — категория, позиция, вариант/уровень по `sortOrder`.
  Используют: `getCalculatorCatalog` (задача 12) и `loadCatalogForQuote` (задача 11) — обе только выбирают плоские строки и передают их в `buildMenuVariants`.
- `calculate.ts`: `calculateQuote(input, catalog): Quote` — чистая функция.
- `url-state.ts` (импорт только из `nuqs/server`; параметры `?d=&t=&h=&g=&hall=&tables=&p=&x=&s=&i=`; `hall` — **slug зала**; `s`/`i` — `code:qty,…`, коды могут содержать `-`):
  - `calculatorParsers` — объект парсеров для `useQueryStates` / `createSerializer` / `createLoader`;
  - `CalculatorUrlState`, `toQuoteInput(state, catalog, todayOpDate): QuoteInput`, `parseKeyQtyList`, `serializeKeyQtyList`;
  - `serializeCalculator(input: Partial<QuoteInput>, catalog?: Pick<CalculatorCatalog, 'halls'>): string` — строка запроса (`?…` или `''`) для ссылки на `/calculator`; `hallId` переводится в slug по `catalog`, без `catalog` параметр `hall` не пишется;
  - `parseCalculatorSearchParams(sp: URLSearchParams | Record<string, string | string[] | undefined>, catalog?: Pick<CalculatorCatalog, 'halls'>): Partial<QuoteInput>` — разбор параметров URL (невалидные отбрасываются); `hallId` заполняется, только если передан `catalog` и slug найден.

## Заявки (задача 11)
- `src/lib/actions/leads.ts`: `submitLead(input: LeadInput) → { ok: true; number } | { ok: false; error; fieldErrors? }`. Для `type === 'calculator'` читает поле `quote` (JSON-строка `QuoteInput`), валидирует zod-схемой, пересчитывает расчёт по `loadCatalogForQuote()` и пишет `quoteSnapshot`/`quoteTotal`.
- `src/lib/actions/leads-catalog.ts`: `loadCatalogForQuote(): Promise<CalculatorCatalog>` — некэшируемые запросы, `menuVariants` через `buildMenuVariants` (задача 05).
- `src/components/leads/lead-form.tsx`:
  ```ts
  type LeadFormProps = {
    type: LeadType            // 'callback' | 'booking' | 'promo' | 'calculator' | 'tournament'
    block: string             // → leads.sourceBlock
    formTitle: string
    promotionId?: string
    tournamentId?: string
    hidden?: Record<string, string>  // скрытые поля, уходят в payload как есть (калькулятор: { quote: JSON.stringify(quoteInput) })
    submitLabel?: string
    onSuccess?: (number: number) => void
    className?: string
  }
  ```
  Набор видимых полей определяется `type`: `callback` — время звонка + телефон; остальные — имя + телефон.
- `src/components/leads/lead-dialog.tsx`: `<LeadDialogTrigger kind="callback"|"booking"|"promo"|"tournament" block formTitle? promotionId? tournamentId? asChild className?>{button}</LeadDialogTrigger>`. `tournament` — запись на турнир (форма `type="tournament"`, передаёт `tournamentId`).
- `src/components/leads/policy-dialog.tsx`: `PolicyDialog({ title, markdown, children })`.
- `/spasibo`.
- Цели Метрики: `window.ym?.(ID, 'reachGoal', 'lead_submit')` (калькулятор — `calculator_submit`).

## Сайт (задача 13)
- `src/app/(site)/layout.tsx`: Header, `<main id="main-content" className="flex-1">`, Footer, CookieBanner, Metrika.
- `src/components/site/`: `container.tsx` (`<Container>`), `section-title.tsx` (`<SectionTitle>`), `primary-button.tsx` (кнопка с «бликом»), `reveal.tsx` (появление при прокрутке).

## Админка (задача 14)
- `src/app/(admin)/admin/layout.tsx` с sidebar; каждая страница админки первой строкой вызывает `await requireAdmin()`.
- `src/components/admin/`: `data-table.tsx`, `sortable-list.tsx` (dnd-kit + кнопки ↑/↓), `image-upload-field.tsx` (загружает в `POST /api/admin/media`, возвращает `mediaId`), `media-picker.tsx`, `confirm-dialog.tsx`, `form-actions.tsx`, `page-header.tsx`.
- `src/lib/admin/audit.ts`: `audit(userId: string, action: string, entity: string, entityId: string, diff?: unknown, tx?: DbOrTx): Promise<void>`.
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
  Порядок: `requireAdminAction()` (ошибка → `{ ok: false, error: 'Нет доступа' }`) → `schema.safeParse` (ошибка → `fieldErrors`) → `db.transaction(tx => handler(input, { userId, tx }))` → после коммита `updateTag` для каждого тега → `{ ok: true, data }`. `ActionError` → `{ ok: false, error, fieldErrors }`; `redirect()`/`notFound()` пробрасываются (`unstable_rethrow`).
  Аудит пишет **сам handler** в той же транзакции: `await audit(ctx.userId, 'tournament.update', 'tournament', id, diff, ctx.tx)`.
  Пример:
  ```ts
  export const saveTournament = adminAction(tournamentSchema, async (input, ctx) => {
    const [row] = await ctx.tx.insert(tournaments).values(input).returning({ id: tournaments.id })
    await audit(ctx.userId, "tournament.create", "tournament", row!.id, { after: input }, ctx.tx)
    return { id: row!.id }
  }, { tags: [TAGS.tournaments] })
  ```

## Cron
Маршруты `POST /api/cron/retention` (задача 19) и `POST /api/cron/blog` (задача 25). Проверяют заголовок `Authorization: Bearer ${CRON_SECRET}`. Retention обезличивает заявки старше `settings.leadRetentionMonths`: `name`, `phone`, `comment`, `ipHash`, `userAgent`(→ `''`) обнуляются, ставится `anonymizedAt`.

## Статика `public/images/**` (владельцы)
- `public/images/logo.png`, `public/images/logo.webp` (логотип шапки, 125×106), `public/images/tournament-default.webp`, `public/images/work-steps-bg.webp` — задача 15 (wave 4). Шапка (задача 13) ссылается на `/images/logo.png` строкой и файл сама не копирует; задача 02 логотип не копирует.
- `public/images/popup-bg.webp` — задача 11;
- `public/images/home/*` — задача 21 (в т. ч. запасные фото CTA-блока, если галерея `cta` пуста).
- `public/icons/*`, `src/app/favicon.ico`, `src/assets/fonts/*` — задача 02.
