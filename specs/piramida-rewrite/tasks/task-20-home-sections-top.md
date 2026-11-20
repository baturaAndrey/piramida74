# Task 20: Главная — верхние секции (Hero, акции, услуги, календарь, бар, прайс)

## Status

pending

## Wave

5

## Description

Шесть секций главной страницы бильярдного клуба «Пирамида» в порядке старого сайта: Hero, «Специальные предложения» (карусель акций), «Услуги бильярдной» (4 вкладки с галереей и лайтбоксом), «Календарный план» (5 ближайших турниров), «Бар и кухня», «Прайс-лист» (аккордеон). Каждая секция — отдельный файл с серверным async-компонентом, данные берутся из БД через готовые кэшируемые запросы, внешний вид повторяет старый сайт на ширинах 1920 и 320, адаптив делается через `clamp()` и брейкпоинты. Страницу `page.tsx` собирает task-27; эта задача её **не создаёт**.

## Dependencies

**Depends on:** task-13-site-layout.md, task-12-public-queries.md, task-11-lead-capture.md, task-09-media-core.md, task-02-design-tokens-layout.md (и транзитивно 03, 06)
**Blocks:** task-27-home-assembly.md, task-28-qa-verification.md

**Context from dependencies:**
- task-02: `src/app/globals.css` с токенами Tailwind v4 (`@theme`) и `DESIGN.md`. Основной цвет клуба `#2f6c4a` (hover `#13442e`), текст `#1C1C1C`, фон `#F6F6F6`, приглушённый `#8E8E8E`, красный акцент `#DE2D26`, цвет дат `#D43228`, бейдж hero `#fecb17`/`#352b07`, строки таблицы `#F8FAFB`, шрифт Onest. **Откройте `globals.css` и `DESIGN.md` и используйте реальные имена токенов** (ниже они даны как `bg-primary`, `bg-primary-dark`, `text-muted-foreground`, `text-accent-red`, `text-date`, `bg-badge`, `text-badge-fg`, `bg-row-alt`); если токена нет — произвольное значение `bg-[#F8FAFB]` и пометка в отчёте.
- task-13: `src/components/site/container.tsx` (`<Container>` — `max-w-[1552px] w-[86vw] md:w-[81vw] mx-auto`), `section-title.tsx` (`<SectionTitle>` — H2 60px/80 на 1920, 20px/30 на 320, вес 600), `primary-button.tsx` (`<PrimaryButton>` — зелёная кнопка с «бликом»: высота 90/текст 29px/вес 700 на десктопе, 60/12px на мобильном, hover `#13442e`), `reveal.tsx` (`<Reveal>` — появление при прокрутке). **Откройте файлы и проверьте пропсы** (`asChild`, `className`, `as`). Шапка закрепляется, поэтому якоря секций имеют `scroll-mt-[90px]`.
- task-11: `src/components/leads/lead-dialog.tsx` — `<LeadDialogTrigger kind block formTitle? promotionId? tournamentId? asChild? className?>{button}</LeadDialogTrigger>`, `kind: 'callback' | 'booking' | 'promo' | 'tournament'` — клиентский компонент, открывает попап `LeadForm`; `block` и `formTitle` уходят в заявку (`leads.sourceBlock` / `leads.formTitle`). Видимые поля формы задаются типом (`callback` — время звонка + телефон, остальные — имя + телефон); пропсов `fields`/`extra` нет. Здесь используются `kind="booking"`, `kind="callback"` и `kind="promo"` (с `promotionId`).
- task-09: `<Picture asset sizes alt priority className />` (`src/components/media/picture.tsx`), `mediaUrl(asset, w?, fmt?)` (`src/lib/media/url.ts`); `MediaAsset` = `{ id, path, width, height, blurDataUrl, variants, alt, … }`. Варианты ширин 640/1280/1920, форматы avif/webp.
- task-12: `src/lib/queries/*` (`'use cache'` + `cacheTag`): `getSettings()`, `getUpcomingTournaments(opDate, limit=5)`, `getHalls()`, `getTariffs()`, `getExtraServices()`, `getPriceFrom(hallKind)`, `getCarouselPromotions(opDate)`, `getGallery(key)`, `getServices()`; `src/lib/settings-defaults.ts` (тип `SiteSettings` и дефолты). **Прочитайте эти файлы и посмотрите реальные формы возвращаемых данных** (в частности: как приложен `MediaAsset` к галерее, акции и турниру; тип `getPriceFrom`). `src/lib/queries/**` менять нельзя. Используемые ключи `SiteSettings` (ровно эти, других нет): `heroTitle: string`, `heroSubtitle: string`, `heroBadgePhrases: string[]`. Ключей `barTitle`/`barText` в `SiteSettings` **нет** — тексты бара статичные (см. §5). `getGallery(key: string)` → `{ key; title; items: { id; caption: string | null; media: PublicMedia }[] } | null` (неизвестный ключ — `null`, пустая — `items: []`); используемые ключи галерей: `hero`, `service_russian`, `service_pool`, `service_vip`, `service_training`, `bar`. Услуги (`services`, схема task-03): `id`, `key` (`russian | american | vip | training`), `title`, `subtitle?`, `bullets: string[]`, `priceFrom: number | null`, `priceFromHallKind: 'common' | 'vip' | null`, `priceNote?`, `ctaType: 'booking' | 'callback'` (тип попапа CTA), `galleryKey: string | null` (→ `galleries.key`), `sortOrder`.
- task-06: `src/lib/dates.ts` (`getOpDate()`, `formatEventDate`, `minToClock`).
- task-10 (seed) и task-15 (импорт фото) наполняют БД: 3 акции, 4 услуги, галереи hero/услуг/бара, 30 турниров 2026, тарифы.

