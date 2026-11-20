# Task 25: Блог — публичная часть

## Status

complete

## Wave

5

## Description

Перенос публичной части блога из проекта `billiard-darom` (тот же стартер) в клуб «Пирамида»: Markdown-статьи с оглавлением и шорткодами (видео, документы), рубрики с пагинацией, теги, авторы-тренеры, RSS, динамические OG-картинки, JSON-LD, похожие статьи, кнопки «Поделиться», отложенная публикация, предпросмотр черновика по подписанной ссылке и cron-инвалидация кэша. Из darom не переносится всё, что связано с магазином (товары, коллекции, комплекты, `reviewedBy`, лендинги), а найденные там уязвимости и дефекты исправляются. Стили строго по токенам клуба (`DESIGN.md`), без цветов `#0098d2`/`#ef4238`. Компоненты, которые затем использует админка (задача 26) для клиентского предпросмотра, должны быть «изоморфными» (без `async`, `server-only` и обращений к БД).

## Dependencies

**Depends on:** task-12-public-queries.md, task-13-site-layout.md (а транзитивно 02, 03, 06, 09)
**Blocks:** task-26-blog-admin.md, task-27-home-assembly.md, task-28-qa-verification.md

**Context from dependencies:**
- task-03 создала в `src/lib/schema/content.ts` таблицы `authors`, `rubrics`, `blogTags`, `articleTags`, `articles`, `redirects`; enum `article_status` (`draft | scheduled | published`). Точные колонки (Drizzle-имена, из `contracts.md`):
  - `authors`: `id`, `slug`, `name`, `photoMediaId?`, `roleInClub?`, `rank?`, `bio?` (markdown), `sameAs` (jsonb `string[]`, default `[]`), `sortOrder`, `isActive`, `createdAt`, `updatedAt`;
  - `rubrics`: `id`, `slug`, `name`, `description?`, `imageMediaId?`, `sortOrder`, `createdAt`, `updatedAt`;
  - `blogTags`: `id`, `slug`, `name`, `createdAt`;
  - `articleTags`: `articleId`, `tagId` (составной PK, `cascade`);
  - `articles`: `id`, `slug`, `title`, `excerpt` (default `''`), `body` (markdown, default `''`), `coverMediaId?`, `authorId?`, `rubricId?`, `isFeatured`, `showToc`, `status`, `publishedAt?` (timestamptz), `readingMinutes`, `seoTitle?`, `seoDescription?`, `noindex`, `createdAt`, `updatedAt`;
  - `redirects`: `id`, `fromPath` (unique), `toPath`, `code` (smallint 301/302/307/308, default 301), `createdAt`.
  Неактивные авторы (`isActive = false`) публично не показываются (страница автора → 404, в статье автор не выводится).
- task-09 дала `<Picture asset sizes alt priority className />` (`src/components/media/picture.tsx`), `mediaUrl(asset, w?, fmt?)`, тип `MediaAsset` и таблицу `mediaAssets`. Изображения блога выводятся через `<Picture>` (не через `next/image`).
- task-12 дала `src/lib/cache-tags.ts`: `TAGS` (включая `TAGS.blog`), `articleTag(slug)`; соглашение `'use cache'` + `cacheTag` + `cacheLife`; пакет `src/lib/queries/*` (файл `blog.ts` принадлежит **этой** задаче). Эти запросы нельзя вызывать до `await connection()` внутри `<Suspense>`; «сейчас» и подобное передаётся аргументом.
- task-06 дала `src/lib/seo/jsonld.ts`: `jsonLdScript(obj)`, `articleJsonLd(a)`, `breadcrumbJsonLd(items)`, `personJsonLd`, `src/lib/slug.ts` (`slugify`), `src/lib/dates.ts` (`TZ`). Прочитать сигнатуры `articleJsonLd`/`personJsonLd` в файле (в darom: `articleJsonLd({ headline, url, author: PersonInput, description?, image?, datePublished?, dateModified?, publisher })`).
- task-13 дала `Container`, `SectionTitle`, `Reveal` (`src/components/site/*`) и layout `(site)`.
- task-02 положила ровно 4 статических WOFF-файла Onest для OG-изображений: `src/assets/fonts/onest-cyrillic-400-normal.woff`, `src/assets/fonts/onest-latin-400-normal.woff`, `src/assets/fonts/onest-cyrillic-700-normal.woff`, `src/assets/fonts/onest-latin-700-normal.woff`, и переписала `DESIGN.md` под токены клуба.
- task-01: `next.config.ts` уже содержит `outputFileTracingIncludes: { '/*': ['node_modules/sharp/**/*', 'src/assets/fonts/**/*'] }` (шрифты попадают в standalone); CSP `frame-src` разрешает `https://yandex.ru https://*.yandex.ru https://vk.com https://vk.ru https://vkvideo.ru https://rutube.ru`.

## Files to Create

Библиотека (`src/lib/content/`):
- `markdown.ts` — `extractHeadings`, `slugifyHeading`, `uniqueHeadingId`, `TocHeading` (порт из darom без изменений по сути).
- `remark-callout.ts` — порт (`:::info|success|warning|accent`).
- `shortcodes.ts` — **только** `{{Видео: url}}` и `{{Документ: url | подпись}}` (+ unit-тест).
- `shortcodes.test.ts`
- `video-url.ts` — whitelist хостов и построение embed-URL (+ unit-тест `video-url.test.ts`).
- `preview-token.ts` — `signPreviewToken(articleId, ttlMs?)`, `verifyPreviewToken(articleId, token)` (HMAC, 24 ч) + `preview-token.test.ts`.
- `blog-now.ts` — `roundedNowIso()`.
- `site-url.ts` — `absoluteUrl(path)` (локальная копия; не импортировать `src/lib/seo/metadata.ts` из задачи 23: она в той же волне).
- `format.ts` — `formatArticleDate`, `readingTimeLabel` + тест `format.test.ts`.

