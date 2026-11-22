# План: переписать сайт «Пирамида» (Челябинск) на Next.js с админкой, калькулятором и блогом

> Статус: редакция 2 (2026-11-20), учтено ревью. **Раздел 16 имеет приоритет над разделами 1–15 при расхождениях.** Код ещё не менялся.
> Источники: старый сайт `C:\OSPanel\home\74.loc`, макет главной в Paper (файл `piramida74`), прайсы в `res/*.jpg`, блог из `C:\Users\ba2ra\Documents\__WORKS__\billiard-darom`, стартер в этом репозитории.
> Транскрипция `res/` (30 турниров, ~259 позиций меню, 56 штрафов): `specs/piramida-rewrite/data/res-transcription.md`.

---

## 0. Принятые решения

| Тема | Решение |
|---|---|
| Охват | Только Челябинск (74). Кода под несколько городов нет. Поле `city` в заявках = «Челябинск», так как Telegram-чат общий |
| Дизайн | Визуально 1:1 со старым сайтом при ширине 1920 и 320 (макет Paper — справочный). Вместо масштабирования на `vw` — нормальный адаптив: `clamp()`, `max-width`, брейкпоинты sm/md/lg/xl. **Только светлая тема** |
| Шрифт | Onest через `next/font/google`, наборы cyrillic и latin. Inter и Arial в полях формы заменяем на Onest |
| Хостинг | VDS с Dokploy, свой Dockerfile, `output: 'standalone'`, Postgres 18 как сервис Dokploy |
| Картинки | Docker volume `/data/uploads`, при загрузке обработка sharp (WebP и AVIF, 3 ширины), отдача через route handler `/media/[...path]` |
| Админка | 1–2 пользователя с одной ролью `admin`. Better Auth: email и пароль, регистрация закрыта, первый админ создаётся скриптом, 2FA по желанию |
| Подход к админке | Свои страницы на shadcn, Server Actions, zod и react-hook-form. Payload и Directus не используем |
| Данные | Seed из транскрипции `res/`. **Цены аренды берём из `<section id="price">` старого сайта**, а не из JPG. Ночной тариф считается почасово |
| Меню | Отдельная страница `/menu`. На главной блок «Бар и кухня» со ссылкой на неё |
| Калькулятор | Аренда столов + позиции меню + банкетные сеты (их создаёт админ) + отправка заявки. Акции дня показываются только подсказкой и в сумму не входят |
| Заявки | Сохраняются в БД (раздел «Заявки» в админке) + email через российский SMTP + уведомление в Telegram (тот же чат, **новый токен бота**) |
| Блог | Перенос из billiard-darom. Ядро: Markdown, рубрики, теги, оглавление, SEO, JSON-LD, sitemap. Плюс медиатека, видео-шорткоды (VK Видео, Rutube, mp4), авторы-тренеры с CRUD, отложенная публикация, RSS |
| Фото | Переносим из старого сайта, пережимаем. Галереи услуг, бара, hero и акций редактируются в админке |
| Домен | Старый `piramida-billiard-74.ru`, нужны 301-редиректы со старых URL |

---

## 1. Стек

**Оставляем и обновляем:**
- next 16.x, последний patch (≥16.2): `cacheComponents: true`, `output: 'standalone'`
- react 19.2, tailwindcss 4, shadcn/ui (new-york), lucide-react, sonner
- better-auth 1.6.x с плагинами `admin` и `twoFactor`; drizzle-orm 0.44 / drizzle-kit 0.31, драйвер `postgres`
- zod 4

**Добавляем:**

| Пакет | Для чего |
|---|---|
| `react-hook-form` 7, `@hookform/resolvers` 5 | Формы админки |
| `sharp`, `file-type` | Обработка загрузок и проверка magic bytes |
| `nuqs` 2 | Состояние калькулятора в URL |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Сортировка мышью |
| `nodemailer` | Email через Яндекс 360 SMTP |
| `date-fns` (ru), `@date-fns/tz` | Даты в зоне `Asia/Yekaterinburg` (UTC+5) |
| `react-markdown`, `remark-gfm`, `remark-directive` | Блог |
| `react-dropzone` | Медиатека |
| `embla-carousel-react` (через shadcn `carousel`) | Слайдеры вместо Swiper |
| `yet-another-react-lightbox` | Замена Fancybox |
| `vitest`, `@playwright/test` | Тесты: юнит + e2e. В проекте тестов пока нет |

**Удаляем:**
- Пакеты: `ai`, `@ai-sdk/react`, `@openrouter/ai-sdk-provider`, `@vercel/blob`, `@better-auth/api-key`, `pg`, `@types/pg`, `next-themes`
- Код: `src/app/chat`, `api/chat`, `api/diagnostics`, `hooks/use-diagnostics.ts`, `setup-checklist.tsx`, `starter-prompt-modal.tsx`, `ui/github-stars.tsx`, `ui/mode-toggle.tsx`, `(auth)/register`, `sign-up-form.tsx`, `dashboard`, `profile`, `scripts/setup.ts`, `docs/technical/ai`, `docs/technical/betterauth/polar.md`, `.claude/agents/polar-payments-expert.md`
- Скрипты `package.json`: `db:push`, `db:dev`, `db:reset`. Из `build` убрать `db:migrate`
- `env.example` и `src/lib/env.ts`: переменные OPENROUTER, BLOB, POLAR, GOOGLE
- `next.config.ts`: `remotePatterns` для Google, GitHub и Blob
- `docker-compose.yml`: образ `pgvector` заменить на `postgres:18-alpine`

**Переписываем `DESIGN.md`** под реальные токены клуба (раздел 4.1). Сейчас там токены стартера, а `AGENTS.md` требует им следовать.

