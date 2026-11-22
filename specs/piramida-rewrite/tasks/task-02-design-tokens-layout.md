# Task 02: Дизайн-токены, шрифт Onest, DESIGN.md, root layout, фавиконы

## Status

complete

## Wave

2

## Description

Переводит дизайн-систему репозитория со стартера (нейтральная oklch-палитра, Geist, тёмная тема) на палитру и типографику клуба «Пирамида»: зелёный `#2f6c4a`, шрифт Onest, адаптивная шкала через `clamp()`, эффекты старого сайта («блик» кнопки, появление при прокрутке). Только светлая тема. Здесь же переписывается `DESIGN.md` (по нему, согласно `AGENTS.md`, строится весь UI), делается root layout (`<html lang="ru">`, шрифт, `metadataBase`, иконки), `manifest.ts`, копируются фавиконы, файл подтверждения Яндекс Вебмастера и статические начертания Onest для OG-картинок блога.

## Dependencies

**Depends on:** task-01-starter-cleanup-deps.md
**Blocks:** task-11-lead-capture.md, task-13-site-layout.md (и все задачи UI)

**Context from dependencies:** задача 01 удалила `next-themes`, `ThemeProvider`, `ModeToggle`, поставила все пакеты и shadcn-компоненты в `src/components/ui/`, переписала `src/lib/env.ts` (есть `getClientEnv()` с `NEXT_PUBLIC_SITE_URL`) и в `src/app/layout.tsx` лишь убрала `ThemeProvider` (файл ещё с Geist и текстами стартера). `globals.css` задачей 01 не менялся — в нём oklch-токены и блок `.dark`. Компоненты shadcn используют семантические токены (`bg-background`, `text-muted-foreground`, `bg-primary` …), поэтому достаточно перекрасить токены — компоненты менять не нужно.

## Files to Create

- `public/icons/favicon-16x16.png`, `public/icons/favicon-32x32.png`, `public/icons/apple-touch-icon.png`, `public/icons/android-chrome-192x192.png`, `public/icons/android-chrome-512x512.png` — копии из старого сайта
- `public/yandex_b2d6db0830b1e9ce.html` — подтверждение Яндекс Вебмастера
- `src/assets/fonts/onest-cyrillic-400-normal.woff`, `onest-latin-400-normal.woff`, `onest-cyrillic-700-normal.woff`, `onest-latin-700-normal.woff` — статические начертания для `next/og` (Satori не умеет variable и woff2); потребитель — задача 25

Логотип сюда **не** входит: `public/images/logo.{png,webp}` копирует задача 15 (wave 4), шапка (задача 13) ссылается на `/images/logo.png`.

## Files to Modify

- `src/app/globals.css` — полностью переписать
- `DESIGN.md` — полностью переписать
- `src/app/layout.tsx` — полностью переписать
- `src/app/manifest.ts` — переписать
- `src/app/favicon.ico` — заменить файлом со старого сайта

## Files to Delete

- `src/components/site-header.tsx`, `src/components/site-footer.tsx` — стартовые шапка и футер; после переписывания layout они нигде не используются (шапку/футер сайта делает задача 13 в `src/app/(site)/layout.tsx`)

## Technical Details

### Implementation Steps

1. **Копирование ассетов** (источник — старый сайт `C:\OSPanel\home\74.loc`; **в старом проекте папка называется `public/themes/piramida/assets/img/icon/`**, а не `assets/icon/`):
   - `favicon.ico` → `src/app/favicon.ico` (перезаписать);
   - `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png` → `public/icons/`;
   - `yandex_b2d6db0830b1e9ce.html` (корень старого сайта) → `public/yandex_b2d6db0830b1e9ce.html` без изменений;
   - старый `site.webmanifest` **не копировать** (в нём битые пути и пустое имя) — вместо него `manifest.ts`.
2. **Шрифты для OG** (лицензия Onest — OFL, использование разрешено). Скачать четыре файла (jsDelivr, пакет `@fontsource/onest`, без установки пакета):

   ```bash
   mkdir -p src/assets/fonts && cd src/assets/fonts
   for f in onest-cyrillic-400-normal onest-latin-400-normal onest-cyrillic-700-normal onest-latin-700-normal; do
     curl -fsSL -o "$f.woff" "https://cdn.jsdelivr.net/npm/@fontsource/onest@5/files/$f.woff"
   done
   ```
   Проверить, что каждый файл не пустой. Имена файлов фиксированы контрактом — ровно эти четыре. Потребитель — задача 25 (`opengraph-image`): читает их через `readFile(join(process.cwd(), "src/assets/fonts/<имя>"))` и передаёт в `ImageResponse` как `{ name: "Onest", data, weight: 400 | 700, style: "normal" }` (cyrillic и latin — отдельные записи одного семейства). Попадание каталога в standalone-сборку уже обеспечено задачей 01: `next.config.ts` → `outputFileTracingIncludes: { "/*": ["node_modules/sharp/**/*", "src/assets/fonts/**/*"] }` — `next.config.ts` здесь не трогать.