Запросы:
- `src/lib/queries/blog.ts` — все чтения блога (этот файл принадлежит задаче 25, остальные в `src/lib/queries/**` — задаче 12).

Компоненты (`src/components/blog/`):
- `article-body.tsx`, `rich-text.tsx`, `markdown-components.tsx`, `callout.tsx`, `toc.tsx`, `article-card.tsx`, `blog-filters.tsx`, `rubric-tile.tsx`, `author-byline.tsx`, `author-card.tsx`, `video-embed.tsx`, `document-embed.tsx`, `load-more.tsx`, `breadcrumbs.tsx`, `share-buttons.tsx`, `article-view.tsx` (общая вёрстка статьи для страницы и предпросмотра), `blog-teaser.tsx` (для главной), `blog-skeletons.tsx`.

Страницы и маршруты:
- `src/app/(site)/blog/page.tsx` — хаб блога.
- `src/app/(site)/blog/[slug]/page.tsx` — статья **или** рубрика (+ редирект/404).
- `src/app/(site)/blog/[slug]/opengraph-image.tsx` — OG-картинка.
- `src/app/(site)/blog/preview/[id]/page.tsx` — предпросмотр по подписанной ссылке.
- `src/app/(site)/blog/rss.xml/route.ts` — RSS 2.0.
- `src/app/(site)/authors/[slug]/page.tsx` — страница автора.
- `src/app/api/cron/blog/route.ts` — `POST`, Bearer `CRON_SECRET` → `revalidateTag(TAGS.blog, 'max')`.

## Files to Modify

Нет (кроме создания файла `src/lib/queries/blog.ts`; `cache-tags.ts` не менять — всё нужное там уже есть).

## Technical Details

### Источники в billiard-darom

Путь: `C:\Users\ba2ra\Documents\__WORKS__\billiard-darom\src`. Читать перед портом: `lib/content/{markdown,remark-callout,shortcodes,queries}.ts`, `components/content/{article-body,rich-text,markdown-components,callout,toc,article-card,author-byline,expert-card,rubric-tile,blog-filters}.tsx`, `components/content/embeds/{video-embed,document-embed}.tsx`, `components/catalog/{breadcrumbs,load-more}.tsx`, `app/(shop)/blog/page.tsx`, `app/(shop)/blog/[slug]/page.tsx`. Переносить с адаптацией, а не копировать вслепую.

**Выбросить:** шорткоды Товар/Коллекция/Комплект/Подборка (оставить только Видео и Документ), `ProductEmbed`, `ProductGridEmbed`, `ShortcodeEmbed`-роутер продуктов, `related-blocks`, `TestedInClub`, `faq`, `landing-hub-card` и вся работа с лендингами, `reviewedBy`, RBAC, `getFeatured*`/`getTopCategories`, любые импорты из `@/lib/merch/*`, `@/lib/media/*` darom. **Не переносить** цвета `#0098d2`, `#ef4238`, классы `text-price`, нативные `<select>`.

**Что исправить относительно darom (обязательно):**

| Проблема в darom | Что делаем |
|---|---|
| `generateStaticParams` с плейсхолдером `__placeholder__` | не используем; страницы динамические, чтение — после `connection()` внутри `<Suspense>` |
| Нет отложенной публикации (`publishedAt IS NOT NULL`) | фильтр публикации (см. ниже) + `now` в аргументах |
| Рубрика без пагинации (`pageSize: 1000`) | пагинация `?page=N`, по 12 на страницу |
| `<img src>` из Markdown принимает любой URL | разрешать только `/media/...` (относительный, не `//`) и `https://`; прочее не рендерить |
| `{{Документ}}` принимал любой URL (в т. ч. `javascript:`) | только `/media/...` и `https://`; иначе токен отбрасывается |
| Видео: YouTube/Vimeo и любой URL в `<video>` | только whitelist: `vk.ru`, `vkvideo.ru`, `vk.com`, `rutube.ru`, собственный `/media/` |
| SEO-поля статьи не использовались | `seoTitle`/`seoDescription`/`noindex` используются в metadata |
| Нет 301 при смене slug | при несовпадении slug: `findRedirect` → `permanentRedirect` |
| Нет `rel`/schema для автора | страница автора + `Person` JSON-LD |
| Захардкоженные цвета | токены `DESIGN.md` |

### Implementation Steps

1. **Прочитать** `DESIGN.md` (токены клуба: `primary`, `primary-dark`, `foreground`, `background`, `muted-foreground`, `accent-red`, `date`, `badge`, `success`, `row-alt`, радиусы, `Container`, шрифт Onest), `src/lib/schema/content.ts`, `src/lib/cache-tags.ts`, `src/lib/queries/settings.ts` (пример стиля `'use cache'`), `src/lib/seo/jsonld.ts`, `src/components/media/picture.tsx` (пропсы), `src/components/site/{container,section-title,reveal}.tsx`.

