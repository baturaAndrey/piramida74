# Task 27: Сборка главной страницы

## Status

complete

## Wave

6

## Description

Создаётся единственный файл `src/app/(site)/page.tsx`, который собирает главную страницу из готовых секций (задачи 20, 21, 24, 25) в порядке старого сайта и добавляет два новых блока: «Калькулятор» и «Из блога». Каждая секция, которой нужны данные из БД, рендерится в собственном `<Suspense>` со скелетоном, «операционная дата» и «сейчас» вычисляются один раз после `connection()` и передаются вниз аргументами (чтобы `next build` проходил без БД, а кэш `'use cache'` менялся каждый день). На главную также ставятся JSON-LD `LocalBusiness`, метаданные из настроек и обёртки `Reveal` (появление при прокрутке). Задача проверяется визуальной сверкой со старым сайтом на 1920/1440/768/375.

## Dependencies

**Depends on:** task-20-home-sections-top.md, task-21-home-sections-bottom.md, task-23-legal-seo-redirects.md, task-24-calculator-ui.md, task-25-blog-public.md (транзитивно 12, 13)
**Blocks:** task-28-qa-verification.md

**Context from dependencies:**
- task-13 дала `src/app/(site)/layout.tsx` (Header, `<main id="main-content">`, Footer, CookieBanner, Metrika) и компоненты `Container`, `SectionTitle`, `PrimaryButton`, `Reveal` (`src/components/site/*`). Якоря шапки: `#discount` (Акции), `#service` (Услуги клуба), `#reasons` (Турниры), `#portfolio` (Бар и кухня), `#price` (Прайс-лист), `#contacts` (Контакты).
- task-12 дала кэшируемые запросы `src/lib/queries/*` (`'use cache'`), которые нельзя вызывать до `await connection()`; в `src/lib/queries/settings.ts` — `getSettings(): Promise<SiteSettings>`. Для метаданных используется ключ `seoDefaults: { title: string; description: string; ogImageMediaId: string | null }` (других SEO-ключей в `SiteSettings` нет).
- task-09 дала `mediaUrl(asset, w?, fmt?)` (`src/lib/media/url.ts`) и таблицу `mediaAssets` (`src/lib/schema`, `db` из `src/lib/db.ts`) — для OG-картинки по `ogImageMediaId`.
- task-20 создала верхние секции: `src/components/site/home/hero.tsx`, `promotions-carousel.tsx`, `services-tabs.tsx`, `tournaments-preview.tsx`, `bar-section.tsx`, `price-accordion.tsx` (порядок на странице: Hero, Акции `#discount`, Услуги `#service`, Турниры `#reasons`, Бар и кухня `#portfolio`, Прайс-лист `#price`).
- task-21 создала нижние секции: `src/components/site/home/about-section.tsx` (`#clientsc`), `booking-steps.tsx` (`#worksteps`), `cta-form-section.tsx` (`#getconsultation`), `contacts-section.tsx` (`#contacts`).
- task-23 создала `src/components/seo/local-business-jsonld.tsx` (`<LocalBusinessJsonLd />`, async, внутри сам делает `connection()`; рендерить в `<Suspense fallback={null}>`) и `src/lib/seo/metadata.ts` (`buildMetadata`, `absoluteUrl`, `SITE_NAME`, `DEFAULT_DESCRIPTION`).
- task-24 создала `src/components/calculator/home-calculator-teaser.tsx` (`'use client'`, пропс `{ opDate: string }`, без обращений к БД).
- task-25 создала `src/components/blog/blog-teaser.tsx` (`async function BlogTeaser({ now }: { now: string })`, 3 последние статьи или `null`) и `src/lib/content/blog-now.ts` (`roundedNowIso()` — `now` округлён до 5 минут, ISO-строка; вызывать только после `connection()`).
- **Секции задач 20/21** (по их task-файлам): каждая — async Server Component **без пропсов**, сама вызывает `await connection()` (и `getOpDate()`, если нужна дата) и читает `src/lib/queries`; рядом экспортирует скелетон той же высоты. Экспорты: `Hero`/`HeroSkeleton`, `PromotionsCarousel`/`PromotionsCarouselSkeleton`, `ServicesTabs`/`ServicesTabsSkeleton`, `TournamentsPreview`/`TournamentsPreviewSkeleton`, `BarSection`/`BarSectionSkeleton`, `PriceAccordion`/`PriceAccordionSkeleton` (task 20); `AboutSection`/`AboutSectionSkeleton`, `BookingSteps`/`BookingStepsSkeleton`, `CtaFormSection`/`CtaFormSectionSkeleton` (читает галерею `cta`), `ContactsSection`/`ContactsSectionSkeleton` (task 21). **Все** они читают БД → каждая в своём `<Suspense fallback={<XSkeleton />}>`. Не править файлы 20/21/24/25 — при несовместимости описать проблему в отчёте.