---

## 2. Архитектура

```
src/
  app/
    (site)/                     # публичная часть, layout: Header + Footer + CookieBanner + Metrika
      page.tsx                  # главная (секции из раздела 4.2)
      menu/page.tsx             # меню: категории, якоря, поиск
      tournaments/page.tsx      # полный календарь сезона (+ архив)
      calculator/page.tsx       # калькулятор (+ блок на главной со ссылкой)
      blog/page.tsx             # список: фильтры, пагинация
      blog/[slug]/page.tsx      # статья или рубрика
      blog/rss.xml/route.ts
      authors/[slug]/page.tsx   # страница тренера/автора
      prices/page.tsx           # аренда, штрафы (бой посуды, порча имущества)
      politika/page.tsx         # политика ПДн
      soglasie/page.tsx         # отдельный документ согласия (156-ФЗ)
      spasibo/page.tsx          # noindex
    (admin)/admin/
      layout.tsx                # sidebar; каждая страница вызывает requireAdmin()
      page.tsx                  # сводка: новые заявки, ближайшие турниры
      leads/                    # заявки: список, статус, карточка
      tournaments/              # CRUD + афиша + серии
      pricing/                  # тарифы, залы, доп. услуги, штрафы
      promotions/
      menu/                     # категории (dnd), позиции, варианты, сетки цен, добавки
      banquet-sets/
      galleries/                # hero, услуги (4 вкладки), бар, «О клубе»
      blog/{articles,rubrics,tags,authors}/
      media/                    # медиатека
      settings/                 # контакты, часы работы, соцсети, SEO по умолчанию, тексты секций
      account/                  # смена пароля, 2FA
    (auth)/login, forgot-password, reset-password
    api/auth/[...all]/route.ts
    api/health/route.ts         # SELECT 1
    media/[...path]/route.ts    # отдача файлов из тома
    sitemap.ts, robots.ts, manifest.ts
  lib/
    db.ts, env.ts, auth.ts, auth-client.ts, session.ts (requireAdmin)
    schema/                     # auth.ts, club.ts, menu.ts, pricing.ts, content.ts, leads.ts, media.ts, settings.ts
    queries/                    # чтение для сайта: 'use cache' + cacheTag
    actions/                    # Server Actions админки: zod → requireAdmin → db → updateTag → audit
    calculator/                 # чистые функции расчёта, общие для клиента и сервера + тесты
    media/                      # сохранение, sharp, варианты, проверки
    notify/                     # email.ts, telegram.ts
    seo/jsonld.ts, slug.ts, dates.ts (formatEventDate по-русски)
  components/
    site/                       # header, footer, hero, promo-carousel, services-tabs, tournaments, bar, price-accordion, about, booking-steps, lead-form, contacts-map
    calculator/
    blog/                       # из billiard-darom
    admin/                      # data-table, sortable-list, image-upload, media-picker, slug-field
    ui/                         # shadcn
scripts/
  migrate.mjs                   # drizzle-orm migrator, запускается в entrypoint
  seed.ts                       # данные из транскрипции res/ и старого сайта
  seed-admin.ts
  import-legacy-images.ts       # старые фото → sharp → том + записи media
```

**Кэш.** Каждая функция в `lib/queries` помечена `'use cache'`, `cacheLife('max')` и `cacheTag(...)`. Теги: `tournaments`, `pricing`, `promotions`, `menu`, `sets`, `galleries`, `settings`, `blog`, `article:<slug>`. Server Action админки вызывает `updateTag(tag)`. Отложенные статьи публикуются через `cacheLife` с коротким сроком на списках блога либо ежечасный cron-route `revalidateTag('blog')` (cron задаётся в Dokploy Schedules).

**Безопасность.** `proxy.ts` только делает оптимистичный редирект `/admin/*` на `/login`. Права проверяются **в каждой** admin-странице и каждом Server Action через `requireAdmin()`.

---

## 3. Схема БД (Drizzle, Postgres)

Общее для всех таблиц, кроме BetterAuth:
- `id uuid defaultRandom`, `created_at`, `updated_at`;
- у редактируемых сущностей `sort_order int` и `is_active bool`;
- цены — `integer` в рублях.

### 3.1 Турниры
- `disciplines` — name, game_type (`russian`/`pool`)
- `tournament_series` — name («Марафон-Промнефтегаз», «Сеньоры Челябинска»), description
- `tournaments`:
  - title, slug, series_id?, stage_number?, discipline_id?
  - level (`regional_championship`/`regional_youth`/`club`/`other`), categories `text[]`
  - start_date `date`, end_date `date` (= start для однодневных)
  - entry_fee?, prize_fund?, description?, cover_media_id?, registration_open bool, is_published
  - Индекс по (end_date)
  - **Фильтр «предстоящие»: `end_date >= today`** (в старом сайте был баг: фильтровали по `start_date`)

### 3.2 Аренда
- `halls` — name («Общий зал», «VIP 1/2/3»), kind (`common`/`vip`), tables_count, seats_per_table (по умолчанию 4, нужно для калькулятора), description
- `rental_tariffs`:
  - hall_kind или hall_id
  - days_of_week `smallint[]`, start_time, end_time (интервал может переходить через полночь)
  - price, price_unit (`per_hour`/`fixed`), audience? (`pensioner`), label, valid_from?, valid_to?
- `extra_services` — нарды/шахматы, прокат кия, тренер; price, price_unit (`per_hour`/`per_session`)
- `penalty_items` — kind (`dishware`/`property`), name, price, price_is_minimum

Seed со старого сайта:

| Зал | Дни | Время | Цена |
|---|---|---|---|
| Общий | Вс–Чт | 09–16 | 580 |
| Общий | Вс–Чт | 16–02 | 640 |
| Общий | Пт–Сб | 09–16 | 680 |
| Общий | Пт–Сб | 16–02 | 760 |
| Общий | ежедневно | 02–09 | 3500/ч |
| VIP | ежедневно | 09–02 | 1400 |
| VIP | ежедневно | 02–09 | 4800/ч |
| Пенсионный | — | 09–12 | 200 |

Прокат — 250 ₽.

### 3.3 Акции
- `promotions`:
  - title, slug, short_text, description (md), cover_media_id
  - discount_percent?, days_of_week?, start_time?, end_time?
  - target (`table_rental`/`menu_category`/`takeaway`/`other`), target_menu_category_id?, audience_note?
  - valid_from?, valid_to?, show_in_carousel, is_active

### 3.4 Меню
- `menu_categories` — parent_id? (подкатегории), title, slug, fun_fact_title?, fun_fact_text?, price_group_id?
- `price_groups` + `price_group_tiers` (label, amount, unit, price) — общая сетка цен на раздел: Teatone, фирменные чаи, лимонады
- `menu_items` — category_id, name, description?, choice_note?, origin_country?, price_group_id?, image_media_id?, is_takeaway_discount, is_active
- `menu_item_variants` — item_id, label?, amount `numeric`?, unit (`g`/`ml`/`l`/`pcs`)?, price. **Минимум один вариант у каждой позиции**
- `menu_modifiers` — платные добавки: name, price, category_id?

### 3.5 Банкетные сеты
- `banquet_sets` — title, description, cover_media_id, pricing_mode (`per_person` | `fixed`), price, min_guests?, max_guests?
- `banquet_set_items` — set_id, menu_item_variant_id?, custom_label?, qty (состав для показа)

### 3.6 Заявки
- `leads`:
  - type (`callback`/`booking`/`promo`/`calculator`/`tournament`), source_block, name?, phone
  - preferred_date?, preferred_time?, guests?, comment?
  - quote_snapshot `jsonb` (позиции и итог, **пересчитанные на сервере**), quote_total?
  - status (`new`/`in_progress`/`done`/`spam`)
  - consent_at, consent_version, ip_hash, user_agent

### 3.7 Медиа и галереи
- `media_assets` — path, mime, width, height, size, blur_data_url, variants `jsonb` (ширины и форматы), alt, folder, created_by
- `galleries` (key: `hero`, `service_russian`, `service_pool`, `service_vip`, `service_training`, `bar`, `about`) + `gallery_items` (gallery_id, media_id, sort_order, caption)
- `services` — 4 вкладки «Услуги»: title, subtitle, bullets `text[]`, price_from, price_note, cta_type, gallery_key

### 3.8 Блог (по образцу billiard-darom/src/lib/schema/content.ts)
- `authors` — бывший `expert`, теперь с CRUD: slug, name, photo_media_id, role_in_club, rank, bio, same_as `jsonb`
- `rubrics` — slug, name, image
- `blog_tags` + `article_tags` (составной PK)
- `articles`:
  - slug, title, excerpt, body (md), cover_media_id, author_id?, rubric_id?
  - is_featured, show_toc
  - status (`draft`/`scheduled`/`published`), published_at `timestamptz`, reading_minutes (вычисляется при сохранении)
  - seo_title?, seo_description?, noindex
- `redirects` — from, to, code. 301 при смене slug и для старых URL сайта

### 3.9 Настройки и аудит
- `site_settings` (key/value `jsonb`): телефон, email, адрес, часы, соцсети (VK — **vk.ru**, Telegram), id Метрики, координаты карты, тексты hero и «О клубе», SEO по умолчанию, реквизиты оператора ПДн
- `audit_log` — user_id, action, entity, entity_id, diff `jsonb`

После изменения схемы: `pnpm db:generate` и `pnpm db:migrate`. **Никогда не `push`.**

---

## 4. Публичный сайт

### 4.1 Токены дизайна (Tailwind v4, `@theme` в `globals.css`)

| Токен | Значение | Применение |
|---|---|---|
| `--color-primary` | `#2f6c4a` | Основной зелёный |
| `--color-primary-dark` | `#13442e` | hover |
| `--color-foreground` | `#1c1c1c` | Текст |
| `--color-background` | `#f6f6f6` | Фон страницы |
| `--color-nav` | `#f5f8f9` | Фон шапки |
| `--color-footer` | `#1a1a1a` | Футер |
| `--color-muted-foreground` | `#8e8e8e` | Приглушённый текст |
| `--color-accent-red` | `#de2d26` | Акценты |
| `--color-date` | `#d43228` | Даты событий |
| `--color-badge` / `--color-badge-fg` | `#fecb17` / `#352b07` | Бейдж в hero |
| `--color-success` | `#31b939` | Успех |
| `--color-row-alt` | `#f8fafb` | Чередование строк таблицы |
| `--radius` | ≈12px (`--brad-regular` 0.6vw при 1920) | Скругления; hero — 25px |

**Типографика через `clamp()`:**

| Элемент | Мобильный | Десктоп |
|---|---|---|
| H1 | 24px | 65px |
| H2 | 20px | 60px |
| Цена | — | 40px |
| Основная кнопка | высота 60, текст 12px | высота 90, текст 29px, вес 700 |

Контейнер: `max-w-[1552px] w-[86vw] md:w-[81vw]`. **Верхний предел — 1920px**, шрифты дальше не растут.

