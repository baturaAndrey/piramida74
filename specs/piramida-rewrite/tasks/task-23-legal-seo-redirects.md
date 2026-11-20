# Task 23: Юр. страницы, SEO, редиректы со старого сайта

## Status

complete

## Wave

5

## Description

Задача закрывает юридический и SEO-«периметр» сайта. Страницы `/politika` и `/soglasie` показывают актуальную версию документа из БД (Markdown; реквизиты оператора ПДн уже подставлены в `getCurrentLegalDocument`, задача 12). Динамические `sitemap.xml` и `robots.txt`, helper `buildMetadata`, компонент JSON-LD `LocalBusiness` (его на главную ставит задача 27), 301-редиректы со старых URL PHP-сайта и ответы 410 для старых путей к картинкам (`/public/themes/**`, `/uploads/**`) нужны, чтобы при переключении DNS на `piramida-billiard-74.ru` не потерять индексацию в Яндексе и Google. Задача проверяется без DB-зависимости на этапе `next build`: все чтения БД идут после `await connection()` внутри `<Suspense>` либо в динамических route handlers.

## Dependencies

**Depends on:** task-12-public-queries.md, task-13-site-layout.md (а транзитивно 03, 06, 11)
**Blocks:** task-27-home-assembly.md (использует `LocalBusinessJsonLd` и `buildMetadata`), task-28-qa-verification.md