## Files to Create

Все в `src/components/site/home/`:

- `hero.tsx` — `Hero`, `HeroSkeleton`
- `hero-badge.tsx` — клиентский бейдж с печатающимися фразами
- `use-typing-phrases.ts` — клиентский хук набора текста
- `promotions-carousel.tsx` — `PromotionsCarousel`, `PromotionsCarouselSkeleton` (серверная обёртка)
- `promotions-carousel-client.tsx` — клиентская карусель (embla через shadcn `carousel`)
- `services-tabs.tsx` — `ServicesTabs`, `ServicesTabsSkeleton` (серверная обёртка)
- `services-tabs-client.tsx` — клиентские вкладки
- `lightbox-gallery.tsx` — клиентская сетка фото + `yet-another-react-lightbox` (общая для услуг и бара)
- `tournaments-preview.tsx` — `TournamentsPreview`, `TournamentsPreviewSkeleton`
- `bar-section.tsx` — `BarSection`, `BarSectionSkeleton`
- `price-accordion.tsx` — `PriceAccordion`, `PriceAccordionSkeleton`
- `price-groups.ts` — чистые функции группировки тарифов для аккордеона

## Files to Modify

Нет. Не создавать `src/app/(site)/page.tsx` (владелец task-27). Не менять `globals.css`, `package.json`, `src/components/ui/*`, `src/lib/queries/**`. Если нужного shadcn-компонента (`carousel`, `tabs`, `skeleton`) нет — сообщите в отчёте. Пакеты `embla-carousel-react` и `yet-another-react-lightbox` уже установлены task-01.

## Technical Details

### Общие правила

1. Каждая секция — **async серверный компонент без пропсов**, который сам вызывает `await connection()` (из `next/server`), затем `const opDate = getOpDate()` (если нужна дата) и запросы из `src/lib/queries`. Вызывающая сторона (task-27) оборачивает каждую в `<Suspense fallback={<XSkeleton />}>`. Никаких `try/catch → []`.
2. Файл экспортирует и компонент, и `Skeleton` той же высоты (чтобы не прыгал layout): используйте `Skeleton` из `@/components/ui/skeleton` и фиксированные высоты секций.
3. Интерактивные части (карусель, вкладки, лайтбокс, набор текста) — отдельные `'use client'` файлы; в них передаются только сериализуемые данные (строки, числа, объекты `MediaAsset`).
4. Картинки — только `<Picture>` (`sizes` указывать всегда), hero — `priority`; остальные ленивые. У каждой картинки осмысленный `alt` (из `asset.alt`, иначе из заголовка).
5. Размеры: «десктоп @1920 / мобильный @320» из старого сайта. Выражайте через `clamp(min, vw, max)` с максимумом = значение на 1920 (шрифты и отступы дальше не растут). Брейкпоинты Tailwind: мобильный по умолчанию, `md` 768, `lg` 1024, `xl` 1280.
6. Заголовки секций — `<SectionTitle>` внутри `<Reveal>`; якоря: `id="discount"`, `id="service"`, `id="reasons"`, `id="portfolio"`, `id="price"` на корневом `<section>` (hero id не имеет). Корневым элементам секции задать `scroll-mt-24`.
7. Стили только Tailwind-классами и токенами; без inline-стилей, кроме динамических значений.
8. Только светлая тема. Не использовать `user-select: none` и `outline: none`. Фокус-кольцо должно быть видно.

### 1. `hero.tsx` — Hero

Данные: `getSettings()` (`heroTitle`, `heroSubtitle`, `heroBadgePhrases`), `getGallery('hero')` (первый элемент `items[0].media` — фон; `null`/пустая галерея — фон `bg-footer`).

