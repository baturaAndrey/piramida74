# Task 28: QA, e2e, визуальная сверка, Lighthouse, security, Docker

## Status

pending

## Wave

7

## Description

Финальная проверка всего проекта. `AGENTS.md` требует тестировать каждое изменение, поэтому эта задача — обязательный «тестовый» шаг: сквозные сценарии Playwright (`e2e/*.spec.ts`), визуальная сверка с живым старым сайтом (`http://74.loc`, OSPanel) на 1920/1440/768/375 со скриншотами для ручного просмотра, Lighthouse (mobile, Performance ≥ 90), security-review агентом/скиллом `security-scanner`, сборка и запуск Docker-образа, общий прогон `pnpm lint && pnpm typecheck && pnpm test && pnpm build:ci`. Задача выполняется одна в последней волне и **может править любой файл проекта**: найденные ошибки исправляются на месте (минимально и с пояснением в отчёте), а не просто фиксируются.

## Dependencies

**Depends on:** task-15-legacy-images-import.md, task-16-admin-tournaments-promotions.md, task-17-admin-pricing.md, task-18-admin-menu-sets.md, task-19-admin-galleries-settings-leads.md, task-22-pages-menu-prices-tournaments.md, task-23-legal-seo-redirects.md, task-26-blog-admin.md, task-27-home-assembly.md
**Blocks:** None

**Context from dependencies:** к началу этой задачи реализован весь проект:
- сайт: главная (`/`, секции 1–12), `/menu`, `/prices`, `/tournaments`, `/calculator`, `/blog`, `/blog/[slug]`, `/authors/[slug]`, `/politika`, `/soglasie`, `/spasibo`, 404; `/sitemap.xml`, `/robots.txt`, `/blog/rss.xml`; 410 на `/public/**` и `/uploads/**`; 301 со старых URL;
- заявки: `LeadForm` + попапы (`submitLead`, rate limit 5/10 мин на IP, honeypot, неотмеченный чекбокс согласия, версия документа), email (nodemailer) и Telegram — оба **необязательны** (если env не заданы, уведомление пропускается с `console.warn`, заявка всё равно сохраняется);
- админка `/admin/**` (Better Auth, роль `admin`, регистрация закрыта, `proxy.ts` — оптимистичный редирект, `requireAdmin()` на страницах, `adminAction` во всех Server Actions): заявки, турниры и серии, акции, цены и штрафы, меню и сеты, галереи, настройки, аккаунт/2FA, блог (статьи, рубрики, теги, авторы), медиатека; `POST /api/admin/media` для загрузки; cron `POST /api/cron/retention` и `POST /api/cron/blog` (Bearer `CRON_SECRET`);
- инфраструктура: `Dockerfile` (multi-stage, `node:22-alpine`, `npm i -g pnpm@<pin>`), `scripts/migrate.ts` → `dist/migrate.cjs` (esbuild-бандл, `pnpm build:migrate`), `docker-entrypoint.sh` (`node /app/migrate.cjs`, затем `node server.js`), `GET /api/health` (`SELECT 1`), `docker-compose.yml` (Postgres 18), Vitest (юнит-тесты логики), Playwright установлен задачей 01 (`playwright.config.ts`, `e2e/health.spec.ts`).
- `package.json` scripts (задача 01, ровно такие): `"seed": "tsx --env-file=.env scripts/seed.ts"`, `"seed:admin": "tsx --env-file=.env scripts/seed-admin.ts"` (запуск `pnpm seed:admin --email … --password …`), `"import:images": "tsx --env-file=.env scripts/import-legacy-images.ts"`, `"test": "vitest run"`, `"test:e2e": "playwright test"`, `build:migrate`. Публичный URL сайта — только `NEXT_PUBLIC_SITE_URL` (`NEXT_PUBLIC_APP_URL` стартера удалён задачей 01).
- Решения, которые проверяются отдельно: CSP (`frame-src https://yandex.ru https://*.yandex.ru https://vk.com https://vk.ru https://vkvideo.ru https://rutube.ru`; `script-src`/`connect-src`/`img-src` включают `https://mc.yandex.ru https://mc.yandex.com https://yastatic.net`); ключи галерей сида `hero`, `service_russian`, `service_pool`, `service_vip`, `service_training`, `bar`, `about`, `cta` (CTA-блок главной берёт `getGallery('cta')`, при пустой галерее — статические `public/images/home/*`); тип заявки `tournament` (`LeadDialogTrigger kind="tournament"` на `/tournaments` передаёт `tournamentId`); уровни сеток цен меню в калькуляторе — коды вида `${item.code}-${tier.code}` в `i=` (содержат `-`); плейсхолдеры юр. документов подставляются **один раз** в `getCurrentLegalDocument`; cron retention обнуляет `leads.ipHash` (колонка nullable); QR для 2FA рисует `react-qr-code`.
- Сид содержит цены аренды из legacy-notes (Вс–Чт 09–16: 580, 16–02: 640; Пт–Сб 09–16: 680, 16–02: 760; ежедневно 02–09: 3500 ₽/ч; VIP 1400 / 4800 ₽/ч; пенсионный 200; прокат 250), 30 турниров, акции, меню, штрафы, залы (общий зал: 12 столов по 4 места; VIP 1–3).
- Селекторы UI (подписи, роли) — смотреть в самих страницах; в этом файле они указаны по ожидаемым текстам.

