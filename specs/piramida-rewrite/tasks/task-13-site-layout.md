# Task 13: Layout публичного сайта (шапка, футер, cookie-баннер, Метрика, 404)

## Status

pending

## Wave

4

## Description

Каркас публичной части: layout группы `(site)` с шапкой (якоря и ссылки на разделы, адрес, Telegram, часы, телефон, «Заказать звонок», закрепление при прокрутке, анимированный бургер и мобильное меню), футером, кнопкой «наверх», cookie-баннером и Яндекс Метрикой, которая загружается только после согласия. Здесь же общие «строительные блоки» сайта (`Container`, `SectionTitle`, `PrimaryButton` с «бликом», `Reveal`), которыми пользуются задачи 20–25, и `not-found.tsx` в стиле старой 404. Внешний вид портируется со старого сайта 1:1 при ширинах 1920 и 320, но через `clamp()` и брейкпоинты, а не масштабирование на `vw`.

## Dependencies

**Depends on:** task-01-starter-cleanup-deps.md, task-02-design-tokens-layout.md, task-09-media-core.md, task-11-lead-capture.md, task-12-public-queries.md
**Blocks:** task-20-home-sections-top.md, task-21-home-sections-bottom.md, task-22-pages-menu-prices-tournaments.md, task-23-legal-seo-redirects.md, task-24-calculator-ui.md, task-25-blog-public.md

