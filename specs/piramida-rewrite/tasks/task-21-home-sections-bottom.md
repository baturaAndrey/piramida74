# Task 21: Главная — нижние секции («О клубе», бронирование в 3 шага, форма-CTA, контакты и карта)

## Status

complete

## Wave

5

## Description

Четыре нижние секции главной страницы клуба «Пирамида» в порядке старого сайта: «О клубе» (фон-фото и 4 пункта), «Бронирование» (3 карточки-шага), форма «Хотите забронировать стол?» с фоном и фото человека, «Контакты» с картой за click-to-load фасадом. Каждая секция — отдельный файл серверного компонента с `Skeleton`. Внешний вид повторяет старый сайт на 1920 и 320, адаптив — через `clamp()` и брейкпоинты. Страницу `page.tsx` собирает task-27; эта задача её **не создаёт**.

## Dependencies

**Depends on:** task-13-site-layout.md, task-12-public-queries.md, task-11-lead-capture.md, task-09-media-core.md, task-02-design-tokens-layout.md (и транзитивно 03, 06)
**Blocks:** task-27-home-assembly.md, task-28-qa-verification.md

**Context from dependencies:**
- task-02: токены Tailwind v4 в `src/app/globals.css` и `DESIGN.md`. Цвета клуба: основной `#2f6c4a` (hover `#13442e`), текст `#1C1C1C`, фон `#F6F6F6`, приглушённый `#8E8E8E`, зелёный иконок контактов `#31B939`, футер `#1A1A1A`; шрифт Onest. **Откройте `globals.css` и используйте реальные имена токенов** (`bg-primary`, `bg-primary-dark`, `text-muted-foreground`, …); если токена нет — произвольное значение и пометка в отчёте.
- task-13: `src/components/site/{container,section-title,primary-button,reveal}.tsx` (`<Container>` — `max-w-[1552px] w-[86vw] md:w-[81vw] mx-auto`; `<SectionTitle>` — H2 60/80 на 1920, 20/30 на 320, вес 600; `<PrimaryButton>` — зелёная кнопка с «бликом», высота 90/текст 29px на десктопе, 60/12px на мобильном; `<Reveal>` — появление при прокрутке). **Откройте файлы и проверьте пропсы** (`asChild`, `className`, `as`). Шапка закрепляется → корневым `<section>` задать `scroll-mt-24`.
- task-11: `src/components/leads/lead-form.tsx` — `<LeadForm type block formTitle promotionId? tournamentId? hidden? submitLabel? onSuccess? className? />`, где `type: 'callback' | 'booking' | 'promo' | 'calculator' | 'tournament'`, `hidden?: Record<string, string>`, `onSuccess?: (number: number) => void`. Пропсов `fields`/`extra`/`variant` **нет**: видимые поля задаются `type` (`callback` — время звонка + телефон; остальные, в т. ч. `booking`, — имя + телефон). Внутри: серверный Action `submitLead`, honeypot, маска телефона, неотмеченный чекбокс согласия, ошибки, переход на `/spasibo`. `src/components/leads/lead-dialog.tsx` — `<LeadDialogTrigger kind block formTitle? promotionId? tournamentId? asChild? className?>`, `kind: 'callback' | 'booking' | 'promo' | 'tournament'`. Оформление формы в CTA-секции — только через `className` и обёртку; внутренности LeadForm не менять.
- task-09: `<Picture asset sizes alt priority className />`, `MediaAsset`.
- task-12: `getSettings()`, `getGallery(key)`, `getHalls()` из `src/lib/queries/*` (`'use cache'` + `cacheTag`), `src/lib/settings-defaults.ts` (`SiteSettings`). **Прочитайте эти файлы и посмотрите реальные формы данных.** `getGallery(key: string)` → `{ key; title; items: { id; caption: string | null; media: PublicMedia }[] } | null` (неизвестный ключ — `null`, пустая — `items: []`); используемые ключи галерей: `about`, `cta`. Используемые ключи `SiteSettings` (ровно эти, других нет):
  - `aboutTitle: string`, `aboutPoints: { title: string; text: string }[]` (4 шт.);
  - `phone: string` («+7 (900) 068-50-00» — текст), `phoneHref: string` (готовый href `"tel:+79000685000"`; использовать `href={settings.phoneHref}`, **не** `tel:${…}`);
  - `email: string`, `address: string` («г. Челябинск, Орджоникидзе 58а к3»), `addressNote: string` («Горсад им. А.С. Пушкина»), `hours: string` («Ежедневно 09:00–02:00»);
  - `telegramUrl: string`, `vkUrl: string`;
  - `geo: { lat: number; lon: number }` (55.153739, 61.404441), `mapOrgId: string` (oid организации в Яндекс Картах, «47911977113»), `mapConstructorId: string` (значение `um` конструктора **с префиксом** `constructor:`).
  `src/lib/queries/**` менять нельзя.