## Files to Create

- `playwright.config.ts` — создан задачей 01; доработать (проекты `setup`, `chromium`, `visual`).
- `e2e/auth.setup.ts` — вход админа и сохранение `storageState` (`e2e/.auth/admin.json`, добавить в `.gitignore`).
- `e2e/helpers/dates.ts` — вычисление ближайших дат нужного дня недели (`nextWeekday(dow)`), форматирование `YYYY-MM-DD` в `Asia/Yekaterinburg`.
- `e2e/helpers/admin.ts` — вспомогательные функции для админки (поиск строки по тексту, ожидание toast).
- `e2e/fixtures/poster.png`, `e2e/fixtures/cover.jpg` — маленькие тестовые изображения (сгенерировать скриптом `e2e/fixtures/generate.ts` через `sharp`, который уже установлен; в git закоммитить результат).
- `e2e/home.spec.ts` — главная и якоря.
- `e2e/lead-form.spec.ts` — отправка заявки и появление в админке.
- `e2e/calculator.spec.ts` — URL воспроизводит расчёт, цены на границах тарифов.
- `e2e/admin-pricing.spec.ts` — правка цены в админке → цена на сайте.
- `e2e/admin-tournament-cover.spec.ts` — турнир с афишей.
- `e2e/blog.spec.ts` — публикация статьи, отложенная публикация, смена slug, предпросмотр.
- `e2e/security.spec.ts` — защита `/admin`, прямой вызов Server Action, cron, `/media`.
- `e2e/seo-legal.spec.ts` — `/politika`, `/soglasie`, sitemap, robots, редиректы, 410.
- `e2e/visual-compare.spec.ts` — скриншоты нового и старого сайтов (проект `visual`, не входит в обычный прогон).
- `e2e/screenshots/` (git-ignored, кроме `.gitkeep`) — `legacy/`, `new/`, `index.html` (галерея «рядом» для ручного просмотра, генерируется тем же spec).
- `scripts/e2e-db.mjs` (или `.sh`) — создание/пересоздание тестовой БД, миграции, seed, seed-admin.
- `docs/qa/` **не создавать**. Результаты проверок идут в итоговое сообщение агента.

## Files to Modify

Любые файлы проекта — для исправления найденных ошибок. Каждое исправление описать в отчёте (что, где, почему). Не менять смысл требований (`requirements.md`) и контракты без согласования; если для исправления нужна смена схемы БД — выполнить `pnpm db:generate` и `pnpm db:migrate` (**`drizzle-kit push` запрещён**).

## Technical Details

### Implementation Steps

#### 1. Подготовка окружения

1. Проверить, что установлены Docker и Playwright-браузеры: `docker --version`, `pnpm exec playwright install chromium`.
2. Поднять Postgres: `docker compose up -d`. Создать **отдельную тестовую БД**, чтобы не трогать dev-данные:

```bash
docker compose exec postgres psql -U dev_user -d postgres_dev -c "DROP DATABASE IF EXISTS piramida_e2e;"
docker compose exec postgres psql -U dev_user -d postgres_dev -c "CREATE DATABASE piramida_e2e;"
```

   (реквизиты — из `docker-compose.yml`/`env.example`; в e2e-env `POSTGRES_URL=postgresql://dev_user:dev_password@localhost:5432/piramida_e2e`).
3. Файл `.env.e2e` (git-ignored, **не коммитить**; шаблон — `env.example`):

```
POSTGRES_URL=postgresql://dev_user:dev_password@localhost:5432/piramida_e2e
BETTER_AUTH_SECRET=e2e-secret-e2e-secret-e2e-secret-0123456789
BETTER_AUTH_URL=http://localhost:3100
NEXT_PUBLIC_SITE_URL=http://localhost:3100
NEXT_PUBLIC_YM_ID=
UPLOAD_DIR=./.data/e2e-uploads
CRON_SECRET=e2e-cron-secret
# SMTP_* и TELEGRAM_* — НЕ задавать: уведомления пропускаются, заявка сохраняется (поведение проверяется тестом)
E2E_ADMIN_EMAIL=e2e-admin@example.com
E2E_ADMIN_PASSWORD=E2e-Passw0rd!long-enough
```