## Files to Create

- `src/app/(site)/page.tsx` — главная (единственный владелец этого файла — данная задача).
- `src/components/site/home/home-context.ts` — `getHomeContext()` (кэш на рендер: `opDate` и `now` вычисляются один раз после `connection()`).
- `src/components/site/home/home-skeletons.tsx` — только `CalculatorTeaserSkeleton` (скелетоны секций 20/21 экспортируются из их файлов; для блога — `BlogTeaserSkeleton` из `src/components/blog/blog-skeletons.tsx`).

## Files to Modify

- Нет. Если в `src/app/(site)/` уже лежит `page.tsx` (заглушка задачи 13) — заменить его целиком.

## Technical Details

### Implementation Steps

1. **Прочитать** все компоненты секций (пути в «Context from dependencies»), `src/lib/queries/settings.ts`, `src/lib/settings-defaults.ts` (дефолты `seoDefaults`), `src/components/site/reveal.tsx` (пропсы), `DESIGN.md`, `src/components/blog/blog-skeletons.tsx`.

2. **`home-context.ts`.** Вычислить `opDate` и `now` один раз за рендер после `connection()`:

```ts
import { cache } from 'react'
import { connection } from 'next/server'
import { getOpDate } from '@/lib/dates'
import { roundedNowIso } from '@/lib/content/blog-now'

export interface HomeContext {
  /** Операционная дата YYYY-MM-DD (до 09:00 — предыдущий день), Asia/Yekaterinburg. */
  opDate: string
  /** Момент «сейчас», округлённый до 5 минут (ISO), для блога. */
  now: string
}

/** Дедуплицируется в рамках одного запроса: все секции получают одно и то же значение. */
export const getHomeContext = cache(async (): Promise<HomeContext> => {
  await connection()
  return { opDate: getOpDate(), now: roundedNowIso() }
})
```

3. **Обёртки секций.** Каждая секция читает БД, поэтому оборачивается в `<Suspense>`. Секции 20/21 рендерятся напрямую (без пропсов). Обёртки с `await getHomeContext()` (это и есть `connection()`) нужны только блокам, которым нужен аргумент (`CalculatorBlock`, `BlogBlock`, см. Code Snippets). Шаблон:

```tsx
<Suspense fallback={<PromotionsCarouselSkeleton />}><PromotionsCarousel /></Suspense>
<Suspense fallback={<BlogTeaserSkeleton />}><BlogBlock /></Suspense> // BlogBlock: const { now } = await getHomeContext()
```

   Аргументы: секции задач 20/21 (`Hero`, `PromotionsCarousel`, `ServicesTabs`, `TournamentsPreview`, `BarSection`, `PriceAccordion`, `AboutSection`, `BookingSteps`, `CtaFormSection`, `ContactsSection`) пропсов не принимают и рендерятся напрямую: `<Suspense fallback={<PromotionsCarouselSkeleton />}><PromotionsCarousel /></Suspense>` (обёртка `XBlock` и `getHomeContext()` для них не нужны; `opDate` они берут сами через `getOpDate()` после `connection()`); `HomeCalculatorTeaser` — `opDate` пропсом, `<Suspense>` не нужен, но `opDate` берётся из `getHomeContext()` (поэтому тоже через обёртку внутри `<Suspense>` со скелетоном карточки); `BlogTeaser` — `now`.
   - Если компонент секции принимает **готовые данные** вместо чтения БД самостоятельно, обёртка должна сама вызвать нужные запросы из `src/lib/queries` (после `getHomeContext()`).
   - **Нельзя** вызывать `getOpDate()`/`new Date()`/`Date.now()` вне `getHomeContext()` и вне клиентских компонентов.
   - Нельзя глушить ошибки (`try/catch → null`).