2. **Библиотека контента.**
   - `markdown.ts` и `remark-callout.ts` — перенести как есть (чистые, без React). `slugifyHeading` дублирует транслитерацию из `src/lib/slug.ts`; оставить собственную копию карты (так порт остаётся самодостаточным), либо импортировать `slugify`, если результат совпадает по тестам; главное — id в TOC и в заголовках должны строиться одной функцией.
   - `shortcodes.ts` — упростить порт: `EmbedType = 'video' | 'document'`; `TYPE_ALIASES`: `видео`, `video`, `документ`, `файл`, `document`. Токен `{{Тип: url | подпись}}`; всё нераспознанное (неизвестный тип, пустой url) **отбрасывается** (не печатать `{{…}}` в тексте). Оставить `parseRichText(source): RichSegment[]` (чередование `markdown`/`embed`), удалить `limit`, `refs[]`, `splitLimit`, `products`. Токен хранит один URL: `{ type, url, label? }`. Перенести и адаптировать тесты (`shortcodes.test.ts` в darom — образец).
   - `video-url.ts`:

```ts
export type VideoSource =
  | { kind: 'iframe'; src: string; provider: 'vk' | 'rutube' }
  | { kind: 'file'; src: string } // собственный /media/...
  | null

const VK_HOSTS = new Set(['vk.ru', 'vk.com', 'vkvideo.ru', 'www.vk.ru', 'www.vk.com', 'www.vkvideo.ru', 'm.vk.com', 'm.vk.ru'])
const RUTUBE_HOSTS = new Set(['rutube.ru', 'www.rutube.ru'])

export function resolveVideoSource(raw: string): VideoSource {
  const value = raw.trim()
  if (value.startsWith('/media/') && !value.startsWith('//') && !value.includes('..')) {
    return { kind: 'file', src: value } // допускаем .mp4/.webm; расширение проверить
  }
  let url: URL
  try { url = new URL(value) } catch { return null }
  if (url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase()
  if (VK_HOSTS.has(host)) {
    // https://vk.ru/video-12345_67890, https://vkvideo.ru/video-12345_67890[?hash=...], а также готовый video_ext.php?oid=&id=&hash=
    const m = /\/video(-?\d+)_(\d+)/.exec(url.pathname)
    const oid = m?.[1] ?? url.searchParams.get('oid')
    const id = m?.[2] ?? url.searchParams.get('id')
    if (!oid || !id || !/^-?\d+$/.test(oid) || !/^\d+$/.test(id)) return null
    const hash = url.searchParams.get('hash')
    const q = new URLSearchParams({ oid, id, hd: '2' })
    if (hash && /^[a-f0-9]+$/i.test(hash)) q.set('hash', hash)
    return { kind: 'iframe', provider: 'vk', src: `https://vkvideo.ru/video_ext.php?${q}` }
  }
  if (RUTUBE_HOSTS.has(host)) {
    // https://rutube.ru/video/<hex32>/ ,  https://rutube.ru/play/embed/<hex32> , https://rutube.ru/shorts/<id>/
    const m = /^\/(?:video|play\/embed|shorts)\/([a-f0-9]{16,64})\/?$/i.exec(url.pathname)
    if (!m) return null
    return { kind: 'iframe', provider: 'rutube', src: `https://rutube.ru/play/embed/${m[1]}` }
  }
  return null
}
```

     `null` → компонент не рендерит ничего. Тесты: vk.ru, vkvideo.ru, vk.com, video_ext.php, hash, rutube video/embed/shorts, `http://` → null, `https://evil.com/...` → null, `https://vk.com.evil.com/video-1_2` → null (сравнение **точного hostname**), `javascript:`, `//evil.com`, `/media/../x`.
   - `preview-token.ts` — HMAC-SHA256 на `BETTER_AUTH_SECRET`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'