4. `scripts/e2e-db.mjs`: подгружает `.env.e2e` в `process.env` дочерних процессов, выполняет `pnpm db:migrate` (миграции Drizzle), `pnpm seed`, `pnpm seed:admin --email $E2E_ADMIN_EMAIL --password $E2E_ADMIN_PASSWORD`, очищает `UPLOAD_DIR`. Скрипты `seed`/`seed:admin` запускаются с `--env-file=.env`: переменные, уже заданные в окружении процесса, имеют приоритет над файлом, поэтому значения из `.env.e2e` не перетираются (файл `.env` при этом должен существовать — при отсутствии создать копией `env.example`). Пересоздание — перед каждым полным прогоном (команда `pnpm e2e:db`, добавить в `package.json` скрипты `e2e:db` и `e2e:visual`; обычный прогон — существующий `pnpm test:e2e`).
5. `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,       // один процесс Next, общая БД; тесты изолируют данные уникальными именами
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure', locale: 'ru-RU', timezoneId: 'Asia/Yekaterinburg' },
  webServer: {
    // production-сборка: так проверяется то, что реально поедет в Docker (cacheComponents, updateTag, standalone-поведение)
    command: 'pnpm build:ci && pnpm start -p 3100',
    url: 'http://localhost:3100/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { /* значения из .env.e2e */ },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' }, dependencies: ['setup'], testIgnore: /visual-compare/ },
    { name: 'visual', testMatch: /visual-compare\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
})
```

   **Лимит входа:** Better Auth ограничивает `/sign-in/email` 5 попытками в минуту. Поэтому вход выполняется **один раз** в `auth.setup.ts` (форма `/login` → ожидание редиректа в `/admin`, `page.context().storageState({ path })`), а тесты используют `storageState`. Тесты без авторизации (`security`, публичные страницы) создают контекст с `test.use({ storageState: { cookies: [], origins: [] } })`.

#### 2. Сценарии Playwright

Общие правила: селекторы — `getByRole`/`getByLabel`/`getByText` (русские подписи из UI), `data-testid` добавлять в компоненты **только если иначе нельзя** (это допустимое исправление). Данные, которые создают тесты, получают уникальный суффикс (`Date.now()`). Каждый тест проверяет и **отсутствие ошибок в консоли** (`page.on('console')` для `error`, `page.on('pageerror')`; игнорировать сетевые ошибки сторонних доменов — Метрика, карты).

**`home.spec.ts`**
- Главная отвечает 200; видны H1 («Бильярдный клуб «Пирамида» в Челябинске…») и кнопка «Забронировать стол».
- Секции присутствуют в порядке: `#discount`, `#service`, `#reasons`, `#portfolio`, `#price`, блок «Калькулятор», `#clientsc`, `#worksteps`, `#getconsultation`, блок «Из блога» (может отсутствовать без статей), `#contacts` — порядок проверяется по `boundingBox().y`.
- Клик по пунктам меню шапки (Акции, Услуги клуба, Турниры, Бар и кухня, Прайс-лист, Контакты) прокручивает к соответствующему `id` (секция в видимой области).
- В «Календарном плане» не более 5 событий, даты по-русски (регэксп `^\d{1,2}(–\d{1,2})? [а-я]+$|^\d{1,2} [а-я]+ – \d{1,2} [а-я]+$`), все — с `endDate >= сегодня`.
- Прайс: аккордеон раскрывается, цены совпадают с сидом (580, 640, 680, 760, 3500, 1400, 4800, 200, 250).
- CTA-блок («Хотите забронировать стол?») показывает фото: из галереи `cta`, если в ней есть элементы (`/media/...`), иначе статические `/images/home/*`; изображения отвечают 200.
- В `<head>`: `link[rel=canonical]`, `script[type="application/ld+json"]` с `"@type"` `LocalBusiness`/`SportsActivityLocation`; Яндекс Метрика **не загружена** до согласия (нет запросов к `mc.yandex.ru`), после клика «Принять» в баннере cookie — загружается (если `NEXT_PUBLIC_YM_ID` пуст, шаг пропустить с `test.skip` и пометкой).
- Мобильный вьюпорт 375: нет горизонтального скролла (`document.documentElement.scrollWidth <= innerWidth`), бургер-меню открывается и закрывается.

**`lead-form.spec.ts`** (SMTP/Telegram не заданы)
- Форма CTA «Хотите забронировать стол?»: пустая отправка показывает ошибки полей; чекбокс согласия **не отмечен** по умолчанию, без него отправка блокируется с сообщением; с корректными данными (имя `E2E Тест <суффикс>`, телефон `+7 (900) 111-22-33`) → переход на `/spasibo`; `/spasibo` содержит `noindex`.
- Попап «Заказать звонок» (шапка): выбор «Сейчас / В течение часа / …» + телефон → успех.
- Запись на турнир: на `/tournaments` у турнира с открытой регистрацией кнопка (`LeadDialogTrigger kind="tournament"`) открывает форму «Записаться на турнир» (имя + телефон) → успех; в админке лид с типом `tournament` и ссылкой на этот турнир (`tournamentId`).
- Honeypot: заполнение скрытого поля (через `page.evaluate`) → ответ «успех» без записи в БД (лид не появляется в админке).
- Rate limit: 6-я отправка с одного IP за 10 минут отклоняется понятной ошибкой (запрос с заголовком `x-real-ip` фиксированный; использовать `page.request`/`fetch` к action нельзя — делать через UI с `page.setExtraHTTPHeaders({ 'x-real-ip': '203.0.113.7' })`). Этот тест выполнять **последним** в файле (он «занимает» лимит для своего IP).
- Админка: в `/admin/leads` лид виден с номером `#N`, типом, формой/блоком («Бильярдная забронировать стол»), телефоном; карточка открывается; смена статуса на «В работе» сохраняется; в карточке видно `notifyStatus` = пропущено (email/Telegram не настроены).
- Консоль сервера содержит `console.warn` о пропущенных уведомлениях, но **не** содержит ошибок (проверить по stdout webServer — `webServer.stdout: 'pipe'` при необходимости, либо пропустить этот пункт и покрыть юнит-тестом).