4. **Порядок секций** (как на старом сайте, плюс два новых блока) и якоря — внутри самих компонентов секций (проверить, что `id` стоят, `scroll-mt-*` учитывает липкую шапку):

| № | Секция | Компонент | `id` |
|---|---|---|---|
| 1 | Hero | `Hero` | — |
| 2 | Акции | `PromotionsCarousel` | `discount` |
| 3 | Услуги | `ServicesTabs` | `service` |
| 4 | Календарный план турниров | `TournamentsPreview` | `reasons` |
| 5 | Бар и кухня | `BarSection` | `portfolio` |
| 6 | Прайс-лист | `PriceAccordion` | `price` |
| 7 | **Калькулятор (новый)** | `HomeCalculatorTeaser` | `calculator` |
| 8 | О клубе | `AboutSection` | `clientsc` |
| 9 | Бронирование в 3 шага | `BookingSteps` | `worksteps` |
| 10 | CTA-форма | `CtaFormSection` | `getconsultation` |
| 11 | **Из блога (новый)** | `BlogTeaser` | `blog` |
| 12 | Контакты | `ContactsSection` | `contacts` |

   Шапка и футер — в `layout.tsx` (task 13), здесь не рендерятся. Блоки «Калькулятор» и «Из блога» оборачиваются в `<section id="…" aria-labelledby>` с `Container`, `py-12` и заголовком `SectionTitle` (если сам компонент секции его не содержит — проверить, чтобы заголовок не дублировался). Расстояния между секциями — единый ритм по DESIGN.md (`py-12`/`py-16`).

5. **`Reveal`.** Оборачивать в `Reveal` (появление при прокрутке `translateY(100px→0)`, 0.5 с) все секции, кроме Hero (он над сгибом; иначе LCP отложится). Не оборачивать `Suspense` внутрь `Reveal` наоборот: структура `<Reveal><Suspense>…</Suspense></Reveal>` либо `<Suspense><Block/></Suspense>` с `Reveal` внутри `Block` — выбрать один вариант и применять ко всем одинаково (рекомендуется первый: скелетон тоже появляется плавно). Reveal не должен скрывать контент при выключенном JS или `prefers-reduced-motion` (это обязанность самого `Reveal` из task 13; проверить визуально и сообщить, если нет).

6. **JSON-LD.** В начале страницы: `<Suspense fallback={null}><LocalBusinessJsonLd /></Suspense>`.

7. **Метаданные.** `generateMetadata` из настроек. Чтение настроек — `'use cache'`, поэтому сначала `connection()`:

```tsx
import { connection } from 'next/server'
import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { mediaAssets } from '@/lib/schema'
import { mediaUrl } from '@/lib/media/url'
import { getSettings } from '@/lib/queries/settings'
import { buildMetadata, DEFAULT_DESCRIPTION, SITE_NAME } from '@/lib/seo/metadata'

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  const { seoDefaults } = await getSettings() // { title; description; ogImageMediaId: string | null }
  let image: string | undefined
  if (seoDefaults.ogImageMediaId) {
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, seoDefaults.ogImageMediaId)).limit(1)
    if (asset) image = mediaUrl(asset, 1280, 'webp') // относительный путь; buildMetadata делает его абсолютным
  }
  return buildMetadata({
    title: { absolute: seoDefaults.title || `${SITE_NAME} в Челябинске — русская пирамида, пул, VIP-комнаты` },
    description: seoDefaults.description || DEFAULT_DESCRIPTION,
    path: '/',
    image, // нет ogImageMediaId — OG по умолчанию (opengraph-image корня, если есть)
  })
}
```

   Если `next build` без БД падает на `generateMetadata` из-за доступа к БД до `Suspense`, **запасной вариант**: статический `export const metadata = buildMetadata({...})` с константами из `src/lib/seo/metadata.ts`; расхождение отметить в отчёте.

8. **Каркас `page.tsx`:**