const TTL_MS = 24 * 60 * 60 * 1000
const b64 = (buf: Buffer) => buf.toString('base64url')
function mac(articleId: string, exp: number): Buffer {
  return createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(`blog-preview:${articleId}:${exp}`).digest()
}
export function signPreviewToken(articleId: string, now = Date.now(), ttl = TTL_MS): string {
  const exp = now + ttl
  return `${exp}.${b64(mac(articleId, exp))}`
}
export function verifyPreviewToken(articleId: string, token: string, now = Date.now()): boolean {
  const [expRaw, sig] = token.split('.')
  const exp = Number(expRaw)
  if (!sig || !Number.isFinite(exp) || exp < now) return false
  const expected = mac(articleId, exp)
  const given = Buffer.from(sig, 'base64url')
  return given.length === expected.length && timingSafeEqual(given, expected)
}
```

     Использовать `env` из `src/lib/env.ts`, если там есть типизированный `BETTER_AUTH_SECRET`. Тесты: валидный токен; чужой id; истёкший; подпись изменена; мусор; пустая строка. Токен привязан к `articleId`, поэтому ссылка на одну статью не открывает другую.
   - `blog-now.ts`: `export function roundedNowIso(): string { return new Date(Math.floor(Date.now() / 300_000) * 300_000).toISOString() }` — вызывается **только после `await connection()`** (иначе `Date.now()` в статической оболочке вызовет ошибку prerender). Строка ISO, а не `Date`, чтобы ключ кэша был простым.
   - `format.ts`: `formatArticleDate(d)` → «20 ноября 2026» (`Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: TZ })`); `readingTimeLabel(min)` → «5 мин чтения»; `articleWordCount` не нужен (считает задача 26).
   - `site-url.ts`: `absoluteUrl(path)` на `NEXT_PUBLIC_SITE_URL` (без завершающего `/`).

3. **Запросы `src/lib/queries/blog.ts`.** Каждая функция помечена `'use cache'`, `cacheTag(TAGS.blog)` (+ `cacheTag(articleTag(slug))` у статьи). Условие публикации (общий `publishedCondition(now: Date)`):

```ts
import { and, eq, lte, or } from 'drizzle-orm'
function publishedCondition(now: Date) {
  return or(
    eq(articles.status, 'published'),
    and(eq(articles.status, 'scheduled'), lte(articles.publishedAt, now)),
  )
}
```

   Аргумент `now` — **ISO-строка, округлённая до 5 минут** (`roundedNowIso()`), внутри функции `new Date(now)`. Списки: `cacheLife({ stale: 300, revalidate: 300, expire: 3600 })` — отложенные статьи появляются сами в течение 5 минут; дополнительно cron-инвалидация. Страница автора, рубрики, теги, редирект: `cacheLife('max')` + тег `TAGS.blog`.

   Функции и сигнатуры (View-модели — простые JSON-значения, без `Date`; даты — ISO-строки):

```ts
export interface ArticleCardView { id: string; slug: string; title: string; excerpt: string | null; cover: MediaAsset | null; publishedAt: string | null; readingMinutes: number; rubric: { slug: string; name: string } | null; tags: { slug: string; name: string }[] }
export interface AuthorView { id: string; slug: string; name: string; photo: MediaAsset | null; roleInClub: string | null; rank: string | null; bio: string | null; sameAs: string[] }
export interface ArticleDetailView extends ArticleCardView { body: string; showToc: boolean; noindex: boolean; seoTitle: string | null; seoDescription: string | null; updatedAt: string; author: AuthorView | null }

export async function getPublishedArticles(opts: { page?: number; rubricSlugs?: string[]; tagSlugs?: string[]; authorSlug?: string; pageSize?: number; now: string }): Promise<{ items: ArticleCardView[]; total: number; page: number; pageSize: number }>
export async function getFeaturedArticles(limit: number, now: string): Promise<ArticleCardView[]>
export async function getArticleBySlug(slug: string, now: string): Promise<ArticleDetailView | null>
export async function getRubricBySlug(slug: string): Promise<{ id: string; slug: string; name: string; description: string | null; image: MediaAsset | null } | null>
export async function getRubricsWithCounts(now: string): Promise<{ id; slug; name; image: MediaAsset | null; count: number }[]>
export async function getTagsWithCounts(now: string): Promise<{ id; slug; name; count: number }[]>
export async function getAuthorBySlug(slug: string): Promise<AuthorView | null>
export async function getRelatedArticles(article: { id: string; rubricSlug: string | null; tagSlugs: string[] }, now: string, limit = 3): Promise<ArticleCardView[]>
export async function getRecentArticles(n: number, now: string, excludeSlug?: string): Promise<ArticleCardView[]>
export async function findRedirect(path: string): Promise<string | null>   // '/blog/old' -> '/blog/new' | null
export async function getArticleForPreview(id: string): Promise<ArticleDetailView | null>  // БЕЗ 'use cache', БЕЗ фильтра публикации
```

   Детали:
   - `getPublishedArticles`: порядок `publishedAt DESC`; фасет рубрик — `IN`, фасет тегов — `EXISTS` (OR внутри фасета, AND между фасетами, как в darom); `total` — параллельный `count`; теги всех карточек страницы одним запросом (без N+1); `pageSize` по умолчанию 12; `page ≥ 1`. Для каждого `rubricSlug` добавлять `cacheTag(TAGS.blog)` (отдельный тег рубрики не нужен).
   - `getRelatedArticles`: статьи той же рубрики или с общими тегами, кроме самой; сортировка по числу общих тегов, затем по дате; максимум `limit`; если пусто — пустой массив.
   - `getArticleBySlug` возвращает `null` для черновиков, будущих `scheduled` и несуществующих; медиа (cover, фото автора) подгружаются join'ами из `mediaAssets`.
   - `findRedirect(path)`: `db.select({ toPath: redirects.toPath }).from(redirects).where(eq(redirects.fromPath, path))`; возвращает только внутренние пути (начинаются с `/`, не `//`).
   - **Не** оборачивать в `try/catch -> []` (ошибка БД не должна запекаться в кэш пустым результатом).