**`calculator.spec.ts`** (даты — через `nextWeekday` из `helpers/dates.ts`, чтобы тест не «протухал»; сид: общий зал 12 столов × 4 места, цены как в «Context from dependencies»)
- URL с параметрами воспроизводит расчёт: понедельник, `t=12:00`, `h=2`, `g=4`, 1 стол → «Итого» 1160 ₽ (2 × 580).
- Переход тарифа посреди брони: понедельник, `t=15:00`, `h=2`, 1 стол → 580 + 640 = 1220 ₽.
- Пятница, `t=23:00`, `h=3` (через полночь до 02:00) → по тарифу «Пт–Сб 16–02» 760 × 3 = 2280 ₽ (ночь пт→сб считается по пятнице).
- Пятница, `t=01:00` (ночь на субботу), `h=2` → 1 ч по 760 (01–02) + 1 ч по ночному 3500 (02–03) = 4260 ₽; в списке «Время начала» ночные слоты подписаны «ночь на …».
- Полчаса: понедельник, `t=12:00`, `h=0.5` → 290 ₽.
- 8 гостей → столов по умолчанию 2 (`ceil(8/4)`); ручное изменение столов записывается в URL (`tables=`), «Сбросить на авто» убирает параметр.
- VIP-комната: выбор VIP 1 скрывает «Столов», расчёт = цена комнаты.
- Пенсионер: чекбокс виден при наличии пенсионного тарифа, понедельник 10:00–12:00 → 200 ₽/ч.
- Меню: поиск по названию, выбор варианта (объём), счётчик ± → строка в смете, итог растёт; сет `per_person` добавляется с количеством = гостям.
- Сетка цен: позиция без собственных вариантов, но с сеткой цен (например чай из категории с `priceGroupId`) показывает уровни сетки («Чайник 600 мл» и т. п.); выбор уровня пишет в URL `i=<itemCode>-<tierCode>:1` (код содержит `-`), цена строки = цене уровня; открытие этого URL в новой странице даёт ту же смету, а отправленный лид пересчитывается сервером с тем же итогом.
- Ссылка: «Скопировать ссылку» (`context.grantPermissions(['clipboard-read','clipboard-write'])`) копирует URL; открытие скопированного URL в новой странице даёт ту же смету.
- Некорректный URL (`?g=-5&h=99&d=abc&i=zzz:1`) не ломает страницу: значения клампятся/игнорируются.
- Отправка: «Отправить расчёт в клуб» → диалог → заполнить имя/телефон/согласие → успех; в админке в карточке лида виден снимок расчёта и **сумма, пересчитанная сервером**. Негативный сценарий: изменить скрытое поле формы (подменить количество/цену через `page.evaluate`) → в БД сумма всё равно равна серверному пересчёту.

**`admin-pricing.spec.ts`**
- Админ открывает «Цены» (`/admin/pricing`), меняет тариф Вс–Чт 09–16 с 580 на 590, сохраняет; на `/prices` и в аккордеоне главной (после обновления страницы, без перезапуска сервера) цена 590 — это проверка `updateTag`; в калькуляторе тот же сценарий «понедельник 12:00 2 ч» даёт 1180 ₽. В конце теста цена возвращается к 580 (try/finally).
- Валидация: попытка создать пересекающийся тариф для того же зала/дней показывает ошибку.

**`admin-tournament-cover.spec.ts`**
- Админ создаёт турнир (название `E2E Турнир <суффикс>`, даты в будущем, дисциплина), загружает афишу `poster.png` через `image-upload-field`; в списке турниров виден; на `/tournaments` и главной (если попадает в ближайшие 5) отображается с картинкой из `/media/...` (проверка `picture source[srcset]`/`img[src]` начинается с `/media/`, запрос возвращает 200 и `Content-Type: image/avif|webp`, `Cache-Control` содержит `immutable`).
- Загрузка запрещённых файлов: SVG и `.txt` с расширением `.png` отклоняются (сообщение об ошибке), файл > 10 МБ отклоняется.
- Прошедший турнир (`endDate < сегодня`) не попадает в «ближайшие 5» на главной, турнир, который идёт сегодня (`startDate < сегодня <= endDate`), — попадает.
- «Дублировать» создаёт копию с суффиксом/следующим туром.