```tsx
import { Suspense } from 'react'
import { Reveal } from '@/components/site/reveal'
// импорты секций (см. п. 4), скелетонов, LocalBusinessJsonLd, getHomeContext

export default function HomePage() {
  return (
    <>
      <Suspense fallback={null}><LocalBusinessJsonLd /></Suspense>

      <Suspense fallback={<HeroSkeleton />}><Hero /></Suspense>

      <Reveal><Suspense fallback={<PromotionsCarouselSkeleton />}><PromotionsCarousel /></Suspense></Reveal>
      <Reveal><Suspense fallback={<ServicesTabsSkeleton />}><ServicesTabs /></Suspense></Reveal>
      <Reveal><Suspense fallback={<TournamentsPreviewSkeleton />}><TournamentsPreview /></Suspense></Reveal>
      <Reveal><Suspense fallback={<BarSectionSkeleton />}><BarSection /></Suspense></Reveal>
      <Reveal><Suspense fallback={<PriceAccordionSkeleton />}><PriceAccordion /></Suspense></Reveal>
      <Reveal><Suspense fallback={<CalculatorTeaserSkeleton />}><CalculatorBlock /></Suspense></Reveal>
      <Reveal><Suspense fallback={<AboutSectionSkeleton />}><AboutSection /></Suspense></Reveal>
      <Reveal><Suspense fallback={<BookingStepsSkeleton />}><BookingSteps /></Suspense></Reveal>
      <Reveal><Suspense fallback={<CtaFormSectionSkeleton />}><CtaFormSection /></Suspense></Reveal>
      <Reveal><Suspense fallback={<BlogTeaserSkeleton />}><BlogBlock /></Suspense></Reveal>
      <Reveal><Suspense fallback={<ContactsSectionSkeleton />}><ContactsSection /></Suspense></Reveal>
    </>
  )
}
```

   Страница сама **не** читает `searchParams`/`cookies`/`headers` и не вызывает `connection()` на верхнем уровне (иначе `next build` упадёт: динамический доступ вне `<Suspense>`). В статическую оболочку попадают только скелетоны.

9. **Скелетоны**: секций 20/21 — из их файлов (проверить габариты); `CalculatorTeaserSkeleton` (`home-skeletons.tsx`) — серверный компонент с `Skeleton` (shadcn) или `animate-pulse bg-muted rounded-lg`, **с теми же внешними отступами и примерной высотой**, что у реальных секций (чтобы не было сдвига макета, CLS < 0.1): Hero — блок `min-h` как у героя, `rounded-[25px]`; карусель — две карточки; услуги — вкладки + картинка; турниры — 3 строки; бар — сетка 6 фото; прайс — 4 строки аккордеона; калькулятор — карточка; о клубе — фон + 4 пункта; контакты — две колонки + блок карты.

10. **Визуальная сверка со старым сайтом** (чек-лист; старый сайт — `http://74.loc` на OSPanel; новый — `pnpm dev` или `pnpm start`). Сделать скриншоты на 1920, 1440, 768, 375 (Playwright или DevTools) и сравнить попарно:
    - [ ] Hero: фон, скругление 25px и отступ 1vw по бокам, бейдж `#fecb17` с печатающимися фразами, H1 («Бильярдный клуб «Пирамида» в Челябинске — …»: 65/85 на десктопе, 24/32 на мобильном, по центру), кнопка «Забронировать стол» с «бликом».
    - [ ] Шапка: липкая, фон `#F5F8F9` после прокрутки, якоря, блок «Мы онлайн, пишите», часы, телефон, «Заказать звонок», бургер → крестик на мобильном.
    - [ ] Акции: слайдер 2 карточки на десктопе, 1 на мобильном, пагинация-точки 15px, круглые стрелки 64px, кнопка «Узнать условия» `#DE2D26` открывает попап.
    - [ ] Услуги: 4 вкладки, галерея (первое фото крупно, лайтбокс), цены «От 580₽/час» и т. д.
    - [ ] Турниры: левый sticky-блок («…турниров по бильярдному спорту в <год> году», кнопка «Заказать звонок»), справа до 5 событий; даты красным `#D43228`: «5 марта», «5–7 марта»; плашка `rgba(255,255,255,.8)`.
    - [ ] Бар и кухня: 6 фото, текст, «Забронировать стол».
    - [ ] Прайс: аккордеон из 4 групп, круглая кнопка «+», цены совпадают с таблицей из legacy-notes (580/640/680/760, ночь 3500, VIP 1400/4800, пенсионный 200, прокат 250), сноска «*Стоимость может отличаться…».
    - [ ] Калькулятор-тизер (новый): визуально в стиле сайта, ссылка ведёт на `/calculator?g=..&d=..&h=..` и воспроизводит значения.
    - [ ] О клубе: фон `lobbyo`, H2, 4 пункта 01–04.
    - [ ] Бронирование в 3 шага; CTA-форма (фон `forma-01`, фото человека, чекбокс согласия не отмечен).
    - [ ] Из блога (новый): 3 последние статьи либо блок скрыт, если статей нет.
    - [ ] Контакты: адрес, часы «Ежедневно 09:00–02:00», телефон, email, Telegram, VK, «Построить маршрут», карта grayscale → цветная при наведении, click-to-load.
    - [ ] Футер: «Copyright © 2019 – <год>», ссылка на политику.
    - [ ] Отсутствует горизонтальная прокрутка на 375/768; шрифт Onest везде (в т. ч. в полях форм); тексты не растут за 1920.