4. **Компоненты блога** (`src/components/blog/`), общие правила:
   - Только токены `DESIGN.md`; `text-foreground`, `text-muted-foreground`, `bg-card`, `border`, `text-primary`, `hover:text-primary-dark`, акцентные подложки — `bg-primary/10`, `bg-success/10`, `bg-badge/20`, `bg-accent-red/10` (если токен `badge`/`accent-red` называется иначе — взять имя из `globals.css` задачи 02).
   - **Изоморфные** (без `async`, `server-only`, `db`, `next/headers`) — обязательно для: `article-body`, `rich-text`, `markdown-components`, `callout`, `video-embed`, `document-embed`, `toc`. Админка (задача 26) использует `<ArticleBody>` в клиентском предпросмотре.
   - `rich-text.tsx`: **синхронный** `RichText({ source, headingId?, firstHeadingId? })`: `parseRichText` → чередование `<ReactMarkdown remarkPlugins={[remarkGfm, remarkDirective, remarkCallout]} components={markdownComponents(...)}>` и `<VideoEmbed>`/`<DocumentEmbed>`; **без `rehype-raw`** (HTML из текста экранируется). Колонка `flex flex-col gap-8`.
   - `markdown-components.tsx`: как в darom, но: `h1` деминтируется до `h2`; в `a` для внешних `https://` — `target="_blank" rel="noopener noreferrer"`, ссылки `javascript:`/`data:` не рендерить (react-markdown по умолчанию фильтрует; не отключать `urlTransform`); `img` — только `/media/...` или `https://` (иначе `null`), `loading="lazy"`, `className="mx-auto my-4 h-auto max-w-full rounded-lg border"`; ссылка «Перейти к оглавлению» перед каждым H2 кроме первого сохраняется (текст и поведение как в darom, цвет `text-primary`).
   - `callout.tsx`: варианты `info` (`border-primary bg-primary/10`), `success` (`border-success bg-success/10`), `warning` (`border-badge bg-badge/20`), `accent` (`border-accent-red bg-accent-red/10`), `rounded-lg p-4`.
   - `toc.tsx` — клиентский остров со scroll-spy (`IntersectionObserver`) как в darom, `id="toc"`, активный пункт `font-semibold text-primary`.
   - `video-embed.tsx`: принимает `url`, вызывает `resolveVideoSource`; `iframe` — `aspect-video`, `loading="lazy"`, `allow="autoplay; encrypted-media; fullscreen; picture-in-picture"`, `allowFullScreen`, `referrerPolicy="strict-origin-when-cross-origin"`, `title="Видео"`; `file` — `<video controls preload="metadata">`; `null` — ничего. Не добавлять `sandbox` с `allow-same-origin` + `allow-scripts` вместе (бесполезно); допустимо `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-fullscreen"`, если плееры VK/Rutube работают (проверить вручную), иначе без sandbox, т. к. whitelist уже ограничивает источник.
   - `document-embed.tsx`: карточка загрузки, как в darom; URL допускается только `/media/...` или `https://`, иначе не рендерить; для `.pdf` «Открыть», иначе «Скачать»; кнопка — токены `bg-primary text-primary-foreground hover:bg-primary-dark`.
   - `article-card.tsx`: карточка (обложка `<Picture>` 16:9, рубрика-бейдж, заголовок `h3`, excerpt в 2 строки, дата + время чтения). Пропс `featured?` (крупная). `card-interactive` из DESIGN.md. Ссылка на весь блок — `<Link>` на `/blog/<slug>`.
   - `blog-filters.tsx` — `'use client'`: триггер «Фильтры» + `Sheet` (shadcn) с чекбоксами «Рубрики» и «Теги» (с числом статей). Черновое состояние берётся из URL (`useSearchParams`), «Показать статьи» делает `router.replace('/blog?rubric=a,b&tag=c')` и **сбрасывает `page`**, «Сбросить» → `/blog`. Под триггером — удаляемые «пилюли» активных фильтров. Использовать **обычный** `useSearchParams`, **не nuqs** (в блоге нет `NuqsAdapter`). Обязателен `<Suspense>` вокруг (см. страницу).
   - `rubric-tile.tsx` — плитка рубрики с изображением (`<Picture>`), ссылка `/blog/<slug>`.
   - `author-byline.tsx` — маленькая строка «Автор: Имя · дата · N мин чтения» с миниатюрой, ссылка на `/authors/<slug>`.
   - `author-card.tsx` — блок «Об авторе»: фото, имя, `roleInClub`, `rank`, bio (plain text, `line-clamp-4`), ссылка на страницу автора.
   - `load-more.tsx` — `LoadMore({ nextHref, prevHref? })`: `<Link>` «Показать ещё» (кнопка `outline`, `scroll={false}`) к `?page=N+1`; при `prevHref` — ссылка «Назад». Работает без JS (SEO-ссылки).
   - `breadcrumbs.tsx` — как в darom (`nav aria-label="Хлебные крошки"`), тип `BreadcrumbItem = { label: string; href?: string }`.
   - `share-buttons.tsx` — `'use client'`: VK (`https://vk.com/share.php?url=…&title=…`), Telegram (`https://t.me/share/url?url=…&text=…`), «Копировать ссылку» (`navigator.clipboard`, toast sonner). Ссылки открываются в новой вкладке `rel="noopener noreferrer"`, иконки `lucide-react`.
   - `article-view.tsx` — общая вёрстка статьи (header: h1, `AuthorByline`; `Picture` обложки с `priority`; блок `TableOfContents` при `showToc && headings.length > 0`; `ArticleBody`; `ShareButtons`; `AuthorCard`; блок «Похожие статьи» (`getRelatedArticles` вызывается снаружи, массив приходит пропсом) и «Последние статьи»). Используется страницей статьи и предпросмотром.
   - `blog-teaser.tsx` — для главной (задача 27): `async function BlogTeaser({ now }: { now: string })` — вызывает `getRecentArticles(3, now)`; пусто → `null`; иначе `SectionTitle` «Из блога», сетка `grid gap-6 md:grid-cols-3` из `ArticleCard`, ссылка «Все статьи» на `/blog`. **Вызывающая сторона обязана отрендерить его после `await connection()` внутри `<Suspense>`**.
   - `blog-skeletons.tsx` — `BlogListSkeleton`, `ArticleSkeleton`, `BlogTeaserSkeleton`.