- Старый сайт для сверки: `C:\OSPanel\home\74.loc` (`index.php`, `public/themes/piramida/assets/css/main.css`).

## Files to Create

В `src/components/site/home/`:
- `about-section.tsx` — `AboutSection`, `AboutSectionSkeleton`
- `booking-steps.tsx` — `BookingSteps`, `BookingStepsSkeleton`
- `cta-form-section.tsx` — `CtaFormSection`, `CtaFormSectionSkeleton`
- `contacts-section.tsx` — `ContactsSection`, `ContactsSectionSkeleton`
- `map-facade.tsx` — клиентский компонент: превью карты + кнопка «Показать карту» → iframe

Статические файлы (копируются из старого сайта, см. шаг 1 ниже) в `public/images/home/` (владелец `public/images/home/*` — эта задача; `cta-bg.webp` и `cta-person.webp` — запасные фото CTA-блока на случай пустой галереи `cta`):
- `cta-bg.webp`, `cta-person.webp`, `work-steps-dark.webp`, `social-telegram.svg`, `social-vk.svg`, `map-preview.webp`

## Files to Modify

Нет. Не создавать `src/app/(site)/page.tsx` (task-27). Не менять `globals.css`, `package.json`, `src/components/ui/*`, `src/lib/queries/**`, компоненты task-11/13.

## Technical Details

### Шаг 1. Статические ассеты (разовая подготовка)

Эти картинки не лежат в БД, поэтому кладутся в `public/images/home/` (не под `/media`). Для CTA-блока они — запасной вариант: основной источник фото — галерея `cta` (см. §3):

```bash
mkdir -p public/images/home
L="/c/OSPanel/home/74.loc"
cp "$L/public/themes/piramida/assets/img/forma-01.webp"                 public/images/home/cta-bg.webp
cp "$L/public/themes/piramida/assets/img/content/work-steps-bd-dark.webp" public/images/home/work-steps-dark.webp
cp "$L/uploads/2024/10/telegram-1.svg"                                  public/images/home/social-telegram.svg
cp "$L/uploads/2024/10/votsapp.svg"                                     public/images/home/social-vk.svg   # файл назван votsapp.svg, но это иконка VK
# фото человека (PNG с прозрачностью 256 КБ) → WebP с альфой, одноразовой командой (sharp уже установлен), скрипт в репозиторий не добавлять:
node -e "require('sharp')(process.argv[1]).resize({width:1100}).webp({quality:80,alphaQuality:90}).toFile(process.argv[2])" "$L/uploads/2024/10/forma-e1729499854343.png" public/images/home/cta-person.webp
```
(в PowerShell замените `$L` на `C:\OSPanel\home\74.loc`). `map-preview.webp`: сделайте снимок карты 1200×620 разовым скриптом на Playwright (установлен в task-01) со страницы `https://yandex.ru/map-widget/v1/?um=constructor%3A9864a7dc77c89400f104990d2234df6daf899d2ffdbc50a6fd4ed2057ebe15e3&source=constructor` и сохраните через sharp как WebP (quality 70, ширина 1200). Если снимок сделать не удалось (нет сети) — фасад использует CSS-заглушку (см. `map-facade.tsx`), `map-preview.webp` не нужен; сообщите об этом в отчёте. SVG-иконки — статика из репозитория, а не загрузка пользователя, запрет SVG на загрузки к ним не относится. Подключайте через `next/image` (для WebP) и обычный `<img>`/`next/image` с `unoptimized` для SVG (с `width`/`height` 44).

### Общие правила