Разметка и размеры (@1920 → @320):
- `<section>` — **не на всю ширину**: поля по бокам `mx-[1vw]` (≈19px; на 320 — `mx-2`), скругление `rounded-[25px]` (на 320 — `rounded-[12px]`), `overflow-hidden`, `relative`, `mb-[2.6vw]` (50px; на 320 — `mb-6`). Высота по контенту: `min-h-[clamp(520px,40vw,770px)]`, `pb-[clamp(40px,5.3vw,102px)]`.
- Фон: `<Picture priority sizes="100vw" className="absolute inset-0 h-full w-full object-cover" />` (z-0), поверх — лёгкий затемняющий слой `absolute inset-0 bg-black/25` (небольшое осознанное отличие от старого сайта ради читаемости белого текста). Если галерея пуста — фон `bg-footer` (`#1A1A1A`).
- Контент в `<Container>`, `relative z-10`, `pt-[clamp(32px,3.6vw,69px)]`.
- **Бейдж** (`<HeroBadge phrases={…}/>`): `inline-block rounded-[8px] bg-badge text-badge-fg p-4`, `font-medium`, `text-[clamp(15px,1.5625vw,30px)]`, `mb-4`; фиксированная минимальная высота строки, чтобы текст не прыгал; справа мигающий курсор `|` (`animate-pulse`).
- **H1**: `text-white font-semibold text-[clamp(24px,3.385vw,65px)] leading-[1.31]`; ширина `max-w-[992px]` (на мобильном вся ширина контейнера, `text-center`); `mb-[clamp(16px,2.34vw,45px)]`.
- **Подзаголовок**: `text-white font-medium text-[clamp(12px,1.5625vw,30px)] leading-[1.5] max-w-[705px]` (мобильный `text-center`); `mb-[clamp(20px,2.24vw,43px)]`.
- **Кнопка** «Забронировать стол»: `<LeadDialogTrigger kind="booking" block="Первый экран" formTitle="Забронировать стол" asChild><PrimaryButton>Забронировать стол</PrimaryButton></LeadDialogTrigger>` — `PrimaryButton` на десктопе 400×90, на мобильном `w-full h-[60px]`; контейнер кнопки на мобильном по центру.
- Если `PrimaryButton` не принимает `asChild`/ref — оберните триггер вокруг нативной `<button>` со стилями кнопки, повторив её классы (посмотрите `primary-button.tsx`).

**Бейдж с набором текста.**
`use-typing-phrases.ts` (`'use client'`):

```ts
import { useEffect, useState } from 'react';

export function useTypingPhrases(phrases: string[], { type = 60, erase = 30, hold = 1600, gap = 300 } = {}) {
  const [text, setText] = useState(phrases[0] ?? '');      // SSR и первый кадр — полная первая фраза (хороший LCP, нет пустого бейджа)
  useEffect(() => {
    if (phrases.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // без анимации — статичная первая фраза
    let i = 0, pos = phrases[0].length, mode: 'hold' | 'erase' | 'type' = 'hold';
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const cur = phrases[i];
      if (mode === 'hold') { mode = 'erase'; t = setTimeout(tick, hold); return; }
      if (mode === 'erase') {
        pos--; setText(cur.slice(0, Math.max(pos, 0)));
        if (pos <= 0) { i = (i + 1) % phrases.length; mode = 'type'; t = setTimeout(tick, gap); } else t = setTimeout(tick, erase);
        return;
      }
      pos++; const next = phrases[i]; setText(next.slice(0, pos));
      if (pos >= next.length) { mode = 'hold'; t = setTimeout(tick, 0); } else t = setTimeout(tick, type);
    };
    t = setTimeout(tick, hold);
    return () => clearTimeout(t);
  }, [phrases, type, erase, hold, gap]);
  return text;
}
```
`hero-badge.tsx` использует хук и рендерит `<p aria-label={phrases.join(', ')}><span aria-hidden>{text}</span><span className="animate-pulse">|</span></p>`. Фразы по умолчанию: «Русский бильярд», «Американский бильярд», «VIP-комнаты», «Авторское меню», «Обучение бильярду», «Кубок Чемпионат Турниры» (приходят из `heroBadgePhrases`).

`HeroSkeleton`: тот же контейнер с `min-h-[clamp(520px,40vw,770px)]`, фон `bg-muted`, закруглённый.

### 2. `promotions-carousel.tsx` — «Специальные предложения»

Данные: `getCarouselPromotions(opDate)` — акции с `showInCarousel = true`, активные и действующие на `opDate`, у каждой обложка (`MediaAsset | null`). Если акций нет — секция возвращает `null`.

Сервер: `PromotionsCarousel` загружает данные и рендерит `<PromotionsCarouselClient items={…} />`, где `items: { id, title, shortText, cover: MediaAsset | null }[]`.

Секция (`id="discount"`): `pt-[clamp(24px,2.6vw,50px)] pb-[clamp(32px,5vw,96px)]`; заголовок «Специальные предложения» (`SectionTitle`, `mb-[clamp(16px,2.6vw,50px)]`).