5. **Страницы.**

   **`blog/page.tsx` (хаб).** Оболочка (breadcrumbs, h1 «Блог», описание) статична; всё, что читает `searchParams` или БД, — в `<Suspense>`:

```tsx
export const metadata = { title: 'Блог', description: '...', alternates: { canonical: '/blog', types: { 'application/rss+xml': '/blog/rss.xml' } } }

export default function BlogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Container className="py-8">
      {/* breadcrumbs, h1 */}
      <Suspense fallback={<BlogListSkeleton />}>
        <BlogContent searchParams={searchParams} />
      </Suspense>
    </Container>
  )
}

async function BlogContent({ searchParams }: { searchParams: Promise<...> }) {
  const sp = await searchParams
  await connection()
  const now = roundedNowIso()
  // parseFacetParam (rubric, tag: список через запятую, trim, уникальные), parsePageParam (>=1)
  const [articlesPage, rubrics, tags, featured] = await Promise.all([
    getPublishedArticles({ rubricSlugs, tagSlugs, page, now }),
    getRubricsWithCounts(now), getTagsWithCounts(now),
    showBrowse ? getFeaturedArticles(3, now) : Promise.resolve([]),
  ])
  // <BlogFilters> внутри собственного <Suspense fallback={<div className="h-9" />}> (useSearchParams)
  // «Рекомендуем» и плитки рубрик — только без фильтров на 1-й странице; сетка карточек; <LoadMore>
}
```

   - Страница > 1 или любой фильтр → `robots: { index: false, follow: true }` (через `generateMetadata`, читающий `searchParams`) и canonical на `/blog` для фильтров; страницы `?page=N` без фильтров могут индексироваться со своим canonical. Если страница выходит за пределы (`page > ceil(total/pageSize)`) — `notFound()`.
   - Пустое состояние (иконка `Newspaper`, `h-16 w-16 opacity-40`, как в DESIGN.md для empty state).
   - `BreadcrumbList` JSON-LD.

   **`blog/[slug]/page.tsx`.** Один сегмент `[slug]` обслуживает статью **и** рубрику (статья важнее). Алгоритм внутри `<Suspense>`:

```tsx
async function SlugContent({ params, searchParams }) {
  const { slug } = await params
  await connection()
  const now = roundedNowIso()
  const article = await getArticleBySlug(slug, now)
  if (article) return <ArticlePage article={article} now={now} />
  const rubric = await getRubricBySlug(slug)
  if (rubric) return <RubricPage rubric={rubric} now={now} page={page} />
  const target = await findRedirect(`/blog/${slug}`)
  if (target) permanentRedirect(target)
  notFound()
}
```

   - **Статья:** `ArticleView`; JSON-LD `Article` (`articleJsonLd`: `headline`, `url`, `author` = `personJsonLd` автора либо организация «Бильярдный клуб «Пирамида»», `description`, `image` (абсолютный URL варианта 1280 обложки), `datePublished`, `dateModified`, `publisher`) и `BreadcrumbList` (Главная → Блог → Рубрика → Статья); `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(...) }} />`. Похожие (`getRelatedArticles`) и последние (`getRecentArticles(4, now, slug)`) — параллельно.
   - **Рубрика:** h1 = название, пагинация `?page=N` по 12 (`getPublishedArticles({ rubricSlugs: [slug], page, now })`), `LoadMore` со ссылками вперёд/назад, `BreadcrumbList`; `page` вне диапазона → `notFound()`; canonical на себя с `?page=N` при N>1.
   - **`generateMetadata`:** тоже начинает с `await params` и `await connection()`; для статьи: `title = seoTitle ?? title`, `description = seoDescription ?? excerpt ?? (первые ~160 символов текста без разметки)`, canonical `/blog/<slug>`, `openGraph.type = 'article'` (`publishedTime`, `authors`), `robots: noindex ? { index: false, follow: true } : undefined`. **Не** задавать `openGraph.images` — OG-картинку генерирует `opengraph-image.tsx`. Для рубрики — название и описание «Статьи в рубрике «X» — блог клуба «Пирамида»»; иначе `{ title: 'Страница не найдена', robots: { index: false } }`.
   - **Важная оговорка про статусы.** Из-за `cacheComponents` и `<Suspense>` ответ начинает стримиться до выполнения `notFound()`/`permanentRedirect()`: для `notFound()` отдаётся 200 с `<meta name="robots" content="noindex">`, для редиректа — клиентский/мета-редирект вместо HTTP 308. Это ожидаемое ограничение архитектуры. После реализации проверить `curl -sI` на несуществующий slug и на slug с записью в `redirects` и **записать наблюдаемое поведение в отчёт** (если Next вернёт реальный 404/308 — отлично). Не отказываться из-за этого от `<Suspense>` и не вводить `generateStaticParams`.

   **`blog/preview/[id]/page.tsx`:** `searchParams.t`; внутри `<Suspense>`: `await connection()`; `verifyPreviewToken(id, t)` → иначе `notFound()`; `getArticleForPreview(id)` (прямой запрос, включает черновики и будущие) → `ArticleView` с плашкой сверху «Предпросмотр. Статья не опубликована» (`bg-badge text-badge-foreground`, sticky). `metadata`: `robots: { index: false, follow: false }`, `referrer: 'no-referrer'`. Проверка UUID `id` (zod `z.string().uuid()`), иначе 404. Токен нигде не логировать.

   **`authors/[slug]/page.tsx`:** `getAuthorBySlug` → `notFound()` если нет; шапка (`AuthorCard` крупно: фото, имя, роль, звание, bio полностью, ссылки `sameAs` с `rel="noopener noreferrer me"`), список опубликованных статей автора (`getPublishedArticles({ authorSlug, page, now })`, 12 на страницу, `LoadMore`), JSON-LD `Person` (`personJsonLd`: `name`, `url`, `image`, `jobTitle`, `sameAs`) и `BreadcrumbList` (Главная → Блог → Автор). Metadata: `title = name + ' — ' + roleInClub`, canonical.

   **`blog/rss.xml/route.ts`:**