**Context from dependencies:**
- task-03 создала схему Drizzle (`src/lib/schema/*.ts`, реэкспорт из `src/lib/schema/index.ts`; `db` из `src/lib/db.ts`). Точные колонки:
  - `legalDocuments` (`leads.ts`): `type` (`legal_doc_type = policy | consent`), `version varchar(32)` (строка), `title text`, `body text` (markdown с плейсхолдерами), `sha256 char(64)`, `publishedAt timestamptz`, `createdAt`. Напрямую таблицу эта задача не читает — только через `getCurrentLegalDocument`.
  - `articles` (`content.ts`): `id`, `slug`, `title`, `excerpt`, `body`, `coverMediaId?`, `authorId?`, `rubricId?`, `isFeatured`, `showToc`, `status` (`article_status = draft | scheduled | published`), `publishedAt?` (timestamptz), `readingMinutes`, `seoTitle?`, `seoDescription?`, `noindex`, `createdAt`, `updatedAt`. Публичная выдача: `status in ('published','scheduled') and publishedAt <= now`.
  - `rubrics`: `id`, `slug`, `name`, `description?`, `imageMediaId?`, `sortOrder`, `createdAt`, `updatedAt`.
  - `authors`: `id`, `slug`, `name`, `photoMediaId?`, `roleInClub?`, `rank?`, `bio?`, `sameAs`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`.
  - `blogTags`: `id`, `slug`, `name`, `createdAt` (отдельных страниц тегов нет — в sitemap не входят).
  - `redirects`: `id`, `fromPath` (unique), `toPath`, `code smallint` (301/302/307/308). Таблицу читает блог (задача 25, `findRedirect` при промахе `/blog/[slug]`); `next.config.ts` её **не** читает (на `next build` БД нет) — здесь только статические `legacyRedirects`.
- task-06 дала `src/lib/dates.ts` (`TZ`, `getToday`), `src/lib/seo/jsonld.ts` (`jsonLdScript(obj)`, `localBusinessJsonLd(input: LocalBusinessInput)`, `breadcrumbJsonLd(items)`), где
  `LocalBusinessInput = { name; url; logo?; image?; description?; telephone; email?; priceRange?; address: { street; city; region?; postalCode? }; geo: { lat; lon }; hours: { opens; closes }; sameAs?: string[] }`. Маппинг `SiteSettings → LocalBusinessInput` делает эта задача.
- task-12 дала кэшируемые запросы: `getSettings()` (типизированный `SiteSettings` с дефолтами из `src/lib/settings-defaults.ts`), `getCurrentLegalDocument(type: 'policy' | 'consent')` → `{ id; type; version: string; title: string; text: string; publishedAt: string; sha256: string } | null` (`text` — markdown **с уже подставленными** плейсхолдерами; повторно не подставлять), `getPriceFrom(hallKind)` и теги `TAGS.legal`, `TAGS.settings` в `src/lib/cache-tags.ts`. Все они `'use cache'`, поэтому вызывать их можно только после `await connection()` внутри `<Suspense>`.
  Используемые ключи `SiteSettings` (ровно эти): `phone` («+7 (900) 068-50-00»), `phoneHref` («tel:+79000685000» — готовый href), `email`, `address` («г. Челябинск, Орджоникидзе 58а к3»), `hours` («Ежедневно 09:00–02:00»), `geo: { lat; lon }`, `vkUrl`, `telegramUrl`, `seoDefaults: { title; description; ogImageMediaId }`.
- task-13 дала `src/app/(site)/layout.tsx` (Header/Footer/CookieBanner/Metrika) и компоненты `Container` (`src/components/site/container.tsx`), `SectionTitle` (`src/components/site/section-title.tsx`). Блог (таблицы `articles`, `rubrics`, `authors`) пишет задача 25, но sitemap читает его **напрямую запросом** в `src/lib/seo/sitemap-sources.ts`, а не через `src/lib/queries/blog.ts`.
- `src/lib/env.ts` и `next.config.ts` принадлежат задаче 01. Здесь `next.config.ts` меняется **только** добавлением `redirects()`.

## Files to Create

- `src/app/(site)/politika/page.tsx` — страница политики ПДн.
- `src/app/(site)/soglasie/page.tsx` — страница согласия на обработку ПДн.
- `src/components/legal/legal-document.tsx` — общий серверный компонент: заголовок, версия/дата, Markdown-тело (`doc.text` как есть).
- `src/lib/seo/local-business.ts` — `settingsToLocalBusinessInput(settings, siteUrl)` и `parseHours(hours)` (чистые функции).
- `src/lib/seo/local-business.test.ts` — Vitest.
- `src/lib/seo/metadata.ts` — `absoluteUrl`, `SITE_NAME`, `buildMetadata`.
- `src/lib/seo/metadata.test.ts` — Vitest.
- `src/lib/seo/sitemap-sources.ts` — лёгкие прямые запросы для sitemap (блог).
- `src/lib/seo/legacy-redirects.ts` — константа со списком редиректов (без алиасов `@/`, импортируется из `next.config.ts`) + Vitest `src/lib/seo/legacy-redirects.test.ts`.
- `src/app/sitemap.ts` — динамический sitemap (перезаписывает файл стартера).
- `src/app/robots.ts` — robots.txt (перезаписывает файл стартера).
- `src/components/seo/local-business-jsonld.tsx` — JSON-LD `SportsActivityLocation`/`LocalBusiness`.
- `src/app/public/[...path]/route.ts` — ответ 410 для `/public/**` (старые ассеты).
- `src/app/uploads/[...path]/route.ts` — ответ 410 для `/uploads/**` (старые загрузки WP-стиля).

Файл `public/yandex_b2d6db0830b1e9ce.html` (подтверждение Яндекс Вебмастера) создаёт задача 02; эта задача его не создаёт, только проверяет доступность.

## Files to Modify

- `next.config.ts` — добавить **только** `async redirects()` (разрешено таблицей владения: владелец файла — задача 01, задача 23 — только `redirects()`). Остальное (headers, images, output, cacheComponents, `outputFileTracingIncludes`) не трогать.

## Technical Details

### Implementation Steps

1. **Прочитать схему и настройки.** Открыть `src/lib/schema/content.ts`, `src/lib/settings-defaults.ts` (тип `SiteSettings`), `src/lib/queries/legal.ts`. Имена колонок блога и ключи `SiteSettings` зафиксированы контрактом (см. Context выше) и используются в сниппетах ниже как есть.

2. **`src/lib/seo/metadata.ts`** (чистый модуль, без обращений к БД):

```ts
import type { Metadata } from 'next'

export const SITE_NAME = 'Бильярдный клуб «Пирамида»'
export const DEFAULT_DESCRIPTION =
  'Бильярдный клуб «Пирамида» в Челябинске: русская пирамида, американский пул, VIP-комнаты, авторская кухня. Ежедневно 09:00–02:00.'

/** Базовый URL без завершающего слэша. NEXT_PUBLIC_* вшивается при сборке. */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
}