3. **`src/app/globals.css`** — переписать по образцу ниже. Требования:
   - Только светлая тема: удалить блок `.dark`; добавить `@custom-variant dark (&:is(.dark *));` — класса `.dark` нигде не будет, поэтому все `dark:`-классы в shadcn-компонентах просто не срабатывают (иначе Tailwind v4 включил бы их по `prefers-color-scheme`). `color-scheme: light`.
   - Семантические токены shadcn **сохраняют имена**, меняются значения (таблица в `DESIGN.md`). Добавить клубные токены (`--color-primary-dark`, `--color-nav`, `--color-footer` …).
   - Шкала шрифтов — `--text-*` в `@theme` (генерирует классы `text-h1`, `text-h2` …), значения рассчитаны линейной интерполяцией между шириной 320 (мобильный) и 1920 (макс.), см. таблицу.
   - Ключевые кадры: `blick`, `reveal`, `caret-blink`, `pulse-dot` + оставить `fade-in`, `fade-up`, `scale-in`.
   - Утилиты `container-site`, `container-wide`, `reveal`, `reveal-fallback`, `link-underline`.
   - `@media (prefers-reduced-motion: reduce)` отключает анимации блика, появления и печатания.
   - **Не** ставить `user-select: none` и `outline: none` (баги старого сайта). Фокус-кольцо видимое.
4. **`src/app/layout.tsx`** — переписать (код ниже): `lang="ru"`, Onest (cyrillic+latin, переменная `--font-onest`), `metadataBase`, дефолтные `metadata`, `viewport.themeColor`, иконки, манифест, `<Toaster>`. Разметка root layout — **только** `<html lang="ru"><body className={<класс шрифта Onest>}>{children}<Toaster /></body></html>`. Никаких Header/Footer/`<main>`/JSON-LD: `<main id="main-content" className="flex-1">` вместе с Header и Footer живёт в `src/app/(site)/layout.tsx` (задача 13), админка имеет свой layout `src/app/(admin)/admin/layout.tsx` со своим `<main>` (задача 14), JSON-LD организации добавит задача 23 на главной.
5. **`src/app/manifest.ts`** — код ниже.
6. **`DESIGN.md`** — заменить содержимое текстом из раздела «DESIGN.md» ниже (дословно или с косметическими правками; все токены должны совпадать с `globals.css`).
7. Удалить `src/components/site-header.tsx` и `src/components/site-footer.tsx`; `grep -rn "site-header\|site-footer" src` — других импортов быть не должно.
8. Проверить визуально страницу логина (`pnpm dev`, `/login`): зелёная кнопка, шрифт Onest, фон `#f6f6f6`. Выполнить `pnpm lint`, `pnpm typecheck`, `pnpm build:ci` (при необходимости с фиктивным `POSTGRES_URL`).

### Code Snippets