Карусель (shadcn `Carousel`, `opts={{ loop: true, align: 'start' }}`):
- **2 карточки в ряд на десктопе (`lg+`), 1 на мобильном**: `CarouselContent className="-ml-8"`, `CarouselItem className="pl-8 basis-[88%] lg:basis-1/2"` (на мобильном виден край следующей карточки, как «листайте» у старого сайта). Если акций меньше 2 — карусель отключена (`loop: false`), стрелки скрыты.
- **Карточка**: `rounded-[12px] bg-white p-[13px_16px] lg:p-[25px] h-full flex flex-col lg:flex-row lg:gap-[clamp(24px,3.4vw,65px)] lg:min-h-[350px]`.
  - Картинка: `Picture` `rounded-[12px] object-cover w-full` высота `h-[225px] lg:h-[300px]`, на десктопе `lg:flex-1`; `sizes="(min-width:1024px) 380px, 88vw"`. Если обложки нет — блок `bg-muted`.
  - Текст (`flex-1 flex flex-col justify-center items-start`): заголовок `font-bold text-[clamp(16px,2.083vw,40px)] leading-[1.12] max-w-[90%]`; `shortText` — `text-[#6C6C6C]` (токен «текст акций»), `text-xs lg:text-[18px] leading-[1.5] py-[10px] lg:py-5` (на мобильном не меньше 12px).
  - Кнопка «Узнать условия»: `<LeadDialogTrigger kind="promo" block={title} formTitle={`Акция: ${title}`} promotionId={id} asChild><button type="button" …/></LeadDialogTrigger>`; стиль — контурная красная: `inline-flex items-center justify-center rounded-[12px] border border-[#E5E4E4] text-accent-red font-semibold transition-colors hover:bg-accent-red hover:text-white hover:border-transparent`, размеры `w-full h-[50px] lg:w-[230px] text-[14px] lg:text-[21px]` (на мобильном `w-[120px] h-[40px] text-xs`).
- **Стрелки**: круглые `64×64`, `rounded-full bg-primary text-white hover:bg-primary-dark`, иконки Lucide `ChevronLeft/ChevronRight` (`h-5 w-5`), позиция `absolute top-1/2 -translate-y-1/2`, слева `-left-[100px]`, справа `-right-[100px]` — **показываются только с `xl` (1280)**, на меньших экранах скрыты (`hidden xl:flex`), `aria-label="Предыдущая акция"/"Следующая акция"`. Отключённое состояние — `opacity-0` не нужен при `loop`.
- **Точки (пагинация)**: ниже карусели `mt-[clamp(20px,3vw,50px)]` по центру, по одной кнопке на `scrollSnapList()`; круг `15×15` (на мобильном 10×10), `mx-[7px]`, фон `#ECECEC`, активная — `bg-primary`; `aria-label="Акция N"`; управление через `carouselApi` (`useEffect` с подпиской `select`/`reInit`).
- Подсказка «Листайте влево/вправо» (`text-xs text-muted-foreground`, иконка `MoveHorizontal`) — только на мобильном (`lg:hidden`) над каруселью.

`PromotionsCarouselSkeleton`: заголовок + два `Skeleton` высотой 350px (десктоп) / один 300px (мобильный).

### 3. `services-tabs.tsx` — «Услуги бильярдной»

Данные: `getServices()` → 4 записи `{ id, key, title, subtitle, bullets: string[], priceFrom: number | null, priceFromHallKind: 'common' | 'vip' | null, priceNote: string | null, ctaType: 'booking' | 'callback', galleryKey }` (по `sortOrder`; поля `description` нет — второй абзац, если есть, лежит в `subtitle`); для каждой с `galleryKey` — `getGallery(service.galleryKey)` (`items[].media` — `MediaAsset`; `null` или пустая → вкладка без фото); вызовы параллельно через `Promise.all`. Автоцена «от»: если `service.priceFrom == null` и `service.priceFromHallKind` задан — `getPriceFrom(service.priceFromHallKind)`. Итоговая цена: `service.priceFrom ?? autoPrice`; если обе пусты — блок цены скрыть. Формат: `От ${n.toLocaleString('ru-RU')}₽/час` (неразрывный пробел перед ₽ не нужен, как на старом сайте: «От 580₽/час»). Тип попапа: `ctaKind = service.ctaType` (без вычисления по `key`); подпись кнопки `ctaLabel`: `booking` → «Забронировать», `callback` → «Оставить заявку»; `block = service.title`, `formTitle = service.title`. Если `getServices()` пуст — вернуть `null`.

Сервер собирает `tabs: { id, title, subtitle, bullets, price: string | null, priceNote, ctaKind: 'booking' | 'callback' /* = service.ctaType */, ctaLabel: string, ctaBlock: string /* = service.ctaBlock → leads.sourceBlock */, images: { asset: MediaAsset; alt: string }[] }[]` и передаёт в `ServicesTabsClient`.