```ts
export async function GET() {
  await connection()
  const items = await getRecentArticles(50, roundedNowIso())
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>Блог — Бильярдный клуб «Пирамида»</title><link>${absoluteUrl('/blog')}</link>
<description>Статьи, советы и новости клуба</description><language>ru</language>
<atom:link href="${absoluteUrl('/blog/rss.xml')}" rel="self" type="application/rss+xml"/>
${items.map(itemXml).join('\n')}
</channel></rss>`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
}
```

   `itemXml`: `<title>`, `<link>`, `<guid isPermaLink="true">`, `<pubDate>` (RFC 822: `new Date(iso).toUTCString()`), `<description>` (excerpt), `<category>` (рубрика), `<dc:creator>`. **Экранировать** `& < > " '` во всех текстовых значениях (`escapeXml`), текст внутри `CDATA` не использовать. Статьи с `noindex` в RSS не включать (отфильтровать в запросе: `getRecentArticles` возвращает и их, поэтому добавить в `ArticleCardView` поле `noindex: boolean` или отдельную опцию `includeNoindex: false`).

   **`opengraph-image.tsx`:**

```tsx
import { ImageResponse } from 'next/og'
import { connection } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Блог клуба «Пирамида»'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await connection()
  const article = await getArticleBySlug(slug, roundedNowIso())
  const fontFile = (name: string) => readFile(join(process.cwd(), 'src/assets/fonts', name))
  const [cyr400, lat400, cyr700, lat700] = await Promise.all([
    fontFile('onest-cyrillic-400-normal.woff'),
    fontFile('onest-latin-400-normal.woff'),
    fontFile('onest-cyrillic-700-normal.woff'),
    fontFile('onest-latin-700-normal.woff'),
  ])
  const title = article?.title ?? 'Блог клуба «Пирамида»'
  return new ImageResponse(
    (<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#2f6c4a', color: '#fff', fontFamily: 'Onest' }}>
        {/* бейдж рубрики (#fecb17 / #352b07), заголовок до ~3 строк (fontSize 64, lineHeight 1.15), внизу «Бильярдный клуб «Пирамида» · Челябинск» */}
    </div>),
    {
      ...size,
      fonts: [
        { name: 'Onest', data: cyr400, weight: 400, style: 'normal' },
        { name: 'Onest', data: lat400, weight: 400, style: 'normal' },
        { name: 'Onest', data: cyr700, weight: 700, style: 'normal' },
        { name: 'Onest', data: lat700, weight: 700, style: 'normal' },
      ],
    },
  )
}
```

   Особенности: цвета в OG — **литералы** (satori не понимает CSS-переменные); значения брать из токенов `DESIGN.md` (`#2f6c4a`, `#fecb17`, `#352b07`) и не расширять палитру. Satori не поддерживает variable-шрифты и WOFF2, поэтому используются ровно 4 статических WOFF-файла из задачи 02 (кириллица + латиница, 400 и 700): заголовок — `fontWeight: 700`, остальной текст — 400; других шрифтов не добавлять. Длинный заголовок обрезать (`title.length > 110 → slice + '…'`). Трассировка `src/assets/fonts/**/*` в standalone уже настроена задачей 01 (`outputFileTracingIncludes`); после `next build` убедиться, что файлы есть в `.next/standalone/src/assets/fonts/`.

   **`api/cron/blog/route.ts`:**

```ts
import { revalidateTag } from 'next/cache'
import { TAGS } from '@/lib/cache-tags'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
  revalidateTag(TAGS.blog, 'max')
  return Response.json({ ok: true, revalidated: TAGS.blog })
}
```

   Сравнение секрета — через `timingSafeEqual` по буферам одинаковой длины (оформить маленькую функцию). Если `CRON_SECRET` не задан → всегда 401 (не «открыто»). Не ставить `revalidateTag` в GET.

6. **Тесты (Vitest):** `shortcodes.test.ts`, `video-url.test.ts`, `preview-token.test.ts`, `format.test.ts`, `markdown.test.ts` (`extractHeadings`: пропуск заголовков в fenced code, уникальные id, токены `{{…}}` вырезаются из текста заголовка). Если есть опыт — компонентный тест не требуется, проверка UI делается руками и e2e задачи 28.

7. **Ручная проверка:** создать (SQL/seed) опубликованную, запланированную (будущая дата) и черновик; убедиться, что на `/blog` видна только первая; запланированная появляется после того, как `now` проходит `publishedAt` (подвинуть дату в БД на прошлое); preview-ссылка черновика открывается с токеном и не открывается без/с чужим/истёкшим токеном; rss.xml валиден (`xmllint`), OG-картинка рисуется кириллицей; рубрика с >12 статей пагинируется.

### Environment Variables