**Context from dependencies:**
- Task 02 определил токены в `src/app/globals.css` (`@theme`): `primary` (#2f6c4a), `primary-dark` (#13442e), `foreground` (#1c1c1c), `background` (#f6f6f6), `nav` (#f5f8f9), `footer` (#1a1a1a), `muted-foreground` (#8e8e8e), `accent-red`, `date`, `badge`, `success`, `row-alt`, шрифт Onest; корневой `src/app/layout.tsx` содержит только `<html lang="ru"><body className={шрифт}>{children}<Toaster /></body></html>` — без Header/Footer/`<main>`. `<main id="main-content" className="flex-1">`, шапка, футер, `CookieBanner` и `Metrika` живут в `src/app/(site)/layout.tsx` (эта задача). `globals.css` **не править** (владелец — задача 02); недостающие keyframes делать через CSS Modules рядом с компонентами.
- Task 09 дал `<Picture>` (`src/components/media/picture.tsx`, пропсы `asset`, `sizes`, `alt`, `priority`, `className`).
- Task 11 дал `LeadDialogTrigger` (`@/components/leads/lead-dialog`; пропсы `kind: 'callback' | 'booking' | 'promo' | 'tournament'`, `block: string`, `formTitle?`, `promotionId?`, `tournamentId?`, `asChild?`, `className?`, `children`; здесь используются `kind="callback"` (шапка, мобильное меню) и `kind="booking"` (404)), `PolicyDialog` (`@/components/leads/policy-dialog`, пропсы `title`, `markdown`, `children`-триггер) и `reachGoal` (`@/lib/metrika`).
- Task 12 дал `getSettings()` (`@/lib/queries/settings`), `SETTINGS_DEFAULTS`/`SiteSettings` (`@/lib/settings-defaults`), `getCurrentLegalDocument('policy')` (`@/lib/queries/legal`; возвращает `{ id; type; version; title; text; publishedAt; sha256 } | null`, `text` — markdown с уже подставленными реквизитами, повторно ничего не подставлять), `getGallery(key)` (`@/lib/queries/galleries`). Данные из БД читаются только внутри `<Suspense>` после `await connection()`.
  Используемые ключи `SiteSettings` (ровно эти имена): `phone` (текст «+7 (900) 068-50-00»), `phoneHref` (готовый href `"tel:+79000685000"` — `href={settings.phoneHref}`, **не** `tel:${…}`), `address` («г. Челябинск, Орджоникидзе 58а к3»), `addressNote` («Горсад им. А.С. Пушкина»), `hours` («Ежедневно 09:00–02:00»), `telegramUrl`, `vkUrl`, `operator: { name; inn; ogrn; address; email }`.
- Task 06 дал `getToday()` из `@/lib/dates`.
- Логотип: файл `public/images/logo.png` (125×106) и `public/images/logo.webp` кладёт задача 15 (та же волна 4, владелец `public/images/logo.{png,webp}`). Шапка ссылается на `/images/logo.png` строкой; эта задача файлы в `public/images/*` **не создаёт и не копирует**.

## Files to Create

- `src/app/(site)/layout.tsx` — layout сайта
- `src/components/site/container.tsx` — `<Container>`
- `src/components/site/section-title.tsx` — `<SectionTitle>`
- `src/components/site/primary-button.tsx` + `primary-button.module.css` — кнопка с «бликом»
- `src/components/site/reveal.tsx` + `reveal.module.css` — появление при прокрутке
- `src/components/site/header.tsx` — шапка (серверная обёртка + данные настроек)
- `src/components/site/header-nav.tsx` — закрепляемая навигация (client)
- `src/components/site/mobile-menu.tsx` — бургер и мобильное меню (client)
- `src/components/site/footer.tsx` — футер
- `src/components/site/cookie-consent.ts` — хранение согласия (`localStorage` + cookie `cookie_consent`), хук
- `src/components/site/cookie-banner.tsx` — баннер (client)
- `src/components/site/metrika.tsx` — загрузка Метрики после согласия (client)
- `src/components/site/social-icons.tsx` — иконки Telegram и VK
- `src/components/site/back-to-top.tsx` — кнопка «наверх» (client)

## Files to Modify

- `src/app/not-found.tsx` — переписать в стиле старой 404 (шапка и футер подключаются явно: корневой `not-found` рендерится вне layout `(site)`)

## Technical Details

### Implementation Steps

1. Изучить старый сайт: `C:\OSPanel\home\74.loc\blokcs\header.php` (разметка шапки), `blokcs\footer.php` (футер, cookie-баннер, кнопка «наверх»), `404.php`, а в `C:\OSPanel\home\74.loc\public\themes\piramida\assets\css\main.css` — значения оттуда: `.md-main-color-btn` (817–885), `@keyframes blick` (672), `.header*` и `.nav-wrap*` (7884–8260 и далее ~8257–8430), `.header__btn` (бургер, ~7947–8000), `.footer*` (7001–7240), `.to-top` (13084–13125), `#cookie_notification` (18830–18870), `.first.md-error-page` (6861–6890), `@keyframes pulse_1`/`wave_*` (398, 545). Размеры в оригинале заданы в `vw` при ширине 1920 (1vw = 19.2px): переводить в `clamp(min, vw, max-при-1920)`, верхний предел — значение при 1920 (шрифты дальше не растут).

2. **Строительные блоки.**
   - `Container`: `<div className={cn("mx-auto w-[86vw] md:w-[81vw] max-w-[1552px]", className)}>` (`as` prop опционален). Блок календаря шире (91vw) — делает задача 20 сам.
   - `SectionTitle({ as = "h2", align = "left", children, className })`: `text-[clamp(20px,3.125vw,60px)] leading-[1.333] font-semibold text-foreground`, при `align="center"` — по центру. Для H1 — проп `as="h1"` с размером `clamp(24px,3.385vw,65px)`.
   - `PrimaryButton`: элемент-кнопка/ссылка (`href` → `<a>`/`Link`, иначе `<button>`; `asChild` через Radix Slot), высота `h-[clamp(60px,4.69vw,90px)]`, текст `text-[clamp(12px,1.51vw,29px)] font-bold`, `px-[clamp(24px,2.6vw,50px)]`, `rounded-[clamp(8px,0.6vw,12px)]`, `bg-primary text-primary-foreground hover:bg-primary-dark`, `transition-colors duration-300`, `overflow-hidden relative`; «блик» — CSS Module: псевдоэлемент `::after` с белой полосой `rgba(255,255,255,.7)` под 45°, анимация `blick 3s linear infinite` (`left` от −80% до 160%), при hover полоса скрыта (`opacity: 0`):

```css
/* primary-button.module.css */
.btn { position: relative; overflow: hidden; }
.btn::after {
  content: ""; position: absolute; top: -20%; left: -80%; width: 40px; height: 140%;
  background: rgba(255, 255, 255, 0.7); transform: rotate(45deg); animation: blick 3s linear infinite; pointer-events: none;
}
.btn:hover::after { opacity: 0; }
@keyframes blick { 0% { left: -80%; } 100% { left: 160%; } }
@media (prefers-reduced-motion: reduce) { .btn::after { animation: none; display: none; } }
```
     Если `globals.css` (задача 02) уже содержит keyframes `blick`/утилиту для кнопки — использовать её и не дублировать. Вариант `size="sm"` для кнопки в шапке («Заказать звонок»: `h-[clamp(40px,3.385vw,65px)]`, текст `clamp(13px,1vw,19px)`, `px-6`). Дисейбл — `disabled:opacity-50`.
   - `Reveal({ children, className, delay })` (client): серверный HTML виден сразу (важно для SEO и LCP). В `useEffect`: если элемент ниже нижней границы окна — выставить `data-reveal="hidden"` и наблюдать через `IntersectionObserver` (`rootMargin: "0px 0px -10% 0px"`), при появлении `data-reveal="shown"` и `unobserve`. CSS Module: `[data-reveal="hidden"] { opacity: 0; transform: translateY(clamp(24px, 5.2vw, 100px)); } [data-reveal="shown"] { opacity: 1; transform: none; transition: opacity .5s ease-out, transform .5s ease-out; transition-delay: var(--reveal-delay, 0ms); }`, при `prefers-reduced-motion: reduce` — без анимации и без скрытия. (Намеренное упрощение PLAN §4.1: IntersectionObserver вместо `animation-timeline: view()`.)

3. **Cookie-согласие (`cookie-consent.ts`).** Значения `"all"` (принять) и `"necessary"`; ключ `cookie_consent`.

```ts
export const CONSENT_KEY = "cookie_consent"
export type Consent = "all" | "necessary"
export function readConsent(): Consent | null          // localStorage, fallback — парсинг document.cookie
export function writeConsent(v: Consent): void          // localStorage + document.cookie = `cookie_consent=${v}; Max-Age=31536000; Path=/; SameSite=Lax` (+ "; Secure" на https) + window.dispatchEvent(new Event("cookie-consent-change"))
export function useCookieConsent(): Consent | null | undefined  // useSyncExternalStore: на сервере и до гидрации undefined, затем значение; подписка на "storage" и "cookie-consent-change"
```
   `CookieBanner` (client): показывается, когда `useCookieConsent() === null` (то есть решения нет; при `undefined` — ничего не рендерить, чтобы не мигало). Текст старого сайта, расширенный: «Для улучшения работы сайта мы используем файлы cookie и сервис Яндекс Метрика (в т.ч. Вебвизор). Подробнее — в [политике](/politika). Вы можете принять все или оставить только необходимые.» Кнопки «Принять» (`PrimaryButton size="sm"`, `writeConsent("all")`) и «Только необходимые» (`variant outline`, `writeConsent("necessary")`). Стиль: фиксированная плашка `fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-6 sm:max-w-md`, `rounded-xl bg-white shadow-lg`, `role="dialog" aria-label="Cookie"`, анимация появления `animate-fade-up` из `globals.css` (если есть). Плашка не должна перекрывать кнопку «наверх» (кнопка выше: `bottom-24`).

4. **`metrika.tsx`** (client): рендерит `null`, если `useCookieConsent() !== "all"` или нет `process.env.NEXT_PUBLIC_YM_ID`. Иначе — `<Script id="yandex-metrika" strategy="afterInteractive">` со стандартным кодом `https://mc.yandex.ru/metrika/tag.js` и `ym(ID, "init", { defer: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true, ssr: true })` (опции старого сайта; `defer: true`, чтобы хиты отправлялись вручную). Отдельный `useEffect` по `usePathname()` вызывает `window.ym?.(ID, "hit", location.pathname + location.search)` при каждой смене пути, включая первый (после загрузки скрипта: если `window.ym` ещё нет — поставить в очередь через `ym.a` стандартным способом, т.е. вставить в inline-код `ym` заглушку, как в официальном сниппете). `<noscript>`-пиксель не добавлять (он работает без согласия). Скрипт не должен выполняться до согласия (проверить: без согласия в Network нет запросов к `mc.yandex.ru`).

5. **Шапка.**
   - `header.tsx` — серверный компонент без данных вне `<Suspense>`:

```tsx
export function SiteHeader() {
  return (
    <Suspense fallback={<HeaderView settings={SETTINGS_DEFAULTS} />}>
      <HeaderWithSettings />
    </Suspense>
  )
}
async function HeaderWithSettings() { await connection(); return <HeaderView settings={await getSettings()} /> }
```
     Так статическая оболочка (с дефолтными контактами) пререндерится при `next build` без БД, а актуальные значения подставляются в рантайме.
   - `HeaderView` (серверный, чистый): верхняя часть — `Container` с flex: логотип (`next/image` `/images/logo.png`, `width=125 height=106`, `priority`, отображаемая ширина `clamp(64px,4.88vw,94px)`, ссылка на `/`), блок адреса (иконка `MapPin` lucide цвета `primary`, три строки: «**г. Челябинск**», `settings.address` без города, `settings.addressNote`), блок «Мы онлайн, **пишите**» с иконкой Telegram (`settings.telegramUrl`, `target="_blank" rel="noopener noreferrer"`, `hover:scale-110`), блок часов (выводится `settings.hours` как есть, например «Ежедневно 09:00–02:00»; в старом сайте было «ПН–ВС: с 9:00 до 2:00») и телефона (`<a href={settings.phoneHref}>{settings.phone}</a>`, `font-bold`, `hover:text-primary`), кнопка «Заказать звонок» — `LeadDialogTrigger kind="callback" block="Шапка сайта" asChild` с `PrimaryButton size="sm"`. Перед текстами «Мы онлайн» и «ПН–ВС» — пульсирующая точка цвета `primary` (Tailwind: `relative flex size-2` с вложенным `animate-ping` и статичной точкой). Верхняя граница верхней части: `border-t border-foreground/[0.07]`.
   - Адаптив: ≥ `lg` (1024px) — всё в одну строку как на десктопе; ниже — показывать только логотип, телефон-кнопку (иконка `Phone`, `aria-label`) и бургер; адрес, Telegram, часы и «Заказать звонок» уходят в мобильное меню.
   - Навигация `header-nav.tsx` (client, `usePathname`): ссылки (на любых страницах якоря должны работать, поэтому `/#...`):

     | Текст | href |
     |---|---|
     | Акции | `/#discount` |
     | Услуги клуба | `/#service` |
     | Турниры | `/#reasons` |
     | Бар и кухня | `/#portfolio` |
     | Прайс-лист | `/#price` |
     | Меню | `/menu` |
     | Калькулятор | `/calculator` |
     | Блог | `/blog` |
     | Контакты | `/#contacts` |

     Стиль пунктов: `text-[clamp(12px,0.73vw,14px)] font-semibold text-muted-foreground hover:text-primary`, активный маршрут (`/menu`, `/calculator`, `/blog*`) — `text-primary`, подчёркивание 1px под ссылкой, при hover сжимается до 60% ширины (`after:` псевдоэлемент с `transition-[width]`). Видна от `lg`; ниже — внутри мобильного меню.
   - Закрепление: навигационная полоса — `sticky top-0 z-40`. На странице она сначала сливается с фоном (`bg-background`), после прокрутки на высоту верхней части получает `bg-nav shadow-sm` (как `.header__nav.fixed` старого сайта). Реализация: сентинел-элемент над полосой + `IntersectionObserver`, состояние `stuck` в client-компоненте. Верхняя часть шапки (логотип/контакты) не закрепляется (как в оригинале), а на мобильных `sticky`-полоса содержит логотип-миниатюру, телефон и бургер.
   - Конвенция для якорей: в `(site)/layout.tsx` обёртка `[&_[id]]:scroll-mt-24`, чтобы закреплённая полоса не перекрывала заголовки секций.

6. **Мобильное меню (`mobile-menu.tsx`, client).** Бургер: три `span` (верхняя 100%, средняя 100%, нижняя 44% ширины) цвета `primary`, толщина `h-0.5`, при `open` верхняя и нижняя поворачиваются в крест (`rotate(±45deg)` с `translate`), нижняя растягивается до 100%, средняя исчезает (`transition-all duration-300`); подпись «Меню сайта» (мелкий текст слева, как в оригинале) только от `sm`. Кнопка: `<button aria-expanded aria-controls aria-label="Меню">`, размер зоны нажатия ≥ 44px, `z-[60]` (выше оверлея, чтобы превращаться в крестик). Панель: shadcn `Sheet` (`side="right"`, ширина `min(88vw, 380px)`, фон `bg-nav`, без встроенной кнопки закрытия) — список ссылок из таблицы выше (крупно, `text-lg font-semibold`), под ним блок контактов (адрес, часы, телефон-ссылка), Telegram/VK иконки, `LeadDialogTrigger kind="callback" block="Шапка сайта"` с `PrimaryButton`. Закрывается по клику на ссылку, Esc, смене маршрута (`usePathname`), фокус возвращается на бургер. Компонент получает `settings` пропсом.

7. **Футер (`footer.tsx`).** Фон `bg-footer` (#1a1a1a), текст светлый, `text-[13px]`. Содержимое как в старом: слева «**Copyright © 2019 – {год}**» + «Все права защищены.», справа ссылка «Политика конфиденциальности», дополнительно ссылка «Согласие на обработку ПДн» (`/soglasie`) и строка реквизитов оператора (`settings.operator.name`, `ИНН …`), если заполнены. Ссылка на политику открывает `PolicyDialog` с документом из `getCurrentLegalDocument('policy')` (`<PolicyDialog title={policy.title || "Политика конфиденциальности"} markdown={policy.text}>`; `text` уже подставлен, `render`/замену плейсхолдеров не делать); пока документ грузится или его нет — обычная ссылка на `/politika`. Год вычисляется **только в динамической части**: `new Date()` в серверном компоненте без `await connection()` ломает prerender при `cacheComponents`, поэтому:

```tsx
export function SiteFooter() {
  return (
    <footer className="bg-footer …">
      <Container>
        <Suspense fallback={<FooterContent year={null} policy={null} settings={SETTINGS_DEFAULTS} />}>
          <FooterWithData />
        </Suspense>
      </Container>
    </footer>
  )
}
async function FooterWithData() {
  await connection()
  const [settings, policy] = await Promise.all([getSettings(), getCurrentLegalDocument("policy")])
  return <FooterContent year={getToday().slice(0, 4)} policy={policy} settings={settings} />
}
```
   При `year === null` рендерится «Copyright © 2019». Отступы `py-[clamp(20px,2vw,32px)]`.

8. **`social-icons.tsx`:** экспорты `TelegramIcon`, `VkIcon` (inline SVG, `currentColor`, `className`, `aria-hidden`). Иконку Telegram взять из `C:\OSPanel\home\74.loc\uploads\2024\10\vector-1.svg` (она использована в шапке) — инлайнить, VK — простая SVG-иконка (path из simple-icons). Компонент используют и задачи 21 (контакты).

9. **`back-to-top.tsx`** (client): кнопка `fixed bottom-6 right-6 z-40`, круг `size-12 md:size-16` (64px на десктопе, как в оригинале), `bg-primary text-white`, иконка `ArrowUp`, появляется (`opacity`/`pointer-events`) после прокрутки > 400px, `window.scrollTo({ top: 0, behavior: "smooth" })` (при `prefers-reduced-motion` — без плавности), `aria-label="Наверх"`. Отслеживание скролла — `passive` слушатель с `requestAnimationFrame`.

10. **`(site)/layout.tsx`:**

```tsx
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground [&_[id]]:scroll-mt-24">
      <a href="#main-content" className="sr-only focus:not-sr-only …">Перейти к содержимому</a>
      <SiteHeader />
      <main id="main-content" className="flex-1">{children}</main>
      <SiteFooter />
      <BackToTop />
      <CookieBanner />
      <Metrika />
    </div>
  )
}
```
    Layout не содержит `generateMetadata`; метаданные и JSON-LD по умолчанию — задача 23.

11. **`not-found.tsx`** (корневой, вне `(site)`): серверный компонент: `<SiteHeader />`, hero-секция (как `.first.md-error-page`: скруглённая `rounded-[25px]`, отступ `mx-[1vw]`, фон — тёмно-зелёный градиент `from-primary-dark to-primary`, поверх, если есть, картинка галереи `hero` через `<Suspense fallback={null}>`: `await connection()` → `getGallery("hero")` → `<Picture priority … className="absolute inset-0 size-full object-cover opacity-60" />`), бейдж «Русский бильярд» (`bg-badge text-badge-fg`, без typed-анимации), `h1` «Страница не найдена!» (белый, `clamp(24px,3.4vw,65px)`), текст «Возможно, это связано с обновлением нашего сайта и ссылка устарела. Вы можете перейти на главную страницу или воспользоваться формой бронирования.», две кнопки: «На главную» (`PrimaryButton href="/"`) и «Забронировать стол» (`LeadDialogTrigger kind="booking" block="Страница 404" asChild` + кнопка-outline на тёмном фоне), затем `<SiteFooter />` (+ `CookieBanner`/`Metrika` не нужны). `export const metadata = { title: "Страница не найдена" }`.

### Code Snippets

Использование строительных блоков в секциях (задачи 20–25):

```tsx
<section id="discount" className="py-[clamp(32px,5vw,96px)]">
  <Container>
    <Reveal><SectionTitle>Специальные предложения</SectionTitle></Reveal>
    …
    <PrimaryButton href="/menu">Меню</PrimaryButton>
  </Container>
</section>
```

### Environment Variables

- `NEXT_PUBLIC_YM_ID` — id счётчика Метрики (build arg, `106365667`); без него Метрика не подключается.
- `NEXT_PUBLIC_SITE_URL` — абсолютные ссылки.

## Acceptance Criteria

- [ ] `(site)/layout.tsx` оборачивает страницы сайта в шапку, `<main id="main-content">`, футер, кнопку «наверх», cookie-баннер и Метрику; есть skip-link.
- [ ] Шапка на 1920 и 320 визуально соответствует старой: логотип, адрес, «Мы онлайн, пишите» + Telegram, часы, телефон-ссылка, «Заказать звонок» (открывает диалог `callback` с `block="Шапка сайта"`); ниже 1024px остаётся логотип, телефон и бургер.
- [ ] Навигация содержит якоря (`/#discount`, `/#service`, `/#reasons`, `/#portfolio`, `/#price`, `/#contacts`) и ссылки `/menu`, `/calculator`, `/blog`; якоря работают и с внутренних страниц (переход на `/` с прокруткой к секции), заголовки не перекрываются закреплённой полосой.
- [ ] Полоса навигации закрепляется при прокрутке и меняет фон на `nav` с тенью; бургер анимируется в крест, мобильное меню закрывается по ссылке, Esc и смене маршрута, фокус управляется корректно.
- [ ] Данные шапки/футера берутся из `getSettings()` в `<Suspense>` после `await connection()`; `next build` проходит без БД, а статическая оболочка содержит дефолтные контакты.
- [ ] Год в футере вычисляется в динамической части (`getToday()`), `new Date()` не вызывается во время пререндера; ссылка на политику открывает `PolicyDialog` с текстом из `legal_documents`.
- [ ] Cookie-баннер показывается без сохранённого решения, кнопки «Принять»/«Только необходимые» сохраняют выбор в `localStorage` и cookie `cookie_consent` на 1 год; при повторном визите баннер не показывается.
- [ ] Скрипт Метрики (с webvisor, clickmap, trackLinks, accurateTrackBounce) загружается только после «Принять», на смене маршрута шлёт `hit`; без согласия запросов к `mc.yandex.ru` нет.
- [ ] `PrimaryButton` имеет «блик» (3s linear infinite, скрыт на hover, отключён при `prefers-reduced-motion`), размеры через `clamp()`; `Reveal` не прячет контент без JS и не анимирует при `prefers-reduced-motion`; `Container`/`SectionTitle` соответствуют размерам из legacy-notes (контейнер 81vw/86vw, максимум 1552px; H2 20→60px).
- [ ] `/несуществующая-страница` показывает 404 в стиле старой (hero, «Страница не найдена!», кнопки, шапка и футер).
- [ ] `pnpm lint` и `pnpm typecheck` проходят; `next build` проходит.

## Notes

- Эффекты, которые **не** переносятся: jQuery, Swiper, Typed.js (бейдж с набором текста — задача 20), `user-select: none`, `outline: none`. Фокус-кольца должны остаться видимыми.
- Карту (grayscale → цвет при hover) и контакты на странице делает задача 21.
- `LeadForm` в диалогах пока оформлен shadcn-кнопкой; при желании задача 13 может позже заменить её на `PrimaryButton`, но контракт `LeadForm` менять нельзя (файл принадлежит задаче 11).
- Верхний предел размеров — 1920px: в `clamp()` максимум = значение оригинала при 1920.