1. Все четыре секции (`AboutSection`, `BookingSteps`, `CtaFormSection`, `ContactsSection`) — **async серверные компоненты без пропсов**: `await connection()` (из `next/server`) → запросы из `src/lib/queries` (`CtaFormSection` читает галерею `cta`). Вызывающая сторона (task-27) оборачивает каждую в `<Suspense fallback={<XSkeleton/>}>`. Никаких `try/catch → []`, `generateStaticParams` не используется.
2. Каждый файл экспортирует и компонент, и `Skeleton` той же высоты (`Skeleton` из `@/components/ui/skeleton`), чтобы не было прыжков layout.
3. Только серверные компоненты, кроме `map-facade.tsx` (`'use client'`). Мобильные «карусели» делаются **CSS scroll-snap без JS**: `flex overflow-x-auto snap-x snap-mandatory gap-4 [scrollbar-width:none] lg:grid …`, карточки `shrink-0 snap-center`; сверху на мобильном подсказка «Листайте влево/вправо» (`text-xs`, иконка `MoveHorizontal`, `lg:hidden`). Точки пагинации старого сайта намеренно опущены.
4. Размеры — как в старом сайте «@1920 → @320», выражены через `clamp(min, vw, max)` (максимум = значение на 1920). Брейкпоинты Tailwind: `md` 768, `lg` 1024, `xl` 1280.
5. Якоря: `id="clientsc"`, `id="worksteps"`, `id="getconsultation"`, `id="contacts"` на корневых `<section>`.
6. Заголовки — `<SectionTitle>` в `<Reveal>`. Только светлая тема; не использовать `user-select:none` и `outline:none`; фокус виден.
7. Для всех интерактивных элементов — доступные имена и видимый `focus-visible`.

### 1. `about-section.tsx` — «О клубе» (`#clientsc`)

Данные: `getSettings()` (`aboutTitle`, `aboutPoints`), `getGallery('about')` (`items[0].media` — фон; `null`/пусто — фон `bg-footer`). Если `aboutPoints` пуст — статические 4 пункта старого сайта: 01 «Русская пирамида» — «игра мастеров, где каждый удар определяет судьбу»; 02 «Американский пул» — «быстро освоить, легко играть, невозможно забыть»; 03 «VIP ЗАЛ» — «где каждая игра становится событием, каждый момент эксклюзивен»; 04 «Авторская кухня» — «гастрономическое искусство от шеф-повара клуба «Пирамида»». Заголовок по умолчанию: «Пирамида — премиальный клуб бильярда в самом центре Челябинска. У нас вы получите комфортный драйв от игры и безупречный сервис.»

Раскладка:
- `<section className="relative mx-[1vw] overflow-hidden rounded-[12px]">` (на 1920 поля ≈19px; на 320 — `mx-2`), `min-h-[clamp(560px,78vw,1500px)]` (на 1920 ≈ 1500px: фото на всю высоту, заголовок вверху, пункты внизу; на 320 ≈ 560px).
- Фон: `<Picture asset={bg} sizes="100vw" className="absolute inset-0 h-full w-full object-cover object-bottom" />` (не `priority`, ленивая загрузка). Пустая галерея — фон `bg-footer`. Поверх: `pointer-events-none absolute inset-0` с градиентами: сверху `bg-gradient-to-b from-white/70 via-transparent to-transparent` на верхние 35% (в исходном фото верх растворяется в белый — текст заголовка тёмный; для новых фото без растворения этого градиента достаточно) и снизу `bg-gradient-to-t from-black/60 via-black/20 to-transparent` на нижние 45% (читаемость белых пунктов; на мобильном сильнее: `from-black/60` на всю нижнюю половину).
- Заголовок: `<Container><SectionTitle as="h2" className="relative z-10 pt-[clamp(24px,4vw,77px)] max-w-[1167px] text-center md:text-left px-2.5 md:px-0">` — цвет по умолчанию `#1C1C1C`, 60/80 на 1920 и 20/30 на 320.
- **Пункты на десктопе (`md+`)** — абсолютно внизу: `absolute inset-x-0 bottom-0 hidden md:flex text-white` внутри полосы шириной контейнера `mx-auto w-[81vw] max-w-[1552px]`; 4 колонки `flex-1 max-w-1/4`, `px-[clamp(20px,2.6vw,50px)] pb-[clamp(24px,3.1vw,60px)]`, у всех кроме первой `border-l border-white/25`. Каждая колонка:
  - номер: круг `40×40` `rounded-full bg-primary` с «01»…«04» (`text-base font-medium`, `mb-5`), позади пульсирующее кольцо (`relative`, `before:absolute before:inset-0 before:rounded-full before:bg-primary before:-z-10 before:animate-ping [animation-duration:2s]`);
  - `title`: `font-semibold text-[clamp(18px,1.25vw,24px)] leading-[1.42]`;
  - `text`: `font-light text-[clamp(14px,1.04vw,20px)] leading-[1.35] pt-[15px]`.
  - **Эффект «выезжания»**: колонка по умолчанию `translate-y-1/4` с текстом `opacity-0`; при `hover:` и `focus-within:` `translate-y-0` и текст `opacity-100` (`transition-[transform,opacity] duration-300`). Колонки `tabIndex={0}` для клавиатуры. Для устройств без hover (планшеты 768–1023 и тачскрины): `[@media(hover:none)]:translate-y-0` и текст сразу `opacity-100`.