**Эффекты, которые переносим:**
- «блик» на основной кнопке — CSS keyframes;
- появление секций при прокрутке — CSS `animation-timeline: view()` с fallback на IntersectionObserver;
- шапка, закрепляющаяся при прокрутке;
- бургер-меню с анимацией;
- карта в grayscale, при hover цветная;
- аккордеон прайса через `<details>`;
- кнопка «наверх».

**Не переносим:** jQuery, Swiper 5/9, Fancybox, Typed.js (заменяем CSS-анимацией набора текста или небольшим хуком), nice-select, maskedinput (маска на ~30 строк или `react-imask`), `user-select:none`, `outline:none`, ~70% мёртвого CSS, неиспользуемые шрифты (15 МБ).

### 4.2 Главная (порядок секций старого сайта)
1. **Шапка:** меню-якоря, адрес, Telegram, часы, телефон `tel:+79000685000`, «Заказать звонок».
2. **Hero:** фон из галереи `hero` (с мобильным вариантом, сейчас он битый), бейдж, H1, кнопка «Забронировать стол».
3. **Акции:** карусель из `promotions.show_in_carousel`, кнопка «Узнать условия» открывает диалог с формой.
4. **Услуги:** 4 вкладки (`services` + `galleries`), лайтбокс, цена «от …» вычисляется из `rental_tariffs` или берётся вручную.
5. **Календарный план:** 5 ближайших турниров (`end_date >= today`). Даты «5–7 марта», «30 марта – 2 апреля» в зоне Екатеринбурга. Ссылка «Весь календарь» ведёт на `/tournaments`.
6. **Бар и кухня:** галерея `bar`, текст, ссылка «Меню» на `/menu`.
7. **Прайс-лист:** аккордеон из `rental_tariffs` и `extra_services`, ссылка на `/prices`.
8. **Новый блок «Калькулятор»:** мини-форма (гости, дата, часы), ведёт на `/calculator`.
9. **О клубе:** фон и 4 пункта.
10. **Бронирование в 3 шага.**
11. **Форма** «Хотите забронировать стол?».
12. **Новый блок «Из блога»:** 3 последние статьи.
13. **Контакты:** Яндекс Карта за click-to-load фасадом.
14. **Футер.**

Все формы — один компонент `LeadForm` (Server Action, zod, honeypot, маска телефона, **неотмеченный** чекбокс согласия со ссылкой на `/soglasie`). Ошибки показываются пользователю, при успехе — переход на `/spasibo`.

### 4.3 Другие страницы
- `/menu` — sticky-навигация по категориям, поиск на клиенте, варианты цен, «интересный факт», пометка «−10% на вынос»
- `/tournaments` — сезон по месяцам, фильтр по дисциплине и категории, прошедшие турниры свёрнуты, JSON-LD `SportsEvent`
- `/prices` — аренда, доп. услуги, штрафы
- Блог — раздел 7

---

## 5. Админка

Общий UI: shadcn `sidebar`, `data-table` (TanStack Table), `form`, `dialog`, `alert-dialog`, `calendar`/`date-picker`, `sonner`. Под каждым списком — dnd-kit сортировка и кнопки ↑/↓ для мобильных.

| Раздел | Возможности |
|---|---|
| Сводка | Новые заявки, ближайшие 5 турниров, ссылки на сайт |
| Заявки | Таблица с фильтром по статусу и типу, карточка с quote_snapshot, смена статуса, экспорт CSV |
| Турниры | CRUD, диапазон дат, загрузка афиши (кроп 16:6), серии и дисциплины, дублирование турнира («следующий тур»), массовый импорт сезона из CSV |
| Цены | Визуальная сетка тарифов по дням и часам с проверкой пересечений и дыр, редактирование цен, залы, доп. услуги, штрафы |
| Акции | CRUD, обложка, период действия, вкл/выкл |
| Меню | Дерево категорий (dnd), позиции с вариантами (inline-таблица), сетки цен, добавки, массовое изменение цен (+N% по категории), скрытие позиции |
| Банкетные сеты | CRUD, состав из позиций меню, цена на человека или фиксированная |
| Галереи | Для каждой галереи загрузка, порядок, alt |
| Блог | Статьи (Markdown + тулбар + превью), рубрики, теги, авторы |
| Медиатека | Сетка, загрузка (dropzone), alt, удаление с проверкой использования |
| Настройки | Контакты, часы, соцсети, тексты секций, SEO, реквизиты для политики |
| Аккаунт | Пароль, 2FA |

Каждый Server Action работает по одной схеме: `requireAdmin()` → zod → транзакция → `audit_log` → `updateTag()`.

---

## 6. Калькулятор

**Ввод:**
- дата (по умолчанию сегодня) и время начала;
- длительность в часах (шаг 0.5);
- число гостей;
- зал: общий или VIP;
- число столов — по умолчанию `ceil(guests / seats_per_table)`, можно изменить;
- доп. услуги;
- банкетные сеты (для `per_person` по умолчанию = гостям);
- позиции меню с вариантами и количеством.

**Расчёт** — чистая функция `calculateQuote(input, catalog)` в `lib/calculator`:
1. Интервал [start, start + hours) разбивается на отрезки по границам тарифов. День недели берётся от **операционных суток**: всё, что после 00:00 и до 09:00, относится к предыдущему дню. Например, ночь с пятницы на субботу считается по тарифу пятницы.
2. Аренда = Σ (длительность отрезка × цена `per_hour` × число столов).
3. Еда = Σ (цена варианта × количество); сеты: `per_person` × гости, `fixed` × количество.
4. Итог, разбивка по строкам, расчёт «на гостя».
5. Акции дня (по дате, дню недели и времени) — плашка «В этот день действует акция…», **в сумму не входят**.
6. Предупреждения: интервал вне часов работы, не хватает столов в зале, гостей больше `max_guests` сета.

