# Design System — БК «Пирамида»

Дизайн-система сайта бильярдного клуба «Пирамида» (Челябинск) и его админки. Все новые компоненты и страницы **обязаны** использовать эти токены. Источник правды по значениям — `src/app/globals.css`.

## Стек

- Next.js (App Router) + React + TypeScript
- Tailwind CSS v4, конфигурация только в CSS (`@theme inline` в `globals.css`, `tailwind.config.ts` нет)
- shadcn/ui (new-york, base neutral — перекрашен токенами клуба), иконки Lucide React
- Шрифт: **Onest** (cyrillic + latin) через `next/font/google`, переменная `--font-onest`, Tailwind-класс `font-sans`
- **Только светлая тема.** Тёмной темы и переключателя нет; `dark:`-классы не использовать
- Утилита `cn()` из `@/lib/utils`

## Цвета

Семантические токены (shadcn) → цвет клуба:

| Токен | Значение | Применение |
|---|---|---|
| `background` | `#f6f6f6` | Фон страницы |
| `foreground` | `#1c1c1c` | Основной текст |
| `card` / `popover` | `#ffffff` | Карточки, диалоги, выпадающие списки |
| `primary` | `#2f6c4a` | Основной зелёный: кнопки, ссылки, акценты |
| `primary-foreground` | `#ffffff` | Текст на primary |
| `secondary` | `#f5f8f9` | Вторичные кнопки, закреплённая шапка |
| `muted` | `#f8fafb` | Приглушённые фоны |
| `muted-foreground` | `#8e8e8e` | Приглушённый текст (крупный/декоративный; для мелкого текста — `text-subtle`) |
| `accent` / `accent-foreground` | `#e8f1ec` / `#13442e` | Hover-фоны, выделение |
| `destructive` | `#de2d26` | Ошибки, удаление |
| `border` | `#e4e7e6` | Границы |
| `input` | `#d6dbd9` | Границы полей |
| `ring` | `#2f6c4a` | Фокус |
| `chart-1..5` | `#2f6c4a #31b939 #fecb17 #de2d26 #13442e` | Графики |
| `sidebar*` | см. `globals.css` | Сайдбар админки (фон `#f5f8f9`, активный пункт `accent`) |

Клубные токены:

| Класс | Значение | Применение |
|---|---|---|
| `bg-primary-dark` | `#13442e` | Hover основной кнопки |
| `bg-nav` | `#f5f8f9` | Закреплённая шапка, мобильное меню |
| `bg-footer` | `#1a1a1a` | Футер |
| `text-subtle` | `#6c6c6c` | Мелкий вторичный текст (текст акций); контраст AA на белом |
| `text-bar-text` | `#9b9b9b` | Текст в блоке бара (на тёмном фоне) |
| `text-accent-red` / `bg-accent-red` | `#de2d26` | Кнопка «Узнать условия» |
| `text-date` | `#d43228` | Даты турниров |
| `bg-badge` / `text-badge-foreground` | `#fecb17` / `#352b07` | Бейдж в hero |
| `text-success` / `bg-success` | `#31b939` | Иконки контактов, успех |
| `bg-table-head` | `#1c1c1c` | Шапка таблиц прайса |
| `bg-row-alt` | `#f8fafb` | Чередующиеся строки (с `bg-card`) |
| `bg-dot` | `#ececec` | Неактивные точки пагинации (активная — `bg-primary`) |

Статусы в админке: успех — `text-success`, ошибка — `text-destructive`, предупреждение — `bg-badge`/`text-badge-foreground`.

## Типографика

Шрифт один — Onest. Размеры адаптивные (`clamp`), значения: мобильный (320 px) → десктоп (1920 px, дальше не растут).

| Класс | Размер | Применение |
|---|---|---|
| `text-h1` | 24 → 65 px, lh 1.3 | H1 hero (вес 600, белый, по центру на мобильном) |
| `text-h2` | 20 → 60 px, lh 1.35 | Заголовки секций (вес 600) |
| `text-calendar-title` | 20 → 55 px | Заголовок календаря |
| `text-card-title` | 16 → 48 px | Заголовок карточки услуги (вес 600) |
| `text-promo-title` | 16 → 40 px | Заголовок акции (вес 700) |
| `text-price` | 20 → 40 px | Цена «от 580 ₽/час» (вес 700) |
| `text-hero-sub` | 12 → 30 px | Подзаголовок hero (вес 500) |
| `text-badge-size` | 15 → 30 px | Бейдж в hero (вес 500); суффикс `-size`, т. к. `text-badge` — цвет |
| `text-popup-title` | 20 → 35 px | Заголовок попапа (вес 700) |
| `text-body-lg` | 14 → 18 px | Основной текст страниц |
| `text-btn` | 12 → 29 px | Текст основной кнопки (вес 700) |
| `text-sm` / `text-xs` | 14 / 12 px | Админка, подписи, таблицы; меню шапки — 14 px вес 600; футер — 13 px |