- **Пункты на мобильном (`<md`)** — под заголовком в нижней части секции (`absolute inset-x-0 bottom-0 pb-6 md:hidden`): горизонтальная scroll-snap лента с отрицательными полями контейнера `-mx-[7vw] px-[7vw]`, карточка `shrink-0 snap-center w-[78%] text-white` (номер, заголовок 16px/600, текст 13px/300 — всегда видны), над лентой подсказка «Листайте влево/вправо» (белая).
- `aria-labelledby` не нужен; секция имеет заголовок.

`AboutSectionSkeleton`: блок `rounded-[12px] bg-muted` той же высоты.

### 2. `booking-steps.tsx` — «Бронирование» (`#worksteps`)

Данные: `getHalls()` (активные залы по `sortOrder`) и `getSettings()` (`phone`, `phoneHref`). Секция `pt-[clamp(24px,2.9vw,55px)] pb-[clamp(32px,4vw,77px)]`, `<Container>`; заголовок «Бронирование» (`mb-[clamp(16px,2.6vw,50px)]`).

Лента карточек: на `lg+` — `grid grid-cols-3 gap-[clamp(16px,1.6vw,30px)]`; на `<lg` — scroll-snap лента (см. общие правила, `w-[86%] sm:w-[60%]`). Общие стили карточки: `relative overflow-hidden rounded-[12px] min-h-[500px] flex flex-col`, контент `p-[clamp(20px,2.1vw,40px)_clamp(20px,2.3vw,45px)]`.

Общий элемент «плашка шага» `Шаг N`: `inline-flex items-center h-10 px-[19px] rounded-[12px] border border-[#EEEEEE] bg-white text-primary font-semibold text-xl mb-[30px]`.
Заголовок карточки: `font-semibold text-[clamp(22px,1.67vw,32px)] leading-[1.3] mb-[19px]`.

- **Шаг 1** (светлая карточка `bg-white text-foreground`): заголовок «Бронирование столов:»; телефон — ссылка `<a href={settings.phoneHref}>{settings.phone}</a>` (`phoneHref` уже содержит `tel:`): `font-medium text-[clamp(22px,1.56vw,30px)] leading-[1.5] hover:text-primary transition-colors` + тонкая линия снизу (`underline decoration-1 underline-offset-4`); текст «С учетом выбранных вами дат и времени, менеджер подберет свободный стол.» (`text-[clamp(15px,0.94vw,18px)] leading-[1.45] grow`); внизу кнопка: `<LeadDialogTrigger kind="booking" block="Бронирование" formTitle="Бронирование стола" asChild><PrimaryButton className="w-full h-[75px] text-base font-semibold">Забронировать</PrimaryButton></LeadDialogTrigger>`.
- **Шаг 2** («Выберите стол:», тёмная карточка): фон `public/images/home/work-steps-dark.webp` через `next/image` (`fill`, `sizes="(min-width:1024px) 33vw, 86vw"`, `object-cover`, `-z-0`) с запасным `bg-[radial-gradient(120%_120%_at_100%_0%,#2f6c4a_0%,#13442e_40%,#1a1a1a_100%)]`; текст белый. Список `ul` (`mt-[clamp(20px,4vw,77px)] text-[clamp(17px,1.25vw,24px)] leading-[1.67] space-y-0`, маркеры `list-disc pl-5`): **названия активных залов из `getHalls()`** (например «Общий зал», «VIP 1», «VIP 2», «VIP 3»); если у зала `kind = 'common'` — добавить серым `text-white/70` «· {tablesCount} столов». Если залов нет — статика «Русский / Американский / VIP».
- **Шаг 3** («Дополнительно:», тёмная карточка с тем же фоном): список (статика): «Проведение корпоративных и любительских турниров», «Обучение игре на бильярде», «**Продажа бильярдного оборудования и аксессуаров**», «Авторская кухня», «Бар» — тот же стиль списка, `mt-[clamp(20px,4vw,77px)]`, `leading-[1.67]`, текст `text-[clamp(16px,1.15vw,22px)]`.