**Состояние в URL** (`nuqs`): `?g=8&d=2026-12-05&t=19:00&h=3&hall=common&tables=2&s=<setCode>:8&i=<code>:2,...`. У позиций меню и сетов короткий `code` (nanoid, 6 символов) — UUID в URL не нужен. Ссылкой можно поделиться.

**Отправка:** «Отправить расчёт в клуб» → Server Action:
1. Валидация zod.
2. **Пересчёт на сервере** по актуальному каталогу.
3. Запись в `leads` с `quote_snapshot`.
4. Уведомления (раздел 6.1).

Внизу калькулятора дисклеймер: «Расчёт предварительный, итог подтверждает администратор».

**Тесты (Vitest):** переход через полночь, пятница → суббота, ночной тариф, смена тарифа посреди брони, нецелые часы, пустой каталог, пенсионный тариф.

### 6.1 Уведомления о заявке
- **Email** (nodemailer, Яндекс 360 SMTP) на адрес клуба — полная заявка.
- **Telegram** (тот же чат, новый токен, `parse_mode=HTML` с экранированием) — по умолчанию **без ПДн**: «Новая заявка #N (калькулятор, 8 гостей, 5 дек 19:00) → ссылка в админку». Флаг в настройках позволяет включать имя и телефон, если владелец осознанно согласен на трансграничную передачу.
- Если отправка не удалась, заявка всё равно остаётся в БД. Ошибку пишем в лог, плюс кнопка «Повторить уведомление» в админке.
- Rate limit на отправку: 5 запросов в 10 минут с одного IP (таблица или in-memory LRU), honeypot. Yandex SmartCaptcha — если появится спам.

---

## 7. Блог (перенос из billiard-darom)

Копируем с адаптацией. Пути относительно `billiard-darom`:
- `src/lib/slug.ts`
- `src/lib/content/{markdown,cache-tags,remark-callout,shortcodes}.ts` — оставить только шорткоды Видео и Документ; Видео дополнить **VK Видео и Rutube**
- `src/lib/seo/jsonld.ts`
- `src/components/content/*` — article-body, rich-text, markdown-components, callout, toc, article-card, blog-filters, rubric-tile, author-byline, expert-card → author-card, video-embed, document-embed, load-more, breadcrumbs
- `src/components/admin/{article-form,shortcode-toolbar,slug-field,content-preview-button,image-upload-field,rubric-manager,blog-tag-manager,media-library}.tsx`
- `src/components/media/*`
- `src/lib/admin/{content-actions,content-queries,slug-actions,media-actions,media-queries}.ts`
- Dockerfile и `/uploads` route — **как образец, не копировать** (см. раздел 9)

**Выбросить:** шорткоды товаров, коллекций и комплектов, RelatedProducts, TestedInClub, лендинги магазина, `reviewedBy`, RBAC с несколькими ролями, захардкоженные цвета `#0098d2`/`#ef4238`, нативные `<select>`.

**Исправить при переносе:**
1. Path traversal в `uploadCoverImage` (`folder` из FormData) и перезапись файлов с одинаковыми именами.
2. Загрузку SVG запретить (stored XSS).
3. Отложенная публикация: фильтр `published_at <= now()` + статус `scheduled`, `cacheLife` на списках.
4. Часовой пояс: `datetime-local` интерпретируется как `Asia/Yekaterinburg`, а не UTC сервера.
5. Замена тегов — в транзакции. При смене slug — автоматически запись в `redirects` (301).
6. SEO-поля прямо в статье + `noindex`.
7. Пагинация на страницах рубрик.

**Добавить:** RSS (`/blog/rss.xml`), время чтения, похожие статьи по рубрике и тегам, кнопки «Поделиться» (VK, Telegram, копировать ссылку), `opengraph-image` (генерация через `next/og` со шрифтом Onest), превью неопубликованной статьи по подписанной ссылке.

---

## 8. SEO и переезд домена
- `generateMetadata` на всех страницах, `metadataBase`, canonical, OG с абсолютными URL.
- JSON-LD: `SportsActivityLocation`/`LocalBusiness` (адрес, часы, geo 55.153739, 61.404441, телефон, `sameAs` VK и Telegram, priceRange), `SportsEvent` для турниров, `Menu`/`MenuSection` на `/menu`, `Article` + `BreadcrumbList` в блоге.
- Динамический `sitemap.ts`, `robots.ts`. `/spasibo`, `/admin`, `/login` закрыты через `noindex`.
- 301-редиректы: `/politika/`, `/politika/politika.html` → `/politika`; `/spasibo/` → `/spasibo`; `/index.php` → `/`; старые пути к картинкам из `uploads/` → 410 или главная. Реализация: `redirects()` в `next.config.ts` + таблица `redirects` в proxy.
- Подтверждение Яндекс Вебмастера: файл `yandex_b2d6db0830b1e9ce.html` положить в `public/`.
- Яндекс Метрика 106365667: загружается **только после согласия на cookie**, цели `reachGoal` на отправку каждой формы и калькулятора.
- Цель Lighthouse на мобильных: Performance ≥ 90, LCP < 2.5 с. Hero через `next/image priority` с AVIF.