Веса: `font-medium` 500, `font-semibold` 600 (заголовки), `font-bold` 700 (цены, кнопки). **Не** отключать выделение текста (`user-select: none`) и фокус (`outline: none`).

## Контейнеры и отступы

**Сетка:** рамка 1920 px по центру + боковое поле `--gutter` (CSS-переменная в `:root`, `globals.css`):

| Ширина экрана | `--gutter` |
|---|---|
| ≥1366 | 70 px |
| 1101–1365 | 40 px |
| 600–1100 | 24 px |
| ≤599 | 16 px |

Шире 1920 px вёрстка не растёт: рамка центрируется, по бокам — фон страницы. Ширины считаются от родителя (`100%`), а не от `vw`, поэтому полоса прокрутки не даёт горизонтального скролла.

| Утилита | Значение |
|---|---|
| `container-site` (компонент `Container`) | Контент: `width: 100%; max-width: 1920px; margin-inline: auto; padding-inline: var(--gutter)`. Шапка, футер и все секции |
| `px-gutter` | Только боковое поле, без ограничения ширины |
| `container-frame` | Скруглённый фото-блок (hero, «О клубе», форма заявки, 404, /spasibo): внутри рамки 1920 с отступом `--frame-inset` = `clamp(8px, 1vw, 19px)` от её краёв |
| `px-gutter-framed` | Поле внутри `container-frame` (`--gutter − --frame-inset`): текст фото-блока стоит на той же вертикали, что и контент остальных секций |
| `bleed-gutter` | Горизонтальная лента «в край» (мобильные scroll-snap списки, липкая панель меню): выходит на поле и компенсирует его отступом |
| `max-w-md` | Формы входа и попапы |
| `max-w-4xl` | Текстовые страницы (политика, статьи) |

Вертикальные отступы секций: `py-10 md:py-16 lg:py-24`; плотные блоки админки — `space-y-4`/`space-y-6`, карточки `p-4 md:p-6`.