`BookingStepsSkeleton`: три `Skeleton` по 500px (на мобильном один).

### 3. `cta-form-section.tsx` — «Хотите забронировать стол?» (`#getconsultation`)

Данные: `await connection()` → `getGallery('cta')`. Если в галерее есть элементы: `items[0].media` — фон, `items[1]?.media` — фото человека (если второго элемента нет — фото человека берётся статическое `cta-person.webp`); фон рендерится `<Picture asset sizes="100vw" className="absolute inset-0 size-full object-cover" />`, фото человека — `<Picture … className="object-contain object-bottom" />`. Если галерея `null` или пуста — статика из `public/images/home/` через `next/image`: фон `cta-bg.webp` (`fill`, `object-cover`, `sizes="100vw"`, `placeholder="empty"`), человек `cta-person.webp`. Запасной цвет фона в любом случае `bg-primary-dark`.
Секция: `<section id="getconsultation" className="mx-[1vw] mb-[clamp(24px,2.7vw,52px)] overflow-hidden rounded-[12px] relative text-white">`.

Контейнер: `<Container className="relative">` с вертикальными отступами `py-[clamp(20px,5vw,96px)]` и на мобильном `pb-[310px]`; `min-h-[clamp(0px,36.5vw,700px)]` на десктопе.

Раскладка (`lg+`, `flex justify-between items-stretch`; на мобильном — колонка, текст по центру):
- **Левая колонка** `lg:w-[579px]` (на 1920): подпись «Хотите забронировать стол?» `font-medium text-[clamp(16px,1.25vw,24px)] leading-[1.17] mb-[19px]`; заголовок (`SectionTitle`/H2, 60/80 → 20/30, белый): «Оставьте данные, мы свяжемся с Вами и предложим варианты, которые подойдут именно Вам».
- **Фото человека** (центр, `hidden lg:block absolute left-[clamp(340px,29.8vw,572px)] bottom-0 w-[clamp(300px,26.6vw,511px)] aspect-[511/700] pointer-events-none`): фото из галереи `cta` (`items[1]`) через `<Picture sizes="511px" alt="">`, иначе `next/image` `cta-person.webp` (`fill`, `object-contain object-bottom`, `sizes="511px"`, `alt=""`). На мобильном — внизу секции: `absolute bottom-0 left-1/2 -translate-x-1/2 w-[323px] h-[362px] lg:hidden`, фото обрезано нижним краем секции (`translate-y-[75px]`-эквивалент, `overflow-hidden` у секции).
- **Правая колонка / форма** `lg:w-[400px]` (на мобильном `w-full max-w-[400px] mx-auto`): подзаголовок «Заполните форму» (`font-semibold text-[clamp(20px,1.67vw,32px)] leading-[1.56] mb-[15px]`), затем `<LeadForm type="booking" block="Бильярдная забронировать стол" formTitle="Хотите забронировать стол" submitLabel="Оставить заявку" className="…" />` (других пропсов не передавать). Поля формы (их выводит LeadForm для `type="booking"`): «Ваше имя», «Ваш номер телефона» (маска, `ym-disable-keys`), кнопка «Оставить заявку» на всю ширину (`h-[clamp(52px,4.7vw,90px)]`, текст 24px/600 на десктопе), под ними неотмеченный чекбокс согласия «Согласен с условиями политики конфиденциальности данных» (ссылки на `/soglasie` и `/politika` — делает LeadForm). Высота полей ввода — `clamp(48px,5.2vw,100px)`, `rounded-[12px]`, шрифт Onest (не Inter). Пропса темы у `LeadForm` нет, поэтому для читаемости на тёмном фоне форма обёрнута в карточку `rounded-[12px] bg-white/95 text-foreground p-4 lg:p-5`; внутренности компонента не менять.