Секция (`id="service"`): `py-[clamp(32px,4vw,77px)]`; заголовок «Услуги бильярдной» (`mb-[clamp(16px,2.6vw,50px)]`).

**Табы** (клиент; `role="tablist"`, кнопки `role="tab"`, `aria-selected`, стрелки ←/→ переключают): ряд из 4 «пилюль»: `rounded-[12px] bg-white text-[#8E8E8E] font-medium transition-colors`, активная `bg-primary text-white`. Размеры: десктоп `w-[300px] px-[30px] py-5 text-[clamp(16px,1.15vw,22px)] leading-[1]` (≈22px), мобильный — горизонтальная прокрутка (`overflow-x-auto flex gap-2 snap-x`), пилюля `shrink-0 px-4 py-2.5 text-sm`. Отступ под рядом `mb-[clamp(20px,3.4vw,65px)]`. Выбранная вкладка в URL не хранится.

**Содержимое вкладки** — двухколоночная раскладка на `lg+` (`flex justify-between items-start gap-5`), на мобильном — одна колонка:
- **Галерея** (`lightbox-gallery.tsx`, слева, `lg:w-[770px]`): первое фото крупно — `aspect-[770/572]` (на мобильном `aspect-[2/1]`, `h` ≈ 144px на 320), `rounded-[12px]`, `mb-5` (на мобильном `mb-1.5`); остальные до 4 миниатюр в ряд — `grid grid-cols-4 gap-[clamp(6px,1vw,20px)]`, каждая `aspect-[177/149] rounded-[12px]`. Все кликабельны → лайтбокс.
- **Карточка** (справа, `lg:w-[768px]`): `rounded-[12px] bg-white p-5 lg:p-12`:
  - `h3` заголовок (`service.title`): `font-semibold text-[clamp(16px,2.5vw,48px)] leading-[1.5] mb-[clamp(10px,2vw,38px)]` (на 1920 — 48px);
  - подзаголовок (`subtitle`, поддерживает переносы строк `whitespace-pre-line`): `text-[#8E8E8E] text-[clamp(13px,1vw,19px)] leading-[1.4] mb-[clamp(13px,1.8vw,35px)]`;
  - список `bullets` (`<ul>`, элементы без маркеров, эмодзи из текста сохраняются): `font-medium text-[clamp(13px,0.94vw,18px)] space-y-[clamp(8px,1.1vw,22px)] mb-[clamp(13px,1.8vw,35px)]`;
  - «Цена:» — `text-[#8E8E8E] text-base mb-2.5`; цена `font-bold text-[clamp(24px,2.08vw,40px)] leading-none` + `priceNote` рядом/под ней `text-sm text-muted-foreground`;
  - кнопка CTA (`ctaLabel`: «Забронировать» / «Оставить заявку») — `<LeadDialogTrigger kind={ctaKind} block={ctaBlock} formTitle={title} asChild>` + `PrimaryButton` на всю ширину карточки (`w-full`; на десктопе высота 90, текст 29px как у основной кнопки — подставьте стандартный размер `PrimaryButton`).

**`lightbox-gallery.tsx`** (`'use client'`): пропсы `{ items: { asset: MediaAsset; alt: string }[]; variant: 'services' | 'bar' }`. Рендерит сетку (первая плитка крупная; для `variant='bar'` вторая строка — до 5 миниатюр `grid-cols-5`), каждая плитка — `<button type="button" aria-label="Открыть фото N">` с `<Picture>`; по клику `open` + `index`. Лайтбокс: `import Lightbox from 'yet-another-react-lightbox'; import 'yet-another-react-lightbox/styles.css';`, `slides` = `items.map(i => ({ src: mediaUrl(i.asset, 1920, 'webp'), alt: i.alt, width: i.asset.width, height: i.asset.height, srcSet: [1280, 1920].map(w => ({ src: mediaUrl(i.asset, w, 'webp'), width: w, height: Math.round(w * i.asset.height / i.asset.width) })) }))`. Закрытие по Esc/клику вне, фокус-ловушка встроена. Импорт стилей лайтбокса делайте внутри этого клиентского файла.

`ServicesTabsSkeleton`: ряд из 4 `Skeleton` (h-14) + блок высотой 572px (десктоп) / 280px (мобильный).

### 4. `tournaments-preview.tsx` — «Календарный план»

Данные: `getUpcomingTournaments(opDate, 5)` — турниры с `endDate >= сегодня`, по возрастанию даты; каждая запись — `title`, `description`, `startDate`, `endDate`, обложка (`MediaAsset | null`; посмотрите реальную форму в `src/lib/queries/tournaments.ts`). Год в подзаголовке — `opDate.slice(0, 4)`.