`src/app/globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";

/* Тёмной темы нет: класс .dark нигде не выставляется, dark:-варианты не срабатывают */
@custom-variant dark (&:is(.dark *));

@theme inline {
  /* --- семантические токены shadcn --- */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  /* --- клубные токены (значения прямо здесь: они не меняются по темам) --- */
  --color-primary-dark: #13442e; /* hover основного зелёного */
  --color-nav: #f5f8f9; /* закреплённая шапка, мобильное меню */
  --color-footer: #1a1a1a;
  --color-subtle: #6c6c6c; /* текст акций, мелкий текст с контрастом AA */
  --color-bar-text: #9b9b9b; /* текст в блоке бара (на тёмном фоне) */
  --color-accent-red: #de2d26; /* «Узнать условия» */
  --color-date: #d43228; /* даты турниров */
  --color-badge: #fecb17; /* бейдж в hero */
  --color-badge-foreground: #352b07;
  --color-success: #31b939; /* иконки контактов, успех */
  --color-row-alt: #f8fafb; /* чётные строки таблицы */
  --color-table-head: #1c1c1c;
  --color-dot: #ececec; /* неактивные точки пагинации */

  /* --- шрифты --- */
  --font-sans: var(--font-onest), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif;

  /* --- скругления --- */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-hero: 25px;

  /* --- типографика: clamp(мин@320px, интерполяция, макс@1920px) --- */
  --text-h1: clamp(1.5rem, 0.988rem + 2.56vw, 4.0625rem); /* 24 -> 65 */
  --text-h1--line-height: 1.3;
  --text-h2: clamp(1.25rem, 0.75rem + 2.5vw, 3.75rem); /* 20 -> 60 */
  --text-h2--line-height: 1.35;
  --text-calendar-title: clamp(1.25rem, 0.8125rem + 2.1875vw, 3.4375rem); /* 20 -> 55 */
  --text-calendar-title--line-height: 1.3;
  --text-card-title: clamp(1rem, 0.6rem + 2vw, 3rem); /* 16 -> 48 */
  --text-card-title--line-height: 1.25;
  --text-promo-title: clamp(1rem, 0.7rem + 1.5vw, 2.5rem); /* 16 -> 40 */
  --text-promo-title--line-height: 1.25;
  --text-price: clamp(1.25rem, 1rem + 1.25vw, 2.5rem); /* 20 -> 40 */
  --text-price--line-height: 1.2;
  --text-hero-sub: clamp(0.75rem, 0.525rem + 1.125vw, 1.875rem); /* 12 -> 30 */
  --text-hero-sub--line-height: 1.5;
  --text-badge: clamp(0.9375rem, 0.75rem + 0.9375vw, 1.875rem); /* 15 -> 30 */
  --text-badge--line-height: 1.3;
  --text-popup-title: clamp(1.25rem, 1.0625rem + 0.9375vw, 2.1875rem); /* 20 -> 35 */
  --text-popup-title--line-height: 1.3;
  --text-body-lg: clamp(0.875rem, 0.825rem + 0.25vw, 1.125rem); /* 14 -> 18 */
  --text-body-lg--line-height: 1.6;
  --text-btn: clamp(0.75rem, 0.5375rem + 1.0625vw, 1.8125rem); /* 12 -> 29 */
  --text-btn--line-height: 1.2;

  /* --- анимации --- */
  --animate-fade-in: fade-in 0.3s ease-out;
  --animate-fade-up: fade-up 0.4s ease-out;
  --animate-scale-in: scale-in 0.2s ease-out;
  --animate-blick: blick 3s linear infinite;
  --animate-caret: caret-blink 1s steps(1) infinite;
  --animate-pulse-dot: pulse-dot 1.4s ease-in-out infinite;
}

:root {
  color-scheme: light;
  --radius: 0.75rem; /* 12px */
  --background: #f6f6f6;
  --foreground: #1c1c1c;
  --card: #ffffff;
  --card-foreground: #1c1c1c;
  --popover: #ffffff;
  --popover-foreground: #1c1c1c;
  --primary: #2f6c4a;
  --primary-foreground: #ffffff;
  --secondary: #f5f8f9;
  --secondary-foreground: #1c1c1c;
  --muted: #f8fafb;
  --muted-foreground: #8e8e8e;
  --accent: #e8f1ec;
  --accent-foreground: #13442e;
  --destructive: #de2d26;
  --border: #e4e7e6;
  --input: #d6dbd9;
  --ring: #2f6c4a;
  --chart-1: #2f6c4a;
  --chart-2: #31b939;
  --chart-3: #fecb17;
  --chart-4: #de2d26;
  --chart-5: #13442e;
  --sidebar: #f5f8f9;
  --sidebar-foreground: #1c1c1c;
  --sidebar-primary: #2f6c4a;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #e8f1ec;
  --sidebar-accent-foreground: #13442e;
  --sidebar-border: #e4e7e6;
  --sidebar-ring: #2f6c4a;
}

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes scale-in { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
/* «блик» основной кнопки: белая полоса под 45°, left от -80% до 160% */
@keyframes blick { from { left: -80%; } to { left: 160%; } }
/* появление секции при прокрутке */
@keyframes reveal { from { opacity: 0; transform: translateY(6.25rem); } to { opacity: 1; transform: none; } }
@keyframes caret-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
/* пульсирующие точки на странице «Спасибо» */
@keyframes pulse-dot { 0%, 100% { transform: scale(0.6); opacity: 0.4; } 50% { transform: scale(1); opacity: 1; } }

@layer base {
  * { @apply border-border; }
  html {
    scroll-behavior: smooth;
    scroll-padding-top: 6rem; /* под закреплённую шапку */
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
  :focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
}

/* @utility объявляются на верхнем уровне (не внутри @layer) */
  /* Основной контейнер сайта: 86vw на мобильных, 81vw с md; не шире 1552px (при 1920) */
  @utility container-site {
    width: 86vw;
    max-width: 1552px;
    margin-inline: auto;
    @media (min-width: 768px) { width: 81vw; }
  }
  /* Широкий блок (календарь): 91vw, до 1747px, прижат вправо */
  @utility container-wide {
    width: 91vw;
    max-width: 1747px;
    margin-left: auto;
  }
  /* Появление при прокрутке: CSS scroll-driven animation */
  @utility reveal {
    @supports (animation-timeline: view()) {
      animation: reveal linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 35%;
    }
  }
  /* Fallback (IntersectionObserver добавляет .is-visible, см. components/site/reveal.tsx) */
  @utility reveal-fallback {
    opacity: 0;
    transform: translateY(6.25rem);
    transition: opacity 0.5s ease-out, transform 0.5s ease-out;
    &.is-visible { opacity: 1; transform: none; }
  }
  /* Подчёркивание ссылки 1px, при hover сжимается до 60% */
  @utility link-underline {
    background-image: linear-gradient(currentColor, currentColor);
    background-repeat: no-repeat;
    background-position: left bottom;
    background-size: 100% 1px;
    transition: background-size 0.2s ease-out;
    &:hover { background-size: 60% 1px; }
  }
@layer utilities {
  .card-interactive { @apply transition-all duration-200 ease-out; }
  .card-interactive:hover { @apply shadow-md -translate-y-0.5; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .animate-blick, .animate-caret, .animate-pulse-dot { animation: none; }
  .reveal { animation: none; }
  .reveal-fallback { opacity: 1; transform: none; transition: none; }
}
```