export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//.test(path)) return path
  return `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

export interface BuildMetadataInput {
  title: string | { absolute: string }
  description?: string
  path: string // например '/menu'
  image?: string // путь или абсолютный URL, 1200x630 желательно
  noindex?: boolean
  type?: 'website' | 'article'
}

export function buildMetadata({ title, description = DEFAULT_DESCRIPTION, path, image, noindex, type = 'website' }: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path)
  const titleText = typeof title === 'string' ? title : title.absolute
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      locale: 'ru_RU',
      title: titleText,
      description,
      ...(image ? { images: [{ url: absoluteUrl(image) }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: titleText,
      description,
      ...(image ? { images: [absoluteUrl(image)] } : {}),
    },
  }
}
```

   `metadataBase` ставит корневой `layout.tsx` (задача 02); helper всё равно строит абсолютные URL сам. Если у страницы нет своего изображения, `image` не задавать (дефолтный OG — файл `opengraph-image` корневого сегмента, если он есть).

3. **`src/lib/seo/local-business.ts`** — маппинг `SiteSettings` → `LocalBusinessInput` (чистые функции, без БД). Плейсхолдеры юр. документов здесь **не** обрабатываются: подстановка выполняется только в `getCurrentLegalDocument` (задача 12).

```ts
import type { SiteSettings } from '@/lib/settings-defaults'
import type { LocalBusinessInput } from '@/lib/seo/jsonld'

/** "Ежедневно 09:00–02:00" → { opens: "09:00", closes: "02:00" }; разделитель – — или -. Не распознано → 09:00–02:00. */
export function parseHours(hours: string): { opens: string; closes: string } {
  const m = hours.match(/(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/)
  const pad = (t: string) => t.padStart(5, '0')
  return m ? { opens: pad(m[1]), closes: pad(m[2]) } : { opens: '09:00', closes: '02:00' }
}

/** "г. Челябинск, Орджоникидзе 58а к3" → { city: "Челябинск", street: "Орджоникидзе 58а к3" } */
function splitAddress(address: string): { city: string; street: string } {
  const [first, ...rest] = address.split(',')
  if (!rest.length) return { city: 'Челябинск', street: address.trim() }
  return { city: first.replace(/^г\.\s*/, '').trim(), street: rest.join(',').trim() }
}

export function settingsToLocalBusinessInput(s: SiteSettings, siteUrl: string): LocalBusinessInput {
  const telephone = s.phoneHref.replace(/^tel:/, '') || s.phone
  return {
    name: 'Бильярдный клуб «Пирамида»',
    url: siteUrl,                                  // NEXT_PUBLIC_SITE_URL без завершающего слэша
    logo: `${siteUrl}/images/logo.png`,
    telephone,                                     // "+79000685000"
    ...(s.email ? { email: s.email } : {}),
    address: { ...splitAddress(s.address), region: 'Челябинская область' },
    geo: { lat: s.geo.lat, lon: s.geo.lon },
    hours: parseHours(s.hours),
    sameAs: [s.vkUrl, s.telegramUrl].filter(Boolean),
  }
}
```

   Тест (`local-business.test.ts`): `parseHours('Ежедневно 09:00–02:00')` → `{ opens: '09:00', closes: '02:00' }`; дефис и `9:00` тоже распознаются; мусор → дефолт; `settingsToLocalBusinessInput(SETTINGS_DEFAULTS, 'https://x.ru')` даёт `telephone` без `tel:`, город «Челябинск», `sameAs` из `vkUrl`/`telegramUrl` без пустых.