Брейкпоинты стандартные Tailwind: `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Целевые ширины проверки: 1920, 1440, 768, 375/320. Верхний предел вёрстки — 1920 px.

## Скругления и тени

- `--radius` = 12 px (`rounded-lg`); `rounded-md` — кнопки, поля, выпадающие списки; `rounded-lg` — карточки, диалоги; `rounded-hero` = 25 px — hero-блок; `rounded-full` — бейджи, круглые стрелки (64 px), «+» аккордеона
- Тени — стандартные Tailwind: `shadow-xs` поля, `shadow-sm` карточки, `shadow-md` hover и выпадающие, `shadow-lg` диалоги

## Эффекты и анимации

| Эффект | Реализация |
|---|---|
| «Блик» основной кнопки | `primary-shine` + `animate-blick` (globals.css): мягкий размытый отсвет — псевдоэлемент 64 px шириной и 340% высоты кнопки, `linear-gradient(90deg, rgba(255,255,255,0) → rgba(255,255,255,.55) → rgba(255,255,255,0))`, `filter: blur(9px)`, поворот 45°, под текстом (`z-index: -1` в `isolation: isolate`), кнопка `overflow: hidden`. Анимация `left` от −100 px до `calc(100% + 60px)`: 3.9 s ease-out infinite, проход на 12–45% цикла, остальное — пауза (как в billiard-darom); при hover фон `bg-primary-dark`, блик скрыт. Не переводить на `transform`: десяток композитных слоёв даёт длинную блокировку главного потока в headless Chrome (Lighthouse) |
| Появление секций | класс `reveal` (CSS `animation-timeline: view()`), fallback `reveal-fallback` + IntersectionObserver (`components/site/reveal.tsx`); сдвиг ≈100 px → 0, 0.5 s |
| Подчёркивание ссылок | `link-underline`: 1 px, при hover сжимается до 60% |
| Иконки соцсетей | `hover:scale-110` + `transition-transform` |
| Печать текста в hero | `animate-caret` (курсор) + небольшой хук |
| Пульсирующие точки (/spasibo) | `animate-pulse-dot` |
| Общие | `animate-fade-in`, `animate-fade-up`, `animate-scale-in`; tw-animate-css для диалогов и меню |

При `prefers-reduced-motion: reduce` блик, печать, появление и пульсация отключаются.

## Компоненты (shadcn/ui, `src/components/ui/`)

- **Button**: варианты `default` (primary), `secondary`, `outline`, `ghost`, `destructive`, `link`; размеры `sm` h-8, `default` h-9, `lg` h-10, `icon`. Крупная кнопка сайта — `PrimaryButton` (`components/site/primary-button.tsx`): высота 60 px мобильный / 90 px десктоп, `text-btn font-bold`, `bg-primary`, блик
- **Card**, **Input/Textarea** (h-9, `rounded-md`, `shadow-xs`, фокус `ring-[3px] ring-ring/50`), **Select**, **Checkbox**, **Switch**, **Tabs**, **Dialog/AlertDialog/Sheet**, **Table** (шапка `bg-table-head text-white`, чередование `bg-card`/`bg-row-alt`), **Accordion** (прайс: круглая кнопка «+»), **Carousel** (embla; точки 15 px, стрелки-круги 64 px), **Sidebar** (админка), **Sonner** (тосты, `theme="light"`)
- Поля форм на сайте — шрифт Onest (не Inter/Arial), класс `ym-disable-keys` на имени и телефоне
- Disabled: `disabled:pointer-events-none disabled:opacity-50`
- Иконки — Lucide, размеры `size-4` (по умолчанию), `size-5`, `size-6`; крупные иллюстрации `size-16`

## Раскладка

Структура layout'ов:

- Root layout (`src/app/layout.tsx`, задача 02): только `<html lang="ru">` + `<body>` (класс шрифта Onest) + `{children}` (в `<Suspense>` для Cache Components) + `<Toaster />`. **Без** шапки, футера и `<main>`
- Публичный сайт `src/app/(site)/layout.tsx` (задача 13): `Header` (закреплённая, `bg-nav` при прокрутке) + `<main id="main-content" className="flex-1">` + `Footer` (`bg-footer`, 13 px) + CookieBanner + Метрика
- Админка `src/app/(admin)/admin/layout.tsx` (задача 14), отдельный layout со своим `<main>`: `SidebarProvider` + `AppSidebar` + контент `p-4 md:p-6`, заголовки `text-2xl font-bold`, плотные формы
- Страницы входа: `flex min-h-screen items-center justify-center p-4` → `Card max-w-md`
- Страница 404 (`src/app/not-found.tsx`): hero-блок в рамке `container-frame` (`rounded-hero`, градиент `from-primary-dark to-primary` + фото галереи `hero`), шапка и футер подключены явно — корневой not-found рендерится вне layout `(site)`

### Root Suspense

Глобальный `<Suspense fallback={null}>` вокруг `children` в root layout **оставлен намеренно**. Общие клиентские компоненты `HeaderNav` (шапка сайта), `AdminSidebar` и `Metrika` вызывают `usePathname()`. На маршрутах с динамическими параметрами (`/blog/[slug]`, `/authors/[slug]`, `/admin/*/[id]`) это считается обращением к данным запроса, и Cache Components требует границы Suspense выше компонента. Без глобальной обёртки `next build` падает (проверено в задаче 28 на `/admin/banquet-sets/[id]`).

Данные страниц при этом всё равно читаются в собственных `<Suspense>` секций со skeleton'ами — так у каждой страницы есть осмысленный статический shell. Глобальную обёртку можно убрать, только если сначала перенести чтение `usePathname()` в отдельные клиентские острова внутри своих `<Suspense>`.

## Брендинг

- Логотип: `/images/logo.png` (+ `/images/logo.webp`, 125×106; шапка), фавиконы и манифест: `/icons/*`
- Hero: фон-фото внутри рамки 1920 (`container-frame`, отступ `--frame-inset` по бокам), скругление `rounded-hero`; текст — по полю сетки (`px-gutter-framed`)
- «Календарный план» (`#reasons`): с `lg` две колонки в `container-site` — sticky-блок слева (`min(35.7vw, 686px)`) и список; в строке колонка даты фиксированной ширины (дата прижата вправо, к обложке) + обложка на остальную ширину, плашка с названием — внутри обложки у нижнего левого угла. Мобильный: дата над обложкой на всю ширину
- Карта в блоке контактов: `grayscale`, при hover цветная
- Подпись «Пирамида — премиальный клуб бильярда» не меняется; язык интерфейса — русский