**`blog.spec.ts`**
- Создание статьи в `/admin/blog/articles/new`: заголовок → slug подставляется транслитом; Markdown с `## Заголовок`, шорткодом `{{Видео: https://rutube.ru/video/<32 hex>/}}` и недопустимым `{{Видео: https://evil.example/x}}`; статус «Опубликована» → после сохранения `/blog` показывает карточку, `/blog/<slug>` — статью с H1, оглавлением, iframe Rutube (`src` начинается с `https://rutube.ru/play/embed/`), без iframe для `evil.example`; статья есть в `/sitemap.xml` и `/blog/rss.xml`.
- Черновик: не виден на `/blog`, `/blog/<slug>` отдаёт страницу «не найдено»; кнопка «Открыть подписанный предпросмотр» открывает `/blog/preview/<id>?t=…` и показывает статью; та же ссылка с изменённым токеном → «не найдено».
- Запланированная статья с датой в будущем невидима; затем в БД/через админку дата переносится в прошлое — статья становится видимой (после `POST /api/cron/blog` с Bearer `CRON_SECRET` или в пределах 5 минут; в тесте использовать cron и проверку 200).
- Смена slug: у опубликованной статьи меняется slug → старый URL `/blog/<old>` приводит на `/blog/<new>` (проверить `page.goto` и итоговый URL; зафиксировать, HTTP-редирект это 301/308 или мета-редирект, — см. оговорку в задаче 25), в `/admin` создана запись редиректа.
- `noindex`: статья с флагом отдаёт `<meta name="robots" content="noindex…">` и отсутствует в sitemap/RSS.
- Рубрика: создать рубрику и привязать 13 статей (достаточно создать 13 записей через прямой SQL в `globalSetup`/helper, а не UI) → `/blog/<rubric>` показывает 12 карточек и ссылку «Показать ещё», `?page=2` — остальное.
- Автор: создать автора, привязать → `/authors/<slug>` показывает его и статьи, есть JSON-LD `Person`.
- OG: `GET /blog/<slug>/opengraph-image` → 200, `image/png`.