4. **`src/components/legal/legal-document.tsx`** — серверный компонент. Принимает `{ title: string; version: string; publishedAt: Date | string; markdown: string }`:
   - `<Container>` + `max-w-3xl mx-auto`, `py-8` (DESIGN.md: стандартная страница), `<h1>` (токены H1/H2 из DESIGN.md, не хардкодить размеры) и строка `Версия {version} от {дата}` (`text-sm text-muted-foreground`; дата — `Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: TZ })`, `TZ` из `src/lib/dates.ts`).
   - Тело: `react-markdown` + `remark-gfm` (оба установлены задачей 01), **без `rehype-raw`** (HTML в тексте экранируется). Свой небольшой `components`-map: `h2/h3` (`mt-8 mb-3 text-foreground font-semibold`, `scroll-mt-24`), `p` (`mb-4 leading-7`), `ul/ol/li`, `a` (`text-primary underline underline-offset-2`, внешние — `target="_blank" rel="noopener noreferrer"`), `strong`, `table`. Не импортировать компоненты блога (задача 25 в той же волне).
   - Цвета только через токены DESIGN.md (`text-foreground`, `text-muted-foreground`, `text-primary`, `bg-card`, `border`).

5. **Страницы `politika/page.tsx` и `soglasie/page.tsx`** (структура одинаковая, различаются тип документа и метаданные):

```tsx
import { Suspense } from 'react'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { LegalDocument } from '@/components/legal/legal-document'
import { buildMetadata } from '@/lib/seo/metadata'
import { getCurrentLegalDocument } from '@/lib/queries/legal'

export const metadata = buildMetadata({
  title: 'Политика обработки персональных данных',
  description: 'Как клуб «Пирамида» обрабатывает и защищает персональные данные посетителей сайта.',
  path: '/politika',
})

export default function PolitikaPage() {
  return (
    <Suspense fallback={<LegalSkeleton />}>
      <PolitikaContent />
    </Suspense>
  )
}

async function PolitikaContent() {
  await connection()
  const doc = await getCurrentLegalDocument('policy')
  if (!doc) notFound()
  // doc.text уже содержит подставленные реквизиты (задача 12) — выводится как есть, без повторной подстановки.
  return <LegalDocument title={doc.title || 'Политика обработки персональных данных'} version={doc.version} publishedAt={doc.publishedAt} markdown={doc.text} />
}
```

   Поля документа: `{ id; type; version: string; title; text; publishedAt: string; sha256 }`. `LegalSkeleton` — локальный скелетон из нескольких `animate-pulse` блоков (`bg-muted rounded-md`). `soglasie` аналогично с `'consent'`, заголовок «Согласие на обработку персональных данных», `path: '/soglasie'`. Метаданные статические (без БД), поэтому `generateMetadata` не нужен. Обе страницы индексируются (в sitemap попадают).

6. **`src/lib/seo/sitemap-sources.ts`** — прямые запросы без `'use cache'` (sitemap запрашивается редко; инвалидация тегами не нужна). Условие публикации — по контракту (как в задаче 25): `status in ('published','scheduled') AND publishedAt <= now`, плюс `noindex = false`. Авторы — только `isActive`. Теги (`blogTags.slug`) в sitemap не входят: отдельных страниц тегов нет.

```ts
import { and, eq, inArray, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articles, rubrics, authors } from '@/lib/schema'

export interface BlogSitemapEntries {
  articles: { slug: string; updatedAt: Date }[]
  rubrics: { slug: string; updatedAt: Date }[]
  authors: { slug: string; updatedAt: Date }[]
}

export async function getBlogSitemapEntries(now: Date): Promise<BlogSitemapEntries> {
  const visible = and(
    inArray(articles.status, ['published', 'scheduled']),
    lte(articles.publishedAt, now),
    eq(articles.noindex, false),
  )
  const [articleRows, rubricRows, authorRows] = await Promise.all([
    db.select({ slug: articles.slug, updatedAt: articles.updatedAt }).from(articles).where(visible),
    // Только рубрики и активные авторы, у которых есть хотя бы одна индексируемая опубликованная статья.
    db.selectDistinct({ slug: rubrics.slug, updatedAt: rubrics.updatedAt }).from(rubrics).innerJoin(articles, eq(articles.rubricId, rubrics.id)).where(visible),
    db.selectDistinct({ slug: authors.slug, updatedAt: authors.updatedAt }).from(authors).innerJoin(articles, eq(articles.authorId, authors.id)).where(and(visible, eq(authors.isActive, true))),
  ])
  return { articles: articleRows, rubrics: rubricRows, authors: authorRows }
}
```