- `BETTER_AUTH_SECRET` — ключ HMAC для preview-токенов.
- `CRON_SECRET` — Bearer для `/api/cron/blog`.
- `NEXT_PUBLIC_SITE_URL` — абсолютные ссылки в RSS/JSON-LD/кнопках «Поделиться».

### API Endpoints

- `GET /blog/rss.xml` — RSS 2.0 (50 последних индексируемых статей).
- `POST /api/cron/blog` — `Authorization: Bearer $CRON_SECRET`; `revalidateTag('blog', 'max')`; ответ `{ ok: true }` или 401. Dokploy Schedules вызывает его ежечасно (action-required.md).
- `GET /blog/preview/[id]?t=<token>` — страница предпросмотра (noindex).

## Acceptance Criteria

- [ ] `pnpm build:ci` проходит **без БД**: ни одна страница/handler блога не обращается к БД на этапе сборки, нет `generateStaticParams`, нет `try/catch → []`.
- [ ] `/blog` показывает опубликованные статьи, фильтры по рубрикам/тегам (URL `?rubric=a,b&tag=c&page=N`), «Рекомендуем» и плитки рубрик (только без фильтров на 1-й странице), пагинацию; `BlogFilters` обёрнут в `<Suspense>`.
- [ ] Фильтр публикации: `status='published'` ИЛИ (`status='scheduled'` И `publishedAt <= now`); `now` передаётся аргументом, округлён до 5 минут; списки с `cacheLife({ revalidate: 300 })`; черновики и будущие `scheduled` недоступны публично.
- [ ] `/blog/[slug]`: статья → рубрика (с пагинацией по 12) → `findRedirect` → `permanentRedirect`, иначе `notFound()`; `noindex` статьи даёт `robots: noindex`; `seoTitle`/`seoDescription` используются.
- [ ] Видео-шорткод: работают VK (`vk.ru`, `vkvideo.ru`, `vk.com`) и Rutube; чужие хосты, `http:`, `javascript:` и подделки вида `vk.com.evil.com` не рендерятся; собственный `/media/` — нативный `<video>`.
- [ ] Документ-шорткод и Markdown-картинки принимают только `/media/...` и `https://`; HTML в Markdown экранируется (нет `rehype-raw`); есть Vitest-тесты безопасности.
- [ ] Оглавление строится из H2–H6, якоря совпадают с id заголовков, scroll-spy работает, «Перейти к оглавлению» перед H2 (кроме первого).
- [ ] На странице статьи: хлебные крошки, автор (`AuthorByline`, `AuthorCard`), дата и время чтения, обложка `<Picture priority>`, кнопки «Поделиться» (VK, Telegram, копировать), «Похожие статьи» и «Последние статьи», JSON-LD `Article` и `BreadcrumbList`.
- [ ] `/authors/[slug]` показывает автора, его статьи (с пагинацией) и JSON-LD `Person`; несуществующий автор → 404.
- [ ] `/blog/rss.xml` — валидный RSS 2.0, значения экранированы, `noindex`-статей нет, заголовок `application/rss+xml`.
- [ ] `/blog/[slug]/opengraph-image` рисует PNG 1200×630 со шрифтом Onest (кириллица читается) для статьи и безопасно отдаёт общий вариант для несуществующей.
- [ ] Предпросмотр `/blog/preview/[id]?t=` открывается только с валидным 24-часовым HMAC-токеном данной статьи, виден черновик, страница `noindex, nofollow`; токен чужой/просроченный/испорченный → 404.
- [ ] `POST /api/cron/blog` без/с неверным Bearer → 401, с верным → `revalidateTag('blog', 'max')`; при незаданном `CRON_SECRET` всегда 401.
- [ ] Компоненты `article-body`, `rich-text`, `markdown-components`, `callout`, `video-embed`, `document-embed`, `toc` — синхронные и без `server-only` (пригодны для клиентского предпросмотра в задаче 26).
- [ ] `BlogTeaser({ now })` выводит 3 последние статьи (или `null`, если их нет) и не обращается к БД до вызова `connection()` снаружи.
- [ ] Нет захардкоженных цветов darom и нативных `<select>`; везде токены `DESIGN.md`; светлая тема; корректная вёрстка на 375/768/1440/1920.
- [ ] Vitest для новых модулей проходит; `pnpm lint`, `pnpm typecheck` и `pnpm build:ci` проходят без ошибок.

## Notes

- **Статусы HTTP при стриминге:** см. оговорку в п. 5. Зафиксировать фактическое поведение (404/200, 308/мета-редирект) в отчёте.
- **CSP и iframe:** CSP задачи 01 (`next.config.ts`) разрешает `frame-src https://yandex.ru https://*.yandex.ru https://vk.com https://vk.ru https://vkvideo.ru https://rutube.ru` — этого достаточно для whitelist видео; `next.config.ts` эта задача не меняет.
- **Зарезервированные slug'и** (`preview`, `rss.xml`) — не могут быть slug статьи/рубрики; проверка при сохранении — в задаче 26. В `slug` статьи и рубрики одно пространство имён `/blog/<slug>`: коллизия статья/рубрика проверяется там же.
- Имена колонок `content.ts` зафиксированы в `contracts.md` (см. «Context from dependencies»); view-модели определяет эта задача.
- Изображения из `mediaAssets` поддерживают только jpeg/png/webp/avif; видео-файл в `/media/` в клубе загрузить нельзя (SVG/видео запрещены), поэтому ветка `file` в `video-embed` — задел на будущее.
- Блог не использует nuqs и не оборачивается в `NuqsAdapter`.