Секция (`id="reasons"`): `py-[clamp(24px,4vw,77px)]`. Внутренний блок **шире и прижат вправо** (как на старом сайте): `ml-auto w-[91vw] max-w-[1745px]` (на мобильном `w-[86vw] mx-auto`).

Раскладка `lg:flex lg:justify-between lg:items-start` (на мобильном — колонка):
- **Левый sticky-блок** (`lg:w-[686px] lg:sticky lg:top-[88px]` — учтите высоту закреплённой шапки; на мобильном `static w-full text-center`):
  - заголовок «Календарный план» — `font-semibold text-[clamp(20px,2.865vw,55px)] leading-[1.45] mb-[clamp(6px,1.3vw,25px)]` (на 1920 — 55px/80);
  - подзаголовок: «Спортивных соревнований и турниров по бильярдному спорту в {год} году» — `font-medium text-[#8E8E8E] text-[clamp(16px,1.25vw,24px)] leading-[1.4] max-w-[518px] mb-[clamp(13px,2.6vw,50px)]` (мобильный — по центру, `mx-auto`);
  - кнопка «Оставить заявку»: `<LeadDialogTrigger kind="callback" block="Календарный план" formTitle="Календарный план турниров" asChild><PrimaryButton>Оставить заявку</PrimaryButton></LeadDialogTrigger>` (ширина по стандарту `PrimaryButton`);
  - под кнопкой ссылка «Весь календарь →» (`next/link` на `/tournaments`): `mt-6 inline-block text-primary font-semibold underline-offset-4 hover:underline`.
- **Правая колонка** (`lg:flex-1 lg:max-w-[1040px]`, на мобильном `w-full mt-6`): до 5 блоков турниров, `mb-[clamp(10px,2.6vw,50px)]`:
  - блок `relative flex items-start justify-between h-[144px] lg:h-[300px]`;
  - слева дата `text-date font-semibold text-[13px] lg:text-[19px] lg:mt-[148px] pr-[38px]` (`text-date` = `#D43228`), значение — `formatEventDate(startDate, endDate)` («5 марта», «5–7 марта», «30 марта – 2 апреля»); на мобильном дата стоит над картинкой отдельной строкой;
  - обложка `Picture` справа `w-[85%] lg:w-[780px] h-full object-cover rounded-[2px]` (если обложки нет — `bg-muted` с иконкой `Trophy`), `sizes="(min-width:1024px) 780px, 85vw"`;
  - **плашка** поверх картинки: `absolute bottom-[clamp(10px,1.72vw,33px)] -left-[1vw] bg-white/80 rounded-[10px] text-[#1C1C1C] px-[clamp(10px,2vw,38px)] py-[clamp(10px,1vw,19px)] w-[90%] lg:w-[580px]`; название `font-medium text-xs lg:text-[19px]`; описание (если есть) `text-xs lg:text-[18px] leading-[1.5] line-clamp-2`.
- Пустой список: один блок с «—» вместо даты и текстом «В ближайшее время мероприятий не запланировано».
- Карточки турниров не ссылаются никуда (подробности — на `/tournaments`).

`TournamentsPreviewSkeleton`: слева заглушки заголовка/кнопки, справа 3 `Skeleton` высотой 300px (мобильный 144px).

### 5. `bar-section.tsx` — «Бар и кухня»

Данные: `getGallery('bar')` (до 6 фото). Тексты — статические константы в `bar-section.tsx` (в `SiteSettings` ключей для бара нет), из старого сайта: заголовок «🍽️ Изысканная кухня и коктейли от клуба «Пирамида» — гастрономическое путешествие для истинных ценителей», текст «👨‍🍳 Где каждое блюдо — произведение искусства, а каждый глоток — история вкуса. Погрузитесь в мир гастрономических открытий, не покидая игрового стола! Наш бильярд бар создан для тех, кто понимает: настоящий отдых — это симфония вкусов, ароматов и атмосферы.».

Секция (`id="portfolio"`, `pt-[clamp(32px,4vw,77px)] pb-[clamp(24px,2.6vw,50px)]`): `Container`; заголовок «Бар и кухня» (`SectionTitle`, `mb-5`); `LightboxGallery variant="bar"`: первое фото во всю ширину `h-[221px] lg:h-[600px]` (используйте `aspect`/высоту через классы), `rounded-[12px]`, `mb-2 lg:mb-4`; ниже 5 миниатюр `grid grid-cols-5 gap-2 lg:gap-4`, высота `h-[53px] lg:h-[150px]`, `rounded-[12px]`. Затем:
- заголовок блока `font-bold text-[clamp(16px,1.98vw,38px)] leading-[1.32] max-w-[1152px] mt-[clamp(16px,1.8vw,35px)] mb-3.5`;
- текст `text-[#9B9B9B] text-[clamp(13px,0.94vw,18px)] leading-[1.22] max-w-[1152px] mb-4`;
- ряд ссылок `flex flex-wrap items-center gap-x-8 gap-y-2`: «Меню» → `next/link` на `/menu` (стиль «ссылка с подчёркиванием» — `text-primary font-semibold uppercase text-base border-b border-primary pb-px hover:border-b-transparent`) и «Забронировать стол» — `LeadDialogTrigger kind="booking" block="Бар и кухня" formTitle="Бронирование стола" asChild` + кнопка-ссылка в том же стиле.
Если галерея пуста — блок галереи не выводится, остальной контент остаётся.