11. **Проверки сборки:** `pnpm build:ci` без доступной БД проходит (все БД-блоки внутри `<Suspense>` после `getHomeContext()`); `pnpm dev` с БД: главная отдаёт 200, нет предупреждений React о гидратации, нет ошибок в консоли; кнопка «Заказать звонок»/«Забронировать стол» открывают попапы (task 11).

### Code Snippets

Пример обёртки для блога и тизера:

```tsx
async function BlogBlock() {
  const { now } = await getHomeContext()
  return <BlogTeaser now={now} />
}

async function CalculatorBlock() {
  const { opDate } = await getHomeContext()
  return (
    <section id="calculator" aria-labelledby="calculator-title" className="py-12">
      <Container>
        <SectionTitle id="calculator-title">Рассчитайте стоимость вечера</SectionTitle>
        <HomeCalculatorTeaser opDate={opDate} />
      </Container>
    </section>
  )
}
```

### Environment Variables

Новых нет (`NEXT_PUBLIC_SITE_URL` используется внутри `buildMetadata`).

## Acceptance Criteria

- [ ] `src/app/(site)/page.tsx` существует и содержит секции в порядке: Hero, Акции, Услуги, Турниры, Бар и кухня, Прайс-лист, Калькулятор, О клубе, Бронирование, CTA-форма, Из блога, Контакты; шапка и футер приходят из layout.
- [ ] Каждая секция с данными из БД рендерится в собственном `<Suspense fallback={<…Skeleton/>}>`; `opDate` (для `HomeCalculatorTeaser`) и `now` (для `BlogTeaser`) вычисляются один раз в `getHomeContext()` после `connection()` и передаются аргументами; секции 20/21 рендерятся без пропсов; на странице нет прямых `new Date()`/`Date.now()`.
- [ ] `pnpm build:ci` проходит без БД; не используются `generateStaticParams` и обходные `try/catch → []`.
- [ ] Блоки «Калькулятор» (`HomeCalculatorTeaser`) и «Из блога» (`BlogTeaser`) подключены; при отсутствии статей блок блога не оставляет пустого места и заголовка.
- [ ] Якоря шапки (`#discount`, `#service`, `#reasons`, `#portfolio`, `#price`, `#contacts`) прокручивают к соответствующим секциям с учётом липкой шапки.
- [ ] `<LocalBusinessJsonLd />` присутствует в HTML главной (валидный JSON-LD), `generateMetadata` берёт `title`/`description` из `settings.seoDefaults`, OG-картинку — по `seoDefaults.ogImageMediaId` через `mediaUrl` (или статический запасной вариант с пометкой в отчёте), canonical = `/`.
- [ ] Секции (кроме Hero) обёрнуты в `Reveal`; при `prefers-reduced-motion` и без JS контент виден.
- [ ] Скелетоны повторяют габариты секций: нет заметного сдвига макета при загрузке (CLS < 0.1 в Lighthouse).
- [ ] Визуальная сверка по чек-листу п. 10 выполнена на 1920/1440/768/375, расхождения исправлены либо перечислены в отчёте.
- [ ] `pnpm lint` и `pnpm typecheck` проходят без ошибок.

## Notes

- Файл `src/app/(site)/page.tsx` — единственный в этой задаче, который можно создавать вне `src/components/site/home/`; секции 20/21/24/25 не править.
- Hero — главный кандидат на LCP: не оборачивать в `Reveal`, фоновое изображение через `<Picture priority>` (делает task 20).
- Секции 20/21 сами вызывают `connection()` и `getOpDate()` — это по их контракту (вызов после `connection()` безопасен для пререндера); `getHomeContext()` нужен только для `HomeCalculatorTeaser` (`opDate`) и `BlogTeaser` (`now`).