## 9. Медиа (Docker volume)
- `UPLOAD_DIR=/data/uploads` (именованный том Dokploy `piramida-uploads`).
- Загрузка: Server Action / route handler → проверка размера (≤ 10 МБ) и magic bytes (jpeg/png/webp/avif, **SVG запрещён**) → `sharp().rotate()` → ширины 640/1280/1920 в форматах avif и webp + blur placeholder → имя `<uuid>-<w>.<ext>` → запись в `media_assets`.
- Отдача: `app/media/[...path]/route.ts` — `path.resolve` + проверка префикса, стрим `fs.createReadStream`, правильный `Content-Type`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`.
- Вывод: компонент `<Picture>`, `<picture>` с srcset из готовых вариантов (встроенный оптимизатор next/image для этих файлов не используем).
- `scripts/import-legacy-images.ts`: старые фото из `74.loc` (галереи услуг ~4.4 МБ, бар ~2 МБ, hero, акции, афиши турниров) → те же варианты → записи в `galleries`.

## 10. 152-ФЗ и юридическое (нужен материал от клуба)
- Хостинг VDS в РФ — проверить, где физически стоит сервер.
- `/politika` с реальными реквизитами оператора (ИП/ООО, ИНН/ОГРН, адрес, email), упоминанием Метрики и Вебвизора, сроков и целей обработки.
- `/soglasie` — отдельный документ согласия. В формах неотмеченный чекбокс, в БД сохраняются `consent_at` и `consent_version`.
- Cookie-баннер «Принять / Только необходимые», без согласия Метрика не загружается.
- Уведомление РКН об обработке ПДн — делает владелец.
- Тексты документов проверяет юрист. Мы делаем шаблон с подстановкой из `site_settings`.

## 11. Деплой на Dokploy
- `Dockerfile` (multi-stage):
  - `node:22-alpine`, corepack pnpm;
  - стадия `deps` → `builder` (`next build`, при сборке БД не нужна: публичные запросы — `'use cache'` с fallback/Suspense, `generateStaticParams` обрабатывает пустой результат) → `runner`;
  - в runner: `.next/standalone`, `.next/static`, `public`, `drizzle/`, `scripts/migrate.mjs`, пакет sharp;
  - пользователь `node`, `HEALTHCHECK` на `/api/health`.
- Entrypoint: `node scripts/migrate.mjs && node server.js`. **Не** пересобирать при старте, как в billiard-darom.
  - Если пререндер с `cacheComponents` всё же требует БД при сборке, использовать build-arg `POSTGRES_URL` на БД Dokploy через внутреннюю сеть. Проверить в спайке на этапе 1.
- Сервисы Dokploy:
  - Application (Dockerfile из Git), домен с Let's Encrypt через Traefik, редирект www → apex;
  - Postgres 18;
  - volume `piramida-uploads` → `/data/uploads`.
- Env: `POSTGRES_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_SITE_URL` (build arg), `UPLOAD_DIR`, `SMTP_HOST/PORT/USER/PASS/FROM`, `LEADS_EMAIL_TO`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_YM_ID`.
- Better Auth за Traefik: `advanced.ipAddress.ipAddressHeaders: ['x-forwarded-for']`, rate limit на `/sign-in/email` (5 попыток в минуту, хранение в БД).
- Бэкапы: Postgres ежедневно в S3 (Yandex Object Storage или Selectel), хранить 14 копий. Volume backups тома uploads ежедневно. **Один раз отрепетировать восстановление.**
- Если сборка на VDS упадёт по OOM: собирать в GitHub Actions → GHCR → Dokploy «Docker image».
- Переключение DNS делаем последним шагом (раздел 13, этап 6).

## 12. Тестирование и качество
- После каждого этапа: `pnpm lint`, `pnpm typecheck`, `pnpm build:ci`.
- **Vitest:** `calculateQuote`, `formatEventDate`, slug и транслитерация, парсер URL-состояния калькулятора, zod-схемы, правила видимости турниров (`end_date`), проверка пересечений тарифов.
- **Playwright** (есть skill `playwright-cli`):
  - главная отображается, якоря работают;
  - отправка формы (SMTP и Telegram замоканы) → заявка видна в админке;
  - калькулятор: ссылка с параметрами воспроизводит расчёт;
  - вход в админку → правка цены → цена сразу на сайте (проверка `updateTag`);
  - загрузка афиши турнира;
  - публикация статьи в блоге;
  - неавторизованный доступ к `/admin` и прямой вызов Server Action отклоняются.
- Визуальная сверка с 74.loc на 1920 / 1440 / 768 / 375: скриншоты Playwright рядом со старым сайтом в OSPanel.
- Security-review (агент `security-scanner`) перед запуском.

---

## 13. Этапы и параллелизм (для `/create-spec` → `/implement-feature`)

Правило: `package.json`/lockfile, shadcn-компоненты, `globals.css`, схема БД, `proxy.ts` и `src/app/(site)/page.tsx` меняет **только назначенный владелец**. Остальные потоки пишут в свои файлы.

**Этап 0 — подготовка (последовательно, 1 агент)**
- Чистка стартера (раздел 1), обновление next и eslint-config.
- **Все пакеты и все shadcn-компоненты** проекта ставятся здесь.
- `cacheComponents`, `output: 'standalone'`, `serverActions.bodySizeLimit: '12mb'`, заголовки безопасности.
- `DESIGN.md` и токены `globals.css`, шрифт Onest (+ TTF для OG), фавиконы и manifest со старого сайта.
- Vitest и Playwright, `/api/health`.
- Dockerfile (раздел 16.1) + проверка: `docker build` проходит **без БД**.

**Этап 1 — фундамент**
- A. **Вся схема одним потоком и одной миграцией**: раздел 3 + правки 16.3 + таблицы плагинов Better Auth (admin, twoFactor, rateLimit). `drizzle.config.ts` → `schema/*`. Затем generate + migrate.
- Параллельно с A:
  - D. Layout сайта: Header, Footer, кнопки, «блик», reveal, CookieBanner, Метрика, `not-found.tsx`.
  - M. `lib/calculator` (чистые функции на типах) + Vitest.