`BarSectionSkeleton`: `Skeleton` 600px/221px + 5 маленьких.

### 6. `price-accordion.tsx` — «Прайс-лист»

Данные: `getHalls()`, `getTariffs()`, `getExtraServices()`. Фильтр активных на `opDate` тарифов (на случай, если запрос возвращает все): `isActive && (!validFrom || validFrom <= opDate) && (!validTo || validTo >= opDate)`. Группировка — чистые функции в `price-groups.ts` (создать и экспортировать `buildPriceGroups(halls, tariffs, extras)`): 

| Группа | Состав |
|---|---|
| «Бильярд» | тарифы залов `kind = 'common'`, `audience = 'all'` |
| «VIP» | тарифы залов `kind = 'vip'`, `audience = 'all'`; одинаковые строки разных VIP-комнат (те же дни, время, цена) схлопываются в одну; если цены у комнат различаются — слева к дням добавляется название зала («VIP 3 · Ежедневно») |
| «Пенсионный тариф» | тарифы `audience = 'pensioner'` |
| «Прокат» | `extraServices` (название слева, время пусто, цена справа) |
Пустые группы пропускаются.

Формат строки `{ days: string; time: string; price: string }`:
- `days`: множество дней (`0 = Вс … 6 = Сб`) → `[0,1,2,3,4]` «Вс-Чт», `[5,6]` «Пт-Сб», все семь — «Ежедневно», иначе перечисление в порядке `1..6,0` через запятую («Пн, Ср»). Если подряд идущие строки группы имеют те же дни — подпись показывается только у первой (как на старом сайте), у следующих пусто.
- `time`: `` `${minToClock(startMin)}-${minToClock(endMin)}` `` (дефис, как в оригинале; `endMin = 1440` → `09:00`).
- `price`: `per_hour` → `` `${price} руб/час` ``; `fixed` → `` `${price} руб` ``; для услуг `per_session` → `руб`, `per_hour` → `руб/час`. Число — `toLocaleString('ru-RU')` без дробной части.
- Сортировка внутри группы: по первому дню (порядок `[0..4]` раньше `[5,6]` раньше «ежедневно» — используйте `sortOrder` из БД, затем `startMin`).
Результат на seed (должен совпасть со старым сайтом): Бильярд — Вс-Чт 09:00-16:00 **580**, 16:00-02:00 **640**, Пт-Сб 09:00-16:00 **680**, 16:00-02:00 **760**, Ежедневно 02:00-09:00 **3500** руб/час; VIP — 1400 и 4800; Пенсионный — 09:00-12:00 200; Прокат — нарды/шахматы 250, кий 250.

Разметка (`id="price"`, `py-[clamp(32px,4vw,77px)]`, `Container`):
- заголовок «Прайс-лист» (`SectionTitle`, жирный);
- таблица `rounded-[12px] overflow-hidden mb-[clamp(24px,3.1vw,60px)]`;
- **шапка** (только `md+`): `bg-[#1C1C1C] text-white font-semibold text-[24px] leading-8 px-[80px_80px_69px]`-эквивалент: `flex items-center py-10 pl-[69px] pr-20`, колонки «Услуги» `w-[640px] text-left`, «Время» `w-[250px]`, «Стоимость» `w-[280px]`, все центр кроме первой; на `<xl` колонки в пропорциях `grid-cols-[2.5fr_1fr_1.1fr]`;
- **группа** — нативный `<details>` (`group`), `open` только у первой группы; чётность строк: нечётные `bg-row-alt` (`#F8FAFB`), чётные `bg-white`; на мобильном все `bg-row-alt rounded-[12px] mb-2.5`. `<summary>`: `list-none [&::-webkit-details-marker]:hidden cursor-pointer relative px-5 py-[23px] md:py-8 md:pl-[68px] md:pr-20 font-bold text-base md:text-2xl leading-8 pr-14`; справа кнопка-«плюс» (иконка Lucide `Plus`, `aria-hidden`): круг `32×32` (мобильный `26×26`) `absolute top-[18px] right-[21px] md:top-8 md:right-[33px] rounded-full bg-primary text-white flex items-center justify-center transition-transform`, кольцо-пульс `after:absolute after:inset-0 after:rounded-full after:bg-primary after:-z-10 after:animate-ping` (замедлить: `[animation-duration:2s]`); в открытом состоянии `group-open:rotate-45 group-open:scale-[1.3] group-open:bg-white group-open:text-[#D5DEE3] group-open:shadow-[0_0_50px_rgba(0,0,0,.05)]` и без пульса (`group-open:after:hidden`). `aria-label` у summary не нужен (текст внутри).
- **строки** внутри `<details>`: `px-5 md:pl-[105px] md:pr-20 pb-[23px] md:pb-8 pt-0 md:pt-[38px]` и каждая строка `flex md:text-center font-medium text-sm md:text-[18px] leading-8 mb-2.5`: колонки `md:w-[640px] md:text-left | md:w-[250px] | md:w-[280px]` (мобильный: день и время слева, цена справа — `flex flex-wrap justify-between gap-x-3`); цифры цен — `tabular-nums`.
- сноска: `text-[#8E8E8E] text-[13px] md:text-[18px]` «*Стоимость может отличаться от указанной на сайте. **Точную стоимость уточняйте**»; рядом/ниже ссылка «Полный прайс и штрафы» → `/prices` (стиль `text-primary font-semibold underline-offset-4 hover:underline`).