`CtaFormSectionSkeleton`: `Skeleton` `rounded-[12px]` высотой `clamp(560px,36vw,700px)`.

### 4. `contacts-section.tsx` — «Контакты» (`#contacts`) и `map-facade.tsx`

Данные: `getSettings()`. Для SEO добавить `<h2 className="sr-only">Контакты</h2>`. Секция `pt-[clamp(24px,2.7vw,52px)] pb-[clamp(32px,4vw,77px)]`, `<Container>`, раскладка `lg:flex lg:justify-between lg:gap-[clamp(24px,3vw,72px)]` (на мобильном колонка).

**Левая колонка** (`lg:w-[280px] shrink-0 flex flex-col justify-between`):
1. Контакты (каждая строка: иконка Lucide `h-6 w-6 text-[#31B939] shrink-0` + текст `ml-3 font-normal text-[clamp(15px,0.99vw,19px)] leading-[1.4]`, `mb-[23px]`):
   - `MapPin` — адрес: первая часть `settings.address` до запятой жирным («**г. Челябинск**») и перенос, остаток обычным («Орджоникидзе 58а к3»), затем `settings.addressNote` в скобках («(Горсад им. А.С. Пушкина)»; пустой — не выводить);
   - `Clock` — `settings.hours` («**Ежедневно** 09:00–02:00»: слово до первого пробела жирным);
   - `Phone` — `<a href={settings.phoneHref}>{settings.phone}</a>`;
   - `Mail` — `<a href={`mailto:${settings.email}`}>{settings.email}</a>`;
   ссылки `transition-colors hover:text-primary`.
2. Блок «Пишите, **мы онлайн**» (`mt-[clamp(32px,5.9vw,114px)]`, подпись `text-base leading-6 mb-4`) + иконка Telegram `42×42` (`public/images/home/social-telegram.svg`, ссылка на `settings.telegramUrl`, `target="_blank" rel="noopener noreferrer"`, `aria-label="Telegram"`).
3. Блок «**Мы в соцсетях**» (`mt-[clamp(20px,2.6vw,50px)]`) + иконка VK `42×42` (`social-vk.svg`, ссылка на `settings.vkUrl`, `aria-label="ВКонтакте"`).
   Hover иконок: `transition-transform duration-300 hover:scale-[1.2]`, между иконками `mr-2.5`.

**Правая колонка** (`lg:flex-1 min-w-0 flex flex-col`):
- Верхняя строка `flex items-center justify-end mb-[19px]` (на мобильном `justify-center mb-3 order-last mt-3`): ссылка «Построить маршрут в навигаторе» — `font-bold uppercase text-primary text-[13px] md:text-base leading-6`, стиль «подчёркивание 1px, при hover сжимается до 60%»: `relative after:absolute after:left-0 after:top-full after:h-0 after:w-full after:border-b after:border-primary after:transition-all after:duration-300 hover:after:w-[60%]`; `href` строится из настроек:

```ts
const { lat, lon } = settings.geo
const oid = settings.mapOrgId
const routeUrl =
  `https://yandex.ru/maps/56/chelyabinsk/?ll=${lon}%2C${lat}&mode=poi` +
  `&poi%5Bpoint%5D=${lon}%2C${lat}&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D${oid}&z=18`;
