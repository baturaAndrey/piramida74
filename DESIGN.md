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
| `text-badge` | 15 → 30 px | Бейдж в hero (вес 500) |
| `text-popup-title` | 20 → 35 px | Заголовок попапа (вес 700) |
| `text-body-lg` | 14 → 18 px | Основной текст страниц |
| `text-btn` | 12 → 29 px | Текст основной кнопки (вес 700) |
| `text-sm` / `text-xs` | 14 / 12 px | Админка, подписи, таблицы; меню шапки — 14 px вес 600; футер — 13 px |

Веса: `font-medium` 500, `font-semibold` 600 (заголовки), `font-bold` 700 (цены, кнопки). **Не** отключать выделение текста (`user-select: none`) и фокус (`outline: none`).

## Контейнеры и отступы

| Утилита | Значение |
|---|---|
| `container-site` | `86vw` (мобильный) / `81vw` (md+), максимум 1552 px |
| `container-wide` | `91vw`, максимум 1747 px, прижат вправо (блок календаря) |
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
| «Блик» основной кнопки | `animate-blick`: абсолютно позиционированная полоса `rgba(255,255,255,.7)` под 45°, `left` от −80% до 160%, 3 s linear infinite; при hover фон `bg-primary-dark`, блик скрыт |
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
- Страница 404: `container-site py-16`, `max-w-md mx-auto text-center`

## Брендинг

- Логотип: `/images/logo.png` (+ `/images/logo.webp`, 125×106; шапка), фавиконы и манифест: `/icons/*`
- Hero: фон-фото, скругление `rounded-hero`, отступ 1 vw по бокам
- Карта в блоке контактов: `grayscale`, при hover цветная
- Подпись «Пирамида — премиальный клуб бильярда» не меняется; язык интерфейса — русский