`PriceAccordionSkeleton`: 4 `Skeleton` строк `h-[96px]` под заголовком.

### Проверка внешнего вида

Сверьте секции со старым сайтом (`C:\OSPanel\home\74.loc`) на ширинах 1920 и 320: порядок блоков, размеры шрифтов, цвета, скругления 12px, форму плашки турнира. Отклонения по подсказкам выше (затемнение hero, минимум 12px на мобильном) — допустимы.

## Acceptance Criteria

- [ ] Созданы все файлы из списка; каждая секция экспортирует async серверный компонент без пропсов и `…Skeleton`; `page.tsx` не создавался.
- [ ] Каждая секция вызывает `await connection()` перед обращением к кэшируемым запросам, `opDate` берётся из `getOpDate()` и передаётся аргументом; нет `generateStaticParams` и `try/catch → []`.
- [ ] Hero: фон из галереи `hero` с `priority`, бейдж циклически «набирает» фразы из `heroBadgePhrases` (при `prefers-reduced-motion` статичен), H1/подзаголовок из настроек, кнопка открывает попап брони с `block="Первый экран"`.
- [ ] Карусель акций: 2 карточки на `lg+`, 1 с «выглядывающей» следующей на мобильном, loop, точки 15px (`#ECECEC`/primary), круглые стрелки 64px (только `xl+`), «Узнать условия» открывает попап `kind="promo"` с `promotionId` и `block` = название акции; при отсутствии акций секция не выводится.
- [ ] Услуги: 4 доступные вкладки (с клавиатурой), галерея с крупным первым фото и лайтбоксом (`yet-another-react-lightbox`), заголовок, подзаголовок, пункты, цена «От N₽/час» из `priceFrom` либо `getPriceFrom(priceFromHallKind)`, фото из `getGallery(service.galleryKey)`, CTA с `kind = service.ctaType` и `block` = название услуги.
- [ ] Календарь: до 5 ближайших турниров (`endDate >= сегодня`), красная дата через `formatEventDate`, плашка `bg-white/80` поверх обложки, sticky левый блок на десктопе, кнопка «Оставить заявку» (`block="Календарный план"`), ссылка на `/tournaments`; пустое состояние.
- [ ] Бар: первое фото крупно, до 5 миниатюр, лайтбокс, статические тексты из старого сайта, ссылки «Меню» → `/menu` и «Забронировать стол» (`block="Бар и кухня"`).
- [ ] Прайс: аккордеон на нативном `<details>` (Бильярд, VIP, Пенсионный тариф, Прокат) строится из БД и на seed совпадает со старым сайтом; круглая кнопка «+» с пульсом и поворотом в открытом состоянии; сноска и ссылка на `/prices`.
- [ ] Якоря `#discount`, `#service`, `#reasons`, `#portfolio`, `#price` присутствуют на корневых `<section>`.
- [ ] Внешний вид соответствует старому сайту на 1920 и 320 (см. размеры выше); нет горизонтального скролла страницы на 320.
- [ ] Новых npm-пакетов нет; файлы вне списка не изменены.
- [ ] `pnpm lint` и `pnpm typecheck` проходят без ошибок.

## Notes

- Подпись вкладки услуги берётся из `service.title` (в старом сайте подписи вкладок и заголовков карточек немного различались — «Вип залы» и «Вип Комната»; теперь одно поле).
- `getUpcomingTournaments` принимает `opDate` (операционная дата): до 09:00 турнир, закончившийся вчера, ещё показывается — это допустимо и согласовано с контрактом.
- Для `Picture` без варианта нужной ширины браузер подберёт ближайший из `640/1280/1920` — `sizes` должны быть реалистичными, иначе потеряем LCP.