7. **`src/app/sitemap.ts`** — динамический (`connection()` первым действием, чтобы `next build` не обращался к БД):

```ts
import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { absoluteUrl } from '@/lib/seo/metadata'
import { getBlogSitemapEntries } from '@/lib/seo/sitemap-sources'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const now = new Date()
  const staticPaths: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/tournaments', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/menu', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/prices', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/calculator', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/blog', priority: 0.7, changeFrequency: 'daily' },
    { path: '/politika', priority: 0.2, changeFrequency: 'monthly' },
    { path: '/soglasie', priority: 0.2, changeFrequency: 'monthly' },
  ]
  const blog = await getBlogSitemapEntries(now)
  return [
    ...staticPaths.map((p) => ({ url: absoluteUrl(p.path), changeFrequency: p.changeFrequency, priority: p.priority })),
    ...blog.rubrics.map((r) => ({ url: absoluteUrl(`/blog/${r.slug}`), lastModified: r.updatedAt, changeFrequency: 'weekly' as const, priority: 0.5 })),
    ...blog.articles.map((a) => ({ url: absoluteUrl(`/blog/${a.slug}`), lastModified: a.updatedAt, changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...blog.authors.map((a) => ({ url: absoluteUrl(`/authors/${a.slug}`), lastModified: a.updatedAt, changeFrequency: 'monthly' as const, priority: 0.4 })),
  ]
}
```

   Не включать: `/spasibo`, `/admin/**`, `/login`, `/forgot-password`, `/reset-password`, `/blog/preview/**`, `/blog/rss.xml`, статьи с `noindex`. Без `try/catch -> []`: ошибка БД должна давать 500, а не пустую карту в кэше поисковика.

8. **`src/app/robots.ts`**:

```ts
import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo/metadata'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/login', '/forgot-password', '/reset-password', '/api/', '/spasibo', '/blog/preview/'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
```

   `/media/` и `/_next/static` не закрывать (картинки должны индексироваться и рендериться ботами).

9. **`src/components/seo/local-business-jsonld.tsx`** — async серверный компонент. Строит `LocalBusinessInput` через `settingsToLocalBusinessInput` (шаг 3), передаёт в `localBusinessJsonLd(input)` из task 06 и дополняет `priceRange`:

```tsx
import { connection } from 'next/server'
import { getSettings } from '@/lib/queries/settings'
import { getPriceFrom } from '@/lib/queries/pricing'
import { jsonLdScript, localBusinessJsonLd } from '@/lib/seo/jsonld'
import { settingsToLocalBusinessInput } from '@/lib/seo/local-business'
import { getSiteUrl } from '@/lib/seo/metadata'

/** Рендерить внутри <Suspense fallback={null}>. Сам делает connection(), поэтому безопасен для next build без БД. */
export async function LocalBusinessJsonLd() {
  await connection()
  const [settings, priceFrom] = await Promise.all([getSettings(), getPriceFrom('common')])
  const input = settingsToLocalBusinessInput(settings, getSiteUrl())
  const data = localBusinessJsonLd({
    ...input,
    ...(priceFrom ? { priceRange: `от ${priceFrom} ₽/час` } : {}),
  })
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
}
```

   Ожидаемый результат на дефолтных настройках: `@type` `SportsActivityLocation` (как отдаёт task 06), `name`, `url` = `NEXT_PUBLIC_SITE_URL`, адрес Челябинск, Орджоникидзе 58а к3 (из `settings.address`), часы ежедневно 09:00–02:00 (`openingHoursSpecification` из `parseHours(settings.hours)`, закрытие после полуночи — `closes: '02:00'`), `geo` 55.153739 / 61.404441 (`settings.geo.lat/lon`), `telephone` `+79000685000` (`settings.phoneHref` без `tel:`), `email`, `sameAs` `[settings.vkUrl, settings.telegramUrl]` (`https://vk.ru/piramida.billiard`, `https://t.me/bkpiramida`). Если `getPriceFrom` возвращает иной тип (число/объект), адаптировать. Значения брать из настроек, не хардкодить в компоненте.

10. **Редиректы (`src/lib/seo/legacy-redirects.ts`)** — отдельная константа, чтобы её можно было тестировать и импортировать из `next.config.ts` (в этом файле **нельзя** использовать алиас `@/`):