Если Tailwind v4 в установленной версии не принимает вложенный `@media`/`@supports`/`&:hover` внутри `@utility` — вынести в обычные CSS-правила внутри `@layer utilities` (классы `.container-site`, `.reveal` … с теми же телами). Имена классов должны остаться: `container-site`, `container-wide`, `reveal`, `reveal-fallback`, `link-underline`, `text-h1`, `text-h2`, `text-calendar-title`, `text-card-title`, `text-promo-title`, `text-price`, `text-hero-sub`, `text-badge`, `text-popup-title`, `text-body-lg`, `text-btn`, `rounded-hero`, `animate-blick`, `animate-caret`, `animate-pulse-dot`, `bg-nav`, `bg-footer`, `bg-primary-dark`, `text-date`, `text-accent-red`, `bg-badge`, `text-badge-foreground`, `text-success`, `bg-row-alt`, `bg-table-head`, `bg-dot`, `text-subtle`, `text-bar-text` — на них опираются задачи 11, 13, 20–27.

`src/app/layout.tsx`:

```tsx
import { Onest } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { getClientEnv } from "@/lib/env";
import "./globals.css";

const onest = Onest({
  subsets: ["cyrillic", "latin"],
  variable: "--font-onest",
  display: "swap",
});

const SITE_NAME = "Бильярдный клуб «Пирамида»";
const DESCRIPTION =
  "Бильярдный клуб «Пирамида» в Челябинске: русская пирамида, американский пул, VIP-комнаты, авторская кухня, турниры и обучение. Горсад им. Пушкина, ежедневно 09:00–02:00.";

export const metadata: Metadata = {
  metadataBase: new URL(getClientEnv().NEXT_PUBLIC_SITE_URL),
  title: { default: `${SITE_NAME} в Челябинске`, template: `%s | ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: SITE_NAME,
    title: `${SITE_NAME} в Челябинске`,
    description: DESCRIPTION,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#2f6c4a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={`${onest.variable} min-h-screen antialiased`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