**`security.spec.ts`** (контекст без cookie)
- `GET /admin`, `/admin/leads`, `/admin/blog/articles` → редирект на `/login` (и `X-Robots-Tag: noindex` на `/admin`, `/login`).
- `POST /api/admin/media` и `GET /api/admin/media` без сессии → 401 (`requireAdminAction` → `{ error: 'UNAUTHORIZED' }`); с сессией, но с SVG → 4xx.
- **Прямой вызов Server Action без авторизации.** Рецепт: под админом открыть страницу с формой (например, настройки или создание тега), перехватить через `page.on('request')` запрос с заголовком `next-action` при сохранении (id действия и тело), затем повторить его через `playwright.request.newContext()` **без cookie** (`POST` на тот же URL с теми же `next-action`, `content-type` и телом) → ожидается отказ: `adminAction` возвращает `{ ok: false, error: 'Нет доступа' }` (в RSC-ответе нет `"ok":true`), а запись в БД не изменилась (проверить повторным чтением страницы под админом). Повторить для 2–3 действий (`saveArticle`, цены, `createTagInline`).
- `POST /api/cron/retention` и `POST /api/cron/blog`: без заголовка → 401, с неверным Bearer → 401, с верным → 200. `GET` на эти маршруты → 405.
- Retention: лид, у которого (через SQL) `createdAt` сдвинут старше `leadRetentionMonths`, после `POST /api/cron/retention` имеет `name`, `phone`, `comment`, `ipHash` = `null`, `userAgent` = `''`, заполненный `anonymizedAt`; свежие лиды не затронуты.
- 2FA: в `/admin/account` включение двухфакторной аутентификации показывает QR-код (SVG, отрисованный `react-qr-code` из `totpURI`) — проверить наличие `svg` в диалоге; полное подтверждение кодом не обязательно.
- `/media/..%2f..%2fetc%2fpasswd`, `/media/%2e%2e/%2e%2e/package.json`, `/media/2026/01/../../.env` → 400/404, не содержимое файла.
- Заголовки ответа любой страницы: `X-Frame-Options: DENY` (или CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`; CSP присутствует и содержит: в `frame-src` — `https://yandex.ru https://*.yandex.ru https://vk.com https://vk.ru https://vkvideo.ru https://rutube.ru`; в `script-src`, `connect-src`, `img-src` — `https://mc.yandex.ru https://mc.yandex.com https://yastatic.net` (если чего-то нет — исправить `next.config.ts`). На главной после согласия на cookie и клика по карте в консоли нет нарушений CSP (`Refused to …`).
- `/register` и `/api/auth/sign-up/email` недоступны (404 / отказ): регистрации нет.
- Rate limit входа: 6 неверных попыток `/api/auth/sign-in/email` за минуту → последняя возвращает 429 (выполнять в самом конце прогона и с отдельным `x-real-ip`, чтобы не блокировать остальные тесты).

**`seo-legal.spec.ts`**
- `/politika` и `/soglasie`: 200, заголовок, строка «Версия … от …», **нет** текста `{{`, при незаполненных реквизитах видно `[не указано]`; после заполнения реквизитов `operator.*` в `/admin/settings` значения подставляются (ровно один раз: значение реквизита не дублируется и не содержит остатков плейсхолдеров). Текст согласия в попапе формы заявки совпадает с `/soglasie` (оба берут `text` из `getCurrentLegalDocument`).
- `/sitemap.xml`: валидный XML, содержит `/`, `/menu`, `/prices`, `/tournaments`, `/calculator`, `/blog`, `/politika`, `/soglasie`; не содержит `/admin`, `/spasibo`, `/login`.
- `/robots.txt`: `Disallow: /admin`, `/login`, `/api/`, `/spasibo`, строка `Sitemap:` с абсолютным URL.
- Редиректы (`request.get(url, { maxRedirects: 0 })`): `/index.php` → 301 `/`; `/politika/politika.html` → 301 `/politika`; `/politika/politika-content.html` → 301 `/politika`; `/politika/` → 30x `/politika`; `/spasibo/` → 30x `/spasibo`. 410: `/uploads/2024/10/bg.webp`, `/public/themes/piramida/assets/img/logo.png`.
- `/yandex_b2d6db0830b1e9ce.html` отдаёт файл подтверждения.
- Несуществующая страница → 404 в стиле старой 404 (`not-found.tsx`), `noindex`.

#### 3. Визуальная сверка со старым сайтом

1. Убедиться, что OSPanel запущен и `http://74.loc` открывается (иначе — **остановиться и сообщить**: это ручной шаг). Новый сайт — production-сборка на `http://localhost:3100`, БД заполнена сидом **и** импортированными старыми фото (задача 15: `pnpm import:images`), чтобы картинки не пустовали.
2. `e2e/visual-compare.spec.ts` (проект `visual`): для каждой ширины 1920, 1440, 768, 375 (высота 1080/900/1024/812) и каждого сайта:
   - открыть страницу, **принять cookie-баннер** (старый сайт его не имеет), отключить анимации и эффекты (`page.addStyleTag`: `*{animation:none!important;transition:none!important}` и принудительно показать reveal-элементы: для нового сайта — класс/атрибут `Reveal`, для старого — классы wow/animated из `main.css`; если их не определить сразу, **прокрутить страницу до низа и обратно** с паузами, чтобы сработали обсерверы);
   - скриншоты **секций** по якорям (`#discount`, `#service`, `#reasons`, `#portfolio`, `#price`, `#clientsc`, `#worksteps`, `#getconsultation`, `#contacts`, шапка, hero, футер) в `e2e/screenshots/{legacy,new}/<width>/<section>.png` и полностраничный `full.png`;
   - для сопоставления секций использовать селекторы `#id`; если у секции в новом сайте другой корневой элемент — искать по заголовку.
3. Тот же spec формирует `e2e/screenshots/index.html` — таблица «секция × ширина» со скриншотами «старый | новый» рядом (простая статическая страница с `<img src="legacy/1920/hero.png">`), открывается двойным кликом.
4. Автоматического пиксель-сравнения **не делать** (старый сайт на `vw`-единицах, новый на `clamp()` — отличия неизбежны): задача — подготовить материал для человека. Агент дополнительно просматривает скриншоты (Read) и перечисляет **явные** расхождения: потерянные секции, неверные цвета/шрифты, горизонтальный скролл, обрезанный текст, поломанные изображения, неверный порядок секций. Явные дефекты (не вкусовые) исправлять.
5. Итог: в отчёте указать путь `e2e/screenshots/index.html`, список найденных/исправленных расхождений и оставшихся «на усмотрение владельца».

#### 4. Lighthouse (mobile)

- На production-сборке (`pnpm build:ci && pnpm start -p 3100`, БД с сидом и фото): `npx --yes lighthouse@12 http://localhost:3100/ --form-factor=mobile --screenEmulation.mobile --only-categories=performance,accessibility,best-practices,seo --output=json --output=html --output-path=./.lighthouse/home --chrome-flags="--headless=new --no-sandbox"` (`npx` скачивает инструмент разово; в `package.json` ничего не добавлять; каталог `.lighthouse/` — в `.gitignore`).
- Страницы: `/`, `/calculator`, `/menu`, `/prices`, `/tournaments`, `/blog` (+ одна статья, если есть).
- **Цели:** Performance ≥ 90 (mobile), LCP < 2.5 с, CLS < 0.1, TBT < 200 мс; SEO ≥ 95, Accessibility ≥ 90, Best Practices ≥ 90.
- Если ниже цели: типичные причины и исправления — hero-картинка без `priority`/слишком большой вариант (`sizes`), Метрика/карта загружаются до взаимодействия (карта — click-to-load фасад, Метрика — после согласия), шрифты Onest без `display: swap`/без preload, неиспользуемый JS (тяжёлые клиентские острова: lightbox, карусель — грузить динамически), картинки без `width/height` (CLS), `Reveal` скрывает LCP-элемент. Исправлять и перепроверять до достижения целей (максимум 3 итерации на страницу; если цель не достигнута — описать узкие места в отчёте).

#### 5. Security-review

1. Запустить скилл/агента `security-scanner` на репозитории (фокус: auth-проверки в каждом Server Action и route handler, загрузка файлов, path traversal в `/media`, XSS (Markdown блога, JSON-LD, названия в админке), SSRF/URL-whitelist видео, rate limit и источник IP (`x-real-ip`), CSRF для Server Actions, заголовки/CSP, секреты в коде/логах, зависимости `pnpm audit --prod`).
2. Дополнительно вручную: `git grep -nE "(bot[0-9]{6,}:|api[_-]?key|password\s*=\s*['\"])"` и поиск токена Telegram/пароля БД из старого сайта (**не копировать их в отчёт**), проверка, что `.env*` не в git (`git ls-files | grep -E "^\.env"` пусто), что `env.example` содержит только заглушки, что в логах нет ПДн/токенов preview; `git grep -n NEXT_PUBLIC_APP_URL` пусто (везде `NEXT_PUBLIC_SITE_URL`).
3. **Критические и высокие находки исправить в коде**, средние — исправить, если правка небольшая, иначе перечислить в отчёте. После исправлений повторить затронутые e2e-тесты.

#### 6. Docker

1. Сборка **без БД и без запущенного Postgres**:

```bash
docker build -t piramida-site:qa \
  --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
  --build-arg NEXT_PUBLIC_YM_ID=106365667 .
```

   Сборка должна пройти без `POSTGRES_URL`. Проверить размер образа, что пользователь не root (`docker run --rm piramida-site:qa id`), наличие `HEALTHCHECK` (`docker inspect`).
2. Запуск против локальной БД (создать чистую БД `piramida_docker`) и именованного тома:

```bash
docker compose exec postgres psql -U dev_user -d postgres_dev -c "CREATE DATABASE piramida_docker;"
docker run -d --name piramida-qa -p 3000:3000 \
  -e POSTGRES_URL=postgresql://dev_user:dev_password@host.docker.internal:5432/piramida_docker \
  -e BETTER_AUTH_SECRET=qa-secret-qa-secret-qa-secret-0123456 \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  -e NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
  -e UPLOAD_DIR=/data/uploads -e CRON_SECRET=qa-cron \
  -v piramida-uploads-qa:/data/uploads piramida-site:qa
```

   (на Windows `host.docker.internal` доступен; иначе использовать сеть docker compose.) Проверки: `docker logs piramida-qa` показывает применение миграций и старт сервера; `curl -i http://localhost:3000/api/health` → 200; повторный `docker restart piramida-qa` не падает (миграции идемпотентны); `docker inspect --format '{{.State.Health.Status}}' piramida-qa` → `healthy`; загрузка файла через админку (после `seed-admin` в этой БД) сохраняется в томе и переживает `docker rm -f` + новый `docker run` с тем же томом; `/media/...` отдаёт файл; `/` отвечает 200 (с пустой БД блоки данных не должны ронять страницу: пустые секции/скелетоны, без 500).
3. Убрать контейнер, том и БД после проверки (`docker rm -f piramida-qa; docker volume rm piramida-uploads-qa`).

#### 7. Финальные ворота качества

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build:ci
pnpm e2e:db && pnpm test:e2e     # Playwright (проекты setup + chromium) — все тесты зелёные
```

Также проверить по `requirements.md` раздел Acceptance Criteria построчно (каждый пункт — «выполнено / способ проверки / замечание») и убедиться, что ни один пункт не остался без покрытия тестом или ручной проверкой.

### Code Snippets

`e2e/helpers/dates.ts`:

```ts
const TZ = 'Asia/Yekaterinburg'
const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** Ближайший (строго после сегодня) день недели dow (0=вс … 6=сб) в зоне клуба, формат YYYY-MM-DD. */
export function nextWeekday(dow: number, from = new Date()): string {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(from.getTime() + i * 86_400_000)
    const wd = new Date(`${fmt.format(d)}T12:00:00Z`).getUTCDay()
    if (wd === dow) return fmt.format(d)
  }
  throw new Error('unreachable')
}
```

`e2e/auth.setup.ts`:

```ts
import { test as setup, expect } from '@playwright/test'
setup('вход администратора', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/email|почта/i).fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel(/пароль/i).fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: /войти/i }).click()
  await expect(page).toHaveURL(/\/admin/)
  await page.context().storageState({ path: 'e2e/.auth/admin.json' })
})
```

Перехват Server Action для теста безопасности:

```ts
const captured: { url: string; headers: Record<string, string>; body: string | null }[] = []
page.on('request', (req) => {
  const h = req.headers()
  if (req.method() === 'POST' && h['next-action']) captured.push({ url: req.url(), headers: h, body: req.postData() })
})
// ... нажать «Сохранить» в админке ...
const anon = await playwright.request.newContext({ baseURL })
const res = await anon.post(captured[0].url, { headers: { 'next-action': captured[0].headers['next-action'], 'content-type': captured[0].headers['content-type'] }, data: captured[0].body ?? '' })
// ожидание: действие не выполнено (ошибка/редирект на /login), состояние БД не изменилось
```

### Environment Variables

Только тестовые (см. `.env.e2e` выше). Реальные секреты не использовать и не коммитить.

### API Endpoints

Проверяются существующие: `/api/health`, `/api/admin/media`, `/api/cron/retention`, `/api/cron/blog`, `/api/auth/*`, `/media/*`, `/sitemap.xml`, `/robots.txt`, `/blog/rss.xml`.

## Acceptance Criteria

- [ ] Тестовая БД `piramida_e2e` создаётся и наполняется командой `pnpm e2e:db` (миграции + seed + seed-admin); `drizzle-kit push` нигде не используется.
- [ ] Все спецификации `e2e/*.spec.ts` (home, lead-form, calculator, admin-pricing, admin-tournament-cover, blog, security, seo-legal) проходят на production-сборке; админ входит один раз через `auth.setup.ts` (лимит входа не срабатывает).
- [ ] Подтверждены сценарии из PLAN §12: главная и якоря; заявка при незаданных SMTP/Telegram сохраняется и видна в админке; ссылка калькулятора воспроизводит расчёт (включая ночь пт→сб, смену тарифа, полчаса, VIP, пенсионера); правка цены в админке сразу видна на сайте (`updateTag`); загрузка афиши турнира; публикация статьи блога; неавторизованный доступ к `/admin` и прямой вызов Server Action отклоняются.
- [ ] Загрузка SVG, поддельных расширений и файлов > 10 МБ отклоняется; path traversal в `/media` невозможен.
- [ ] Проверены решения из «Context from dependencies»: CSP (включая `yastatic.net`, `mc.yandex.com`, `*.yandex.ru`, `vkvideo.ru`), CTA из галереи `cta` с запасными фото, лид типа `tournament`, уровни сеток цен в калькуляторе (`i=<item>-<tier>:qty`), однократная подстановка плейсхолдеров юр. документов, `ipHash = null` после retention, QR 2FA (`react-qr-code`), отсутствие `NEXT_PUBLIC_APP_URL`.
- [ ] Визуальная сверка выполнена: `e2e/screenshots/index.html` содержит пары «старый | новый» для 1920/1440/768/375 по всем секциям; явные расхождения исправлены, оставшиеся перечислены в отчёте.
- [ ] Lighthouse mobile на `/`: Performance ≥ 90, LCP < 2.5 с, CLS < 0.1; остальные проверенные страницы — в отчёте с оценками; найденные узкие места исправлены или описаны.
- [ ] `security-scanner` запущен, критические и высокие находки исправлены, список остальных приведён в отчёте; в репозитории нет секретов старого сайта и `.env*`.
- [ ] `docker build` проходит без БД; контейнер против локальной БД применяет миграции, `/api/health` → 200 и статус `healthy`, перезапуск и повторный запуск с тем же томом сохраняют загруженные файлы; процесс не от root.
- [ ] Пройден построчный чек-лист Acceptance Criteria из `requirements.md` (в отчёте — таблица «пункт — результат»).
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build:ci` проходят без ошибок после всех исправлений.

## Notes

- Эта задача выполняется одна и может править любой файл; изменения минимальные, каждое — с пометкой в отчёте. Если исправление затрагивает контракт или схему — сначала найти минимально инвазивный путь, а при необходимости смены схемы: `pnpm db:generate` + `pnpm db:migrate` и проверка, что `docker` миграция применяется.
- Старый сайт: `http://74.loc` (OSPanel, PHP). Если он недоступен — это ручной шаг владельца (`action-required.md`); без него визуальную сверку выполнить нельзя — не подменять её сравнением «новый с самим собой».
- Тесты зависят от значений сида (цены, 12 столов, 4 места на стол). Если владелец изменил сид, обновить ожидаемые суммы, а не «подгонять» код под тест.
- Цели Метрики (`lead_submit`, `calculator_submit`) в e2e не проверяются сетевыми запросами (Метрика не настроена в тестовой среде): достаточно проверки, что `window.ym` вызывается безопасно (нет исключений при пустом ID).
- Отдельная оговорка из задачи 25: статусы HTTP для `notFound()`/`permanentRedirect()` внутри `<Suspense>` могут отличаться от «чистых» 404/308 — фиксировать фактическое поведение в отчёте, а не считать его ошибкой теста.
- Не добавлять npm-пакеты (Lighthouse запускается через `npx` без установки в проект).

## Отложенные замечания ревью (исправить в этой задаче)

- `src/app/layout.tsx` — root `<Suspense fallback={null}>` вокруг `children`: после задач 13/14 убедиться, что все страницы имеют свои Suspense-границы, и по возможности убрать глобальную обёртку. Если нельзя — задокументировать в DESIGN.md.
- `src/lib/db.ts` — фиктивный URL при сборке: добавить явную ошибку, если запрос выполняется на этапе build.
- `src/lib/schema/menu.ts` — `menuItems.priceGroupId` `set null`: удаление сетки цен в админке (задача 18) должно проверять использование. Проверить.
- `src/lib/calculator/calculate.ts` — нецелые qty: убедиться, что zod в `submitLead` и UI калькулятора разрешает только целые.
- `src/lib/calculator/url-state.ts` — `serializeCalculator` округлять длительность до 0.5 ч.
- `src/lib/notify/lead-templates.ts` — добавить тест: `leadTelegram(..., { includePii: false })` не содержит имя и телефон; type-level проверка совпадения `LeadNotifyType` с enum схемы.