```ts
export const legacyRedirects = [
  { source: '/index.php', destination: '/', statusCode: 301 as const },
  { source: '/index.html', destination: '/', statusCode: 301 as const },
  { source: '/politika/politika.html', destination: '/politika', statusCode: 301 as const },
  { source: '/politika/politika-content.html', destination: '/politika', statusCode: 301 as const },
  { source: '/politika/index.php', destination: '/politika', statusCode: 301 as const },
  { source: '/politika/index.html', destination: '/politika', statusCode: 301 as const },
  { source: '/spasibo/index.php', destination: '/spasibo', statusCode: 301 as const },
] satisfies { source: string; destination: string; statusCode: 301 }[]
```

   Слэш на конце (`/politika/`, `/spasibo/`) Next.js убирает сам редиректом 308 (`trailingSlash: false` по умолчанию) — отдельные правила не нужны, но это **проверить `curl -I`** (должен быть редирект на `/politika` и `/spasibo`). Если Next отдаёт 308, а не 301, для Яндекса это тоже «постоянный» редирект, оставить.
   
   В `next.config.ts`:

```ts
import { legacyRedirects } from './src/lib/seo/legacy-redirects'
// ...внутри nextConfig:
async redirects() {
  const rules = [...legacyRedirects]
  // www -> apex как вторая линия обороны (основной редирект — Traefik/Dokploy).
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (site) {
    const host = new URL(site).host
    if (!host.startsWith('www.') && !host.startsWith('localhost')) {
      rules.push({
        source: '/:path*',
        has: [{ type: 'host', value: `www.${host}` }],
        destination: `${site.replace(/\/+$/, '')}/:path*`,
        statusCode: 301,
      } as never)
    }
  }
  return rules
}
```

   Типизировать корректно (без `as never`: описать тип `Redirect` из `next/dist/lib/load-custom-routes` не нужно — достаточно объявить массив как `Redirect[]` через `NextConfig['redirects']` return type: `type R = Awaited<ReturnType<NonNullable<NextConfig['redirects']>>>[number]`). Не трогать другие блоки `next.config.ts`. Примечание для владельца (в Notes): редирект www → apex на уровне Traefik/Dokploy остаётся основным.

11. **Ответы 410 для старых путей.** Два route handlers (одинаковое содержимое):

```ts
// src/app/public/[...path]/route.ts  и  src/app/uploads/[...path]/route.ts
const gone = () =>
  new Response('Gone', {
    status: 410,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'X-Robots-Tag': 'noindex',
    },
  })

export const GET = gone
export const HEAD = gone
```

   Дополнительно экспортировать `POST`/`PUT`/`DELETE` не нужно. `/public/` как сегмент URL не пересекается с папкой `public/` Next.js (она отдаётся с корня). Проверить, что `/uploads/2024/10/bg.webp` и `/public/themes/piramida/assets/img/logo.png` дают 410, а `/media/...` продолжает работать (задача 09).

12. **Файл Вебмастера** `public/yandex_b2d6db0830b1e9ce.html` создаёт задача 02 (владелец). Здесь — только проверить, что он отдаётся по `/yandex_b2d6db0830b1e9ce.html` и не перехвачен маршрутами/редиректами этой задачи.

13. **Тесты (Vitest):** `local-business.test.ts` (см. шаг 3), `metadata.test.ts` (`absoluteUrl('/menu')` с и без завершающего слэша в env; `buildMetadata` ставит canonical, `robots.index === false` при `noindex`, OG `url` абсолютный, `title: { absolute }` обрабатывается), `legacy-redirects.test.ts` (все `source` начинаются с `/`, все `destination` существуют как маршруты или `/`, нет дублей `source`, нет петель `source === destination`).

14. **Ручная проверка** на `pnpm build:ci && pnpm start` с рабочей БД: `/politika`, `/soglasie` рендерятся с версией и датой, без остатков `{{`; `/sitemap.xml` содержит ожидаемые URL и не содержит `/admin`, `/spasibo`, статей с `noindex`; `/robots.txt` — по шаблону выше; `curl -I /index.php` → 301 на `/`; `/politika/politika.html` → 301 на `/politika`; `/uploads/x.jpg` → 410.