```
  `target="_blank" rel="noopener noreferrer"`.
- **Карта** (`<MapFacade …/>`): высота `h-[230px] md:h-[420px] lg:h-[clamp(420px,31vw,600px)]`, `rounded-[12px] overflow-hidden`.

**`map-facade.tsx`** (`'use client'`), пропсы `{ umParam: string; previewSrc?: string; title: string }`:
- Начальное состояние `loaded = false`: контейнер `relative h-full w-full`; превью — `next/image` `public/images/home/map-preview.webp` (`fill`, `object-cover`, `sizes="(min-width:1024px) 1200px, 100vw"`, `loading="lazy"`) c классом `grayscale`; поверх по центру кнопка «Показать карту» (`<button type="button">`, стиль основной зелёной кнопки: `rounded-[12px] bg-primary px-8 h-14 text-base font-bold text-white shadow-lg transition-colors hover:bg-primary-dark`, иконка `MapPin`). Если превью недоступно — фон `bg-muted` с центрированной иконкой и адресом.
- После клика `loaded = true`: рендерится `<iframe src={`https://yandex.ru/map-widget/v1/?um=constructor%3A${umParam}&source=constructor`} title="Карта проезда: бильярдный клуб «Пирамида»" loading="lazy" className="h-full w-full border-0 grayscale transition-[filter] duration-300 hover:grayscale-0 [@media(hover:none)]:grayscale-0" allowFullScreen />`; превью и кнопка убираются. Фокус переносится на iframe.
- Значение `umParam` = `settings.mapConstructorId.replace(/^constructor:/, '')` (в настройках хранится с префиксом `constructor:`; в URL префикс добавляется снова как `constructor%3A`). Если `mapConstructorId` пуст — вместо фасада показывается только превью без кнопки и ссылка «Построить маршрут» остаётся.
- Домены `yandex.ru` для iframe уже разрешены в CSP (task-01); ничего в конфигах не менять.

`ContactsSectionSkeleton`: слева 4 строки-заглушки, справа `Skeleton` `h-[230px] md:h-[420px]`.

### Проверка внешнего вида

Сверьте секции со старым сайтом (`C:\OSPanel\home\74.loc`) на ширинах 1920 и 320: порядок, размеры шрифтов, поведение «выезжания» пунктов «О клубе», расположение фото человека, grayscale карты и цветное состояние при наведении. Допустимые отличия: опущены точки пагинации мобильных лент; на тачскринах текст пунктов «О клубе» показан сразу.

## Acceptance Criteria

- [ ] Созданы все файлы из списка (включая ассеты в `public/images/home/`); секции экспортируют серверные компоненты и `…Skeleton`; `page.tsx` не создавался.
- [ ] `AboutSection`, `BookingSteps`, `CtaFormSection`, `ContactsSection` вызывают `await connection()` перед запросами к БД; нет `generateStaticParams` и `try/catch → []`.
- [ ] «О клубе» (`#clientsc`): фон из галереи `about`, заголовок и 4 пункта из настроек (с запасными значениями), на десктопе пункты выезжают при hover/focus (и показаны сразу на устройствах без hover), на мобильном — горизонтальная snap-лента.
- [ ] «Бронирование» (`#worksteps`): 3 карточки; шаг 1 — телефон из настроек и кнопка попапа брони `block="Бронирование"`; шаг 2 — список залов из `getHalls()`; шаг 3 содержит «Продажа бильярдного оборудования и аксессуаров»; на мобильном snap-лента.
- [ ] CTA (`#getconsultation`): фон и фото человека из галереи `cta` (при пустой галерее — статика `public/images/home/cta-*.webp`), `LeadForm type="booking" block="Бильярдная забронировать стол"`, поля имя/телефон, неотмеченный чекбокс согласия; форма читаема на фоне.
- [ ] «Контакты» (`#contacts`): адрес, часы, телефон (`href={phoneHref}`, без двойного `tel:`), email (`mailto:`), иконки Telegram и VK (hover `scale-[1.2]`), ссылка «Построить маршрут…» с `geo.lat`/`geo.lon` и `mapOrgId` из настроек; iframe карты строится из `mapConstructorId` без префикса `constructor:`.
- [ ] Карта: до клика — серое статичное превью (или заглушка) и кнопка «Показать карту», iframe Яндекса не загружается; после клика iframe в grayscale, цветной при наведении.
- [ ] Якоря `#clientsc`, `#worksteps`, `#getconsultation`, `#contacts` присутствуют; нет горизонтального скролла страницы на 320.
- [ ] Новых npm-пакетов нет; файлы вне списка не изменены.
- [ ] `pnpm lint` и `pnpm typecheck` проходят без ошибок.

## Notes

- Телефон на старом сайте показан как «+7 9000-68-5000», в шапке — «+7 (900) 068-50-00»; берётся единое значение `phone` из настроек.
- Фото «О клубе» в старом сайте (`lobbyo.webp`) в верхней части растворяется в белый — поэтому заголовок тёмный. Если администратор загрузит другое фото, верхний градиент `from-white/70` сохранит читаемость.
- Скрыть превью карты за кнопкой нужно ради производительности (Lighthouse Mobile ≥ 90) и 152-ФЗ: до клика запросы на `yandex.ru` не отправляются.