- После A, параллельно:
  - B. Better Auth (16.4): `requireAdmin`, `seed-admin`, login. Единственный владелец `proxy.ts`.
  - C. Медиа-подсистема (раздел 9) + `/media` + `<Picture>` + API загрузки.
  - Q. `notify/*` (email, Telegram) + `LeadForm` + `submitLead` Server Action + `/spasibo`. От Q зависит B (сброс пароля по email).

**Этап 2 — данные и админка**
- E. Seed + `import-legacy-images` (после A и C).
- F. Каркас админки: sidebar, data-table, sortable-list, image-upload, audit. **До G и H.**
- После F, параллельно:
  - F2. Турниры + Акции.
  - G. Цены, Меню, Банкетные сеты.
  - H. Галереи, Настройки, Заявки, Аккаунт.

**Этап 3 — публичный сайт (после D, E, Q)**
- I. Секции главной 1–7, каждая в своём файле `components/site/*`.
- J. Секции главной 8–14 в своих файлах + попапы (call-back с селектом времени, бронь, акция, политика).
- K. `/menu`, `/prices`, `/tournaments`.
- L. `/politika`, `/soglasie`, SEO (sitemap, robots, JSON-LD, статические редиректы в `next.config.ts`).
- Z. Сборка `page.tsx` главной (один владелец), после I и J.

**Этап 4 — калькулятор:** N. UI `/calculator`, nuqs, отправка через `submitLead`, блок для главной (отдаётся в Z).

**Этап 5 — блог (параллельно с этапами 3 и 4, после C и F)**
- O. Ядро блога, публичные страницы, RSS, OG.
- P. Админка блога: статьи, рубрики, теги, авторы. Медиатека — только UI поверх API из C.

**Этап 6 — проверка и запуск (последовательно)**
- Playwright e2e, визуальная сверка, Lighthouse, security-review.
- Dokploy: Postgres, volume, app, env, бэкапы → staging-домен → проверка админом.
- DNS на VDS → Яндекс Вебмастер (переобход) → мониторинг 404 в первую неделю.

---

## 14. Риски и открытые вопросы к клубу
1. **Ночной тариф 3500 ₽/ч (VIP 4800 ₽/ч)** почасово выглядит дорого. На JPG стоят другие суммы (4800 / 5400). Подтвердить у клуба. Схема поддерживает и `fixed`, и `per_hour`.
2. **Цены на JPG и на сайте расходятся:** пенсионный тариф 240 и 200, прокат 300 и 250. Взяли цены с сайта, админ поправит.
3. Часы работы: на сайте указано «09:00–02:00», но есть тариф 02–09. Клуб работает круглосуточно?
4. Сколько столов в общем зале и в VIP-залах (нужно для калькулятора), сколько человек на стол?
5. Реквизиты оператора ПДн, email для заявок, доступ к SMTP (Яндекс 360), новый токен Telegram-бота.
6. Американский пул в Челябинске есть? (Влияет на вкладку «Услуги».)
7. «Продажа бильярдного оборудования», программы обучения и тренеры — нужны ли отдельные цены и страницы?
8. Фото лучшего качества и мобильный вариант hero.
9. Сервер VDS физически в РФ?
10. Сайт 72 (Тюмень): если понадобится позже, потребуется рефакторинг под несколько городов (поле `branch_id`). Сейчас не закладываем.

## 15. Срочно, вне разработки
- Удалить `74.zip` из веб-корня продакшена (если он там есть).
- **Перевыпустить токен Telegram-бота** (токен есть в архиве и в коде).
- **Сменить пароль БД** `ba2ra` везде, где он повторяется.
- Удалить `.idea/` с сервера.

---

## 16. Правки по ревью (обязательны, имеют приоритет)

### 16.1 Сборка, кэш, Docker
- **`next build` проходит без БД.** Все блоки с данными из БД оборачиваются в `<Suspense>`, внутри них сначала `await connection()`, затем вызов кэшируемой `'use cache'` функции. Статическая оболочка (шапка, футер, разметка) пререндерится, данные подставляются в рантайме и кэшируются по тегам. `generateStaticParams` для `blog/[slug]` и `authors/[slug]` **не используем**: пустой массив с Cache Components даёт ошибку сборки. `sitemap.ts`, RSS, OG и `robots` — динамические (`connection()`). Никаких `try/catch → []`, которые запекли бы в кэш пустые данные.
- **«Сегодня» не вычисляется внутри `'use cache'`.** Снаружи (после `connection()`) получаем `opDate` в формате `YYYY-MM-DD` по зоне `Asia/Yekaterinburg` и передаём аргументом. Так дата становится частью ключа кэша и каждый день меняется сама. Касается турниров, акций и `published_at` (для блога передаём округлённый до 5 минут `now`, плюс `cacheLife({ revalidate: 300 })` на списках).
- Инвалидация:
  - в Server Actions — `updateTag(tag)`;
  - в route handlers (загрузки, cron) — `revalidateTag(tag, 'max')`, а для немедленного обновления `revalidateTag(tag, { expire: 0 })`.
- Кэш `'use cache'` живёт в памяти процесса. **Работает одна реплика**, в Dokploy replicas = 1.
- Dockerfile:
  - pnpm ставится через `npm i -g pnpm@<pin>`, без corepack: shim падает с pnpm 11, это видно по billiard-darom;
  - `scripts/migrate.mjs` собирается через esbuild в один файл (`drizzle-orm/migrator` + `postgres`), в runner копируются бандл и `drizzle/`.