### Environment Variables

- `NEXT_PUBLIC_SITE_URL` — публичный базовый URL (build arg), например `https://piramida-billiard-74.ru`. Используется для canonical, sitemap, robots, www-редиректа.

### API Endpoints

- `GET /sitemap.xml`, `GET /robots.txt` — Next metadata routes.
- `GET|HEAD /public/**`, `/uploads/**` — всегда 410.

## Acceptance Criteria

- [ ] `/politika` и `/soglasie` выводят актуальный документ из `getCurrentLegalDocument`, версию и дату публикации (по-русски, в зоне `Asia/Yekaterinburg`); выводится `doc.text` как есть (подстановка плейсхолдеров `{{operator_name}}` и др. уже выполнена в `getCurrentLegalDocument`), в тексте нет `{{`; в коде задачи нет собственной подстановки (`render-vars`/`buildLegalVars` отсутствуют).
- [ ] HTML из текста документа не выполняется (нет `rehype-raw`).
- [ ] Если документа нет в БД — `notFound()`; данные читаются только после `connection()` внутри `<Suspense>`; `pnpm build:ci` проходит без БД.
- [ ] `sitemap.xml` динамический: статические страницы, рубрики, статьи (без `noindex`, только опубликованные), авторы; нет `/spasibo`, `/admin`, preview.
- [ ] `robots.txt` закрывает `/admin`, `/login`, `/forgot-password`, `/reset-password`, `/api/`, `/spasibo`, `/blog/preview/` и содержит `Sitemap:`.
- [ ] `buildMetadata({ title, description, path, image })` отдаёт canonical, OG, twitter; покрыт тестом.
- [ ] `<LocalBusinessJsonLd />` выдаёт валидный JSON-LD с адресом, часами, `geo`, телефоном, email, `sameAs`, `priceRange` (данные из настроек через `settingsToLocalBusinessInput`, покрыт тестом); значение экранировано через `jsonLdScript`.
- [ ] `next.config.ts`: только `redirects()` добавлен; `/index.php` -> `/`, `/politika/politika.html`, `/politika/politika-content.html` -> `/politika` (301); `/politika/` и `/spasibo/` перенаправляются на варианты без слэша; www → apex при заданном `NEXT_PUBLIC_SITE_URL`.
- [ ] `/public/**` и `/uploads/**` отвечают 410 (GET и HEAD) с `X-Robots-Tag: noindex`.
- [ ] Файл `public/yandex_b2d6db0830b1e9ce.html` (создан задачей 02) доступен по `/yandex_b2d6db0830b1e9ce.html`.
- [ ] Vitest-тесты новых модулей проходят (`pnpm test`).
- [ ] `pnpm lint`, `pnpm typecheck` и `pnpm build:ci` проходят без ошибок.

## Notes

- **Редирект www → apex** должен быть настроен и в Dokploy/Traefik (action-required.md), правило в `next.config.ts` — страховка.
- **Реквизиты оператора** (ИП/ООО, ИНН/ОГРН, адрес, email) вносит владелец в админке настроек (task 19); до этого на странице будет `[не указано]`. Это нужно показать владельцу как блокер публикации; сами тексты документов проверяет юрист.
- Тексты документов и их версии засеивает задача 10 (таблица `legalDocuments`, `body` с плейсхолдерами `{{operator_name}}`, `{{operator_inn}}`, `{{operator_ogrn}}`, `{{operator_address}}`, `{{operator_email}}`, `{{phone}}`, `{{site_url}}`, `{{retention_months}}`), подставляет их задача 12; здесь только отображение. Старый текст политики (`C:\OSPanel\home\74.loc\politika\politika-content.html`) содержит пустые реквизиты и не переносится как есть.
- Таблица `redirects` (`fromPath` → `toPath`, `code`) обслуживается блогом (задача 25 — чтение при промахе, задача 26 — запись при смене slug); в `next.config.ts` попадают только статические `legacyRedirects`.
- В `sitemap.ts` не использовать `generateSitemaps`; один файл (десятки URL).