```
`src/app/favicon.ico` подхватывается Next автоматически (file convention). Если `getClientEnv()` на уровне модуля вызывает проблемы с Cache Components — оставить как есть (он синхронный и не читает запрос).

`src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Бильярдный клуб «Пирамида»",
    short_name: "Пирамида",
    description: "Бильярдный клуб в Челябинске: русская пирамида, американский пул, VIP-комнаты, бар и кухня.",
    lang: "ru",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f6f6",
    theme_color: "#2f6c4a",
    icons: [
      { src: "/icons/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
```

### DESIGN.md (новое содержимое файла)

Записать в `DESIGN.md` следующее (Markdown; ниже — полный текст):

````markdown
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

- Root layout (`src/app/layout.tsx`, задача 02): только `<html lang="ru">` + `<body>` (класс шрифта Onest) + `{children}` + `<Toaster />`. **Без** шапки, футера и `<main>`
- Публичный сайт `src/app/(site)/layout.tsx` (задача 13): `Header` (закреплённая, `bg-nav` при прокрутке) + `<main id="main-content" className="flex-1">` + `Footer` (`bg-footer`, 13 px) + CookieBanner + Метрика
- Админка `src/app/(admin)/admin/layout.tsx` (задача 14), отдельный layout со своим `<main>`: `SidebarProvider` + `AppSidebar` + контент `p-4 md:p-6`, заголовки `text-2xl font-bold`, плотные формы
- Страницы входа: `flex min-h-screen items-center justify-center p-4` → `Card max-w-md`
- Страница 404: `container-site py-16`, `max-w-md mx-auto text-center`

## Брендинг

- Логотип: `/images/logo.png` (+ `/images/logo.webp`, 125×106; шапка), фавиконы и манифест: `/icons/*`
- Hero: фон-фото, скругление `rounded-hero`, отступ 1 vw по бокам
- Карта в блоке контактов: `grayscale`, при hover цветная
- Подпись «Пирамида — премиальный клуб бильярда» не меняется; язык интерфейса — русский
````

### Environment Variables

- `NEXT_PUBLIC_SITE_URL` — используется для `metadataBase` (по умолчанию `http://localhost:3000`).

## Acceptance Criteria

- [ ] `src/app/globals.css` без блока `.dark`, с `@custom-variant dark`, клубными токенами, всеми `--text-*` из таблицы, ключевыми кадрами `blick`/`reveal`/`caret-blink`/`pulse-dot`, утилитами `container-site`, `container-wide`, `reveal`, `reveal-fallback`, `link-underline` и блоком `prefers-reduced-motion`
- [ ] Классы из списка (`text-h1`, `bg-nav`, `text-date`, `rounded-hero`, `animate-blick` …) реально генерируются (проверить временным компонентом или `pnpm build:ci` + поиском в CSS-выхлопе)
- [ ] В `globals.css` нет `user-select: none` и `outline: none`
- [ ] `src/app/layout.tsx`: `lang="ru"`, Onest (cyrillic+latin) через `next/font/google`, `metadataBase`, иконки, `viewport.themeColor`, `<Toaster>`; разметка — только `html` + `body` (класс шрифта) + `children` + `Toaster`, нет Header/Footer/`<main>`; нет Geist, нет JSON-LD и текстов стартера
- [ ] `/login` визуально в палитре клуба (зелёная кнопка, шрифт Onest) и без ошибок в консоли
- [ ] `public/icons/*` (5 файлов), `public/yandex_b2d6db0830b1e9ce.html`, `src/app/favicon.ico` — на месте; `/yandex_b2d6db0830b1e9ce.html` отдаётся и содержит `Verification: b2d6db0830b1e9ce`
- [ ] `src/assets/fonts/` содержит 4 непустых `.woff` ровно с именами `onest-cyrillic-400-normal.woff`, `onest-latin-400-normal.woff`, `onest-cyrillic-700-normal.woff`, `onest-latin-700-normal.woff`
- [ ] Задача не создаёт `public/brand/` и не копирует логотип (владелец — задача 15, `public/images/logo.{png,webp}`)
- [ ] `src/app/manifest.ts` возвращает имя «Бильярдный клуб «Пирамида»», иконки из `/icons/`, `theme_color #2f6c4a`; `/manifest.webmanifest` отдаётся
- [ ] `DESIGN.md` переписан под клуб и согласован с `globals.css`; упоминаний Geist, next-themes, oklch-токенов стартера не осталось; раздел «Раскладка» описывает root layout = `html` + `body` + `Toaster`, `(site)/layout.tsx` = Header + `<main id="main-content" className="flex-1">` + Footer, отдельный layout админки; логотип — `/images/logo.png`
- [ ] `src/components/site-header.tsx` и `site-footer.tsx` удалены, импортов нет
- [ ] `pnpm lint`, `pnpm typecheck` и `pnpm build:ci` проходят

## Notes

- Значения `clamp()` — линейная интерполяция 320→1920. Значения мобильных размеров «Заголовок календаря», «Цена», «Текст», «Кнопка 12 px» в старом дизайне частично не заданы — взяты разумные (см. таблицу); при сверке с макетом (задача 28) допускается подстройка только в `globals.css` и `DESIGN.md`.
- Папка с иконками в старом проекте: `public/themes/piramida/assets/img/icon/` (в `PLAN.md` указан сокращённый путь `assets/icon/`).
- `muted-foreground #8e8e8e` на белом даёт контраст ≈3.3:1 (ниже AA) — оставлен, потому что это цвет старого меню; для мелкого полезного текста использовать `text-subtle`.
- Не добавлять `next-themes` и `dark:`-стили. Не вводить `tailwind.config.ts`.
- Файлы `src/app/not-found.tsx` и `error.tsx` (стартовые) не трогать: 404 в стиле старого сайта — задача 13.