### 16.2 Калькулятор — модель операционных суток
- **Операционные сутки:** с 09:00 даты D до 09:00 даты D+1. Тарифы и окна акций хранятся в **минутах от 09:00**: `start_min`, `end_min` от 0 до 1440, всегда `end > start`. Например, 16:00–02:00 → 420–1020, 02:00–09:00 → 1020–1440. `days_of_week` относится к дню D. В админке время показывается как обычные часы, а «ночь» подписывается как «ночь на <D+1>».
- В UI клиент выбирает «дату визита» (D) и время начала. Время с 00:00 до 08:59 означает ночь на D+1.
- Старт только на :00 или :30, длительность от 0.5 до 12 часов.
- **Интервал попадает в «дыру» без тарифа** → предупреждение «уточните у администратора», расчёт этой части не производится.
- `fixed`-тариф: начисляется один раз за ночь на стол или комнату, если интервал хоть как-то с ним пересекается.
- Тарифы с `audience` (пенсионный) применяются только при отмеченном флаге «пенсионер». Это **флаг ввода**, а не скидка-акция. При проверке пересечений тарифов в админке такие тарифы не учитываются.
- **Залы:** выбирается конкретный `hall_id`. У VIP-комнат `tables_count = 1`, цена за комнату. У общего зала задаётся число столов (не больше `tables_count`). В `rental_tariffs` остаётся только `hall_id` (без `hall_kind`).
- Платные добавки (`menu_modifiers`) в калькулятор не входят, показываются текстом.
- Дополнительные тесты: вс→пн, сб→вс, бронь, попадающая в дыру, fixed-тариф, флаг пенсионера, VIP-комната.

### 16.3 Правки схемы
- Поле `code` (nanoid, 6 символов, unique) у `menu_items`, `menu_item_variants` и `banquet_sets` — для URL калькулятора.
- Правило вариантов: **либо** `price_group_id` (цены берутся из `price_group_tiers`), **либо** не меньше одного `menu_item_variants`. Проверяется в zod и в Server Action.
- `leads`:
  - `number integer generated always as identity` — для «Заявки #N»;
  - `callback_window` enum (`now`/`hour`/`day`/`week`);
  - `form_title`, `source_block`, `page_url`;
  - `promotion_id?`, `tournament_id?`;
  - `notify_status jsonb` (email и telegram: ok/error, время);
  - `consent_document_id` → таблица `legal_documents` (тип, версия, текст, `sha256`, `published_at`).
- **Упрощения:**
  - `disciplines` → enum `discipline`;
  - CSV-импорт турниров заменён кнопкой «Дублировать»;
  - вместо визуальной сетки тарифов — таблица с валидацией пересечений и дыр;
  - drag-and-drop только в меню (категории и позиции), галереях и сетах.
- Медиа: FK на `media_assets` с `ON DELETE RESTRICT`. Перед удалением файла ищем `/media/<uuid>` в markdown статей и акций.
- ID Метрики только в env (`NEXT_PUBLIC_YM_ID`), из `site_settings` убрать.

### 16.4 Auth и безопасность
- `seed-admin`: `hashPassword` из `better-auth/crypto`, затем вставка `user` (`role='admin'`) и `account` (`providerId='credential'`). Так работает при `disableSignUp`.
- Сброс пароля отправляет письмо через `notify/email` (поток Q).
- В twoFactor задаётся `issuer: 'Пирамида — админка'`.
- **IP клиента** берётся из `x-real-ip`, который ставит Traefik. Traefik настраивается так, чтобы перезаписывать `X-Forwarded-For` и `X-Real-IP` (trusted IPs только свои). Левое значение `x-forwarded-for` не используем. `ip_hash = sha256(ip + BETTER_AUTH_SECRET)`.
- Заголовки: CSP (с разрешением `mc.yandex.ru`, `yandex.ru/map-widget`, `vk.ru` и `rutube.ru` для iframe), `frame-ancestors 'none'`, `X-Robots-Tag: noindex` на `/admin` и `/login`.
- Видео-шорткоды — только белый список хостов: `vk.ru`, `vkvideo.ru`, `vk.com`, `rutube.ru`, свои `/media`.
- Ссылка на превью статьи подписывается HMAC и действует 24 часа.
- Таблица `redirects` проверяется только при промахе (например, `blog/[slug]` → `permanentRedirect`). `proxy.ts` к ней не обращается.

### 16.5 Перенос со старого сайта (что не было учтено)
- Четыре попапа: call-back с селектом «Сейчас / В течение часа / дня / недели», бронь (product), акция, политика (открывается в модалке). `LeadForm` принимает пропсы `block` и `formTitle` от кнопки-триггера, как `hiddenValue_JS` в старом сайте. Шаблон сообщения в Telegram и письма зависит от `type` и `block`.
- `not-found.tsx` оформляется в стиле старой 404.
- Фавиконы (16, 32, apple-touch, android) и `site.webmanifest` переносятся из `public/themes/piramida/assets/icon/` с исправленными путями.
- Редиректы и 410: `/public/themes/piramida/**` и `/uploads/**` (проиндексированные картинки), `/index.php`, `/politika/*`, `/spasibo/`.

### 16.6 152-ФЗ
- Поля имени и телефона получают класс `ym-disable-keys`, чтобы Вебвизор их не записывал.
- **Срок хранения заявок** (по умолчанию 12 месяцев, задаётся в настройках): ежедневный cron в Dokploy обезличивает старые лиды (`name`, `phone` → null). Этот срок указывается в `/politika`.
- Согласие ссылается на конкретную версию документа в `legal_documents`.
- Бэкапы хранятся только в российском S3.
- Флаг «ПДн в Telegram» по умолчанию выключен. Включение пишется в `audit_log` с подтверждением в UI.
