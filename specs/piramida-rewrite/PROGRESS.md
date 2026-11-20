# Прогресс реализации (сводка выполненных задач для агентов)

## Волна 1
- **task-01**: стартер очищен. Пакеты: next 16.4.6, react 19.3.1, better-auth 1.6.35 (`~1.6`), drizzle-orm 0.45.4, drizzle-kit 0.31.11, zod 4.6, sharp 0.35, file-type 22, nodemailer 10, nuqs 2.10, dnd-kit, react-hook-form 7.92 + @hookform/resolvers 7, date-fns 4 + @date-fns/tz, remark-gfm, remark-directive, react-dropzone, embla, yet-another-react-lightbox, react-qr-code, @tanstack/react-table 8, nanoid 6, server-only, vitest 5, @playwright/test, esbuild, lucide-react 1.76 (имена иконок могли поменяться — проверяй). Все shadcn-компоненты в `src/components/ui/`. `next.config.ts`: cacheComponents, standalone, bodySizeLimit 12mb, CSP. `src/lib/env.ts` по контрактам. `/api/health`. Скрипты: `seed`, `seed:admin`, `import:images`, `test`, `test:e2e`, `build:migrate`.

## Волна 2
- **task-02**:
  - `globals.css`: токены клуба, только светлая тема; классы `text-h1`, `text-h2`, `text-price`, `text-btn`, `container-site`, `container-wide`, `animate-blick`, `reveal`, `link-underline` и др. — см. DESIGN.md;
  - root layout: Onest, `lang="ru"`, Toaster, children в `<Suspense>`;
  - `DESIGN.md` переписан;
  - иконки лежат в `public/icons`, шрифты Onest woff — в `src/assets/fonts`.
- **task-03**: схема в `src/lib/schema/*` (35 таблиц, 14 enum, реэкспорт из `index.ts`, типы `X`/`NewX`, union-типы enum в `enums.ts`), миграция `drizzle/0000_init.sql` применена. `src/lib/db.ts` собирается без БД.
- **task-04**: Dockerfile (node:22-alpine, pnpm 11.1.3), `docker-entrypoint.sh` (migrate → server), `scripts/migrate.ts`. Образ собирается без БД (301 МБ), healthcheck работает.
- **task-05**: `src/lib/calculator/*`: `calculateQuote`, `buildMenuVariants`, url-state (`calculatorParsers`, `serializeCalculator`, `parseCalculatorSearchParams`), `isValidIsoDate`, 62 теста.
- **task-06**:
  - `src/lib/dates.ts`: `TZ`, `getOpDate`, `getToday`, `formatEventDate`, `minToClock`, `clockToMin`, `parseLocalDateTime`;
  - `src/lib/slug.ts`: `slugify`, `nanoCode`;
  - `src/lib/request-ip.ts`: `getClientIp`, `hashIp`;
  - `src/lib/rate-limit.ts`;
  - `src/lib/seo/jsonld.ts`: `jsonLdScript`, `localBusinessJsonLd`, `sportsEventJsonLd`, `articleJsonLd`, `breadcrumbJsonLd`, `menuJsonLd`, `organizationJsonLd`, `personJsonLd`.
- **task-07**: `src/lib/notify/{email,telegram,lead-templates}.ts`: `sendEmail`, `sendTelegram`, `escapeHtml`, `leadEmail`, `leadTelegram`, `adminLeadUrl`, `LeadForNotify`, `LEAD_TYPE_LABELS`, `CALLBACK_WINDOW_LABELS`, `formatRub`. Если SMTP или Telegram не настроены, функции возвращают `not_configured` и ничего не бросают.

## Волна 3
- **task-08**:
  - Better Auth: плагины `admin` и `twoFactor` (issuer «Пирамида — админка»), `disableSignUp`, rate limit в БД (sign-in и 2FA — 5/60s), IP из `x-real-ip`, письмо для сброса пароля через `sendEmail`;
  - `src/lib/session.ts`: `getSession`, `requireAdmin` (redirect на `/login`), `requireAdminAction` (throw UNAUTHORIZED);
  - `proxy.ts` — matcher `/admin`, безопасный `?next=`;
  - страницы `/login` (+ шаг 2FA), `/forgot-password`, `/reset-password`;
  - `scripts/seed-admin.ts` (`pnpm seed:admin --email --password --name`).
- **task-09**:
  - `src/lib/media/{validate,process,storage,url}.ts`: `saveImage(file, {folder, alt?, userId?, originalName?})`, `deleteMedia(id)` → `ok`/`in_use`/`not_found`, `resolveMediaPath`, `mediaUrl`;
  - маршрут `GET /media/[...path]`;
  - компонент `<Picture asset sizes alt priority className />` (`src/components/media/picture.tsx`).
- **task-10**: `scripts/seed.ts` + `scripts/seed-data/*`. Идемпотентно заполняет БД: 4 зала, 12 тарифов, 56 штрафов, 30 турниров, 8 акций, 47 категорий, 256 позиций, 3 сетки цен, 2 сета, 4 услуги, 8 пустых галерей, 2 юр. документа, 20 настроек.
- **task-11**:
  - `submitLead` в `src/lib/actions/leads.ts` (схема в `leads-schema.ts`);
  - компоненты `src/components/leads/{lead-form,lead-dialog,policy-dialog,phone-input}.tsx` (`LeadForm`, `LeadDialogTrigger` с kind callback/booking/promo/tournament);
  - `src/lib/phone.ts`, `src/lib/metrika.ts` (`reachGoal`);
  - страница `/spasibo`, файл `public/images/popup-bg.webp`.
- **task-12**:
  - `src/lib/cache-tags.ts` (`TAGS`, `articleTag`);
  - `src/lib/settings-defaults.ts` (`SiteSettings`, 20 ключей, `mergeSettings`);
  - `src/lib/queries/*` (`getSettings`, `getUpcomingTournaments(opDate)`, `getSeasonTournaments`, `getTournamentYears`, `getHalls`, `getTariffs`, `getExtraServices`, `getPenalties`, `getPriceFrom`, `getActivePromotions`, `getCarouselPromotions`, `getMenuTree`, `getBanquetSets`, `getGallery`, `getServices`, `getCurrentLegalDocument`, `getCalculatorCatalog`), тип `PublicMedia`, совместимый с `<Picture>`;
  - некэшируемая функция `fetchCalculatorCatalog(db)` в `queries/calculator-fetch.ts`, общая для сайта и сервера.

## Волна 4 (+ общие правки)
- **`cn()`** (`src/lib/utils.ts`) понимает кастомные размеры шрифта (`text-h1`, `text-h2`, `text-calendar-title`, `text-card-title`, `text-promo-title`, `text-price`, `text-hero-sub`, `text-badge-size`, `text-popup-title`, `text-body-lg`, `text-btn`), поэтому их можно смешивать с цветами. Размер бейджа — **`text-badge-size`**, а `text-badge` — это цвет.
- **task-13**:
  - `src/app/(site)/layout.tsx` (Header, `<main id="main-content">`, Footer, CookieBanner, Metrika — только после согласия);
  - в `src/components/site/`: `Container` (`container.tsx`), `SectionTitle` (`section-title.tsx`, `text-h1`/`text-h2`), `PrimaryButton` (`primary-button.tsx`, `text-btn` + блик), `Reveal` (`reveal.tsx`, атрибут `data-reveal`), а также `header`, `mobile-menu`, `nav-items`, `footer`, `cookie-banner`, `cookie-consent`, `metrika`, `social-icons`, `back-to-top`;
  - `not-found.tsx` в стиле старого сайта.
- **task-14**:
  - layout админки `src/app/(admin)/admin/layout.tsx` (sidebar со всеми разделами), дашборд;
  - `/admin/media` (медиатека), `POST`/`GET /api/admin/media`;
  - в `src/components/admin/`:
    - `DataTable` (`columns`, `data`, `searchPlaceholder?`, `filters?`, `pageSize?`, `getRowHref?`, `emptyText?`, `toolbar?`; хелпер `sortableHeader`);
    - `SortableList` (`items`, `onReorder(ids)`, `renderItem(item, ctx{dragHandle, moveUp, moveDown, canMoveUp, canMoveDown, index})`);
    - `ImageUploadField` (`value`, `initialAsset?`, `onChange(mediaId, asset)`, `folder`, `label?`, `aspect?`);
    - `MediaPicker` (`open`, `onOpenChange`, `onSelect(assets[])`, `multiple?`, `folder?`);
    - `ConfirmDialog` (`trigger`, `title`, `description?`, `confirmLabel?`, `destructive?`, `onConfirm`);
    - `FormActions` (`isSubmitting?`, `submitLabel?`, `cancelHref?`, `onDelete?`, `extra?`);
    - `PageHeader` (`title`, `description?`, `actions?`, `backHref?`, `breadcrumbs?`).

    Колбэки `onReorder`/`onConfirm`/`onDelete` можно передавать прямо из `adminAction`: результат `{ok:false}` откатывает изменение и показывает toast.
  - в `src/lib/admin/`: `action.ts` (`adminAction(schema, (input, ctx:{userId, tx}) => …, {tags})` → `{ok:true,data}|{ok:false,error,fieldErrors?}`; `redirect()` внутри handler коммитит транзакцию; `ActionError` — для ошибок, показываемых пользователю), `audit.ts`, `media-dto.ts` (`MediaDto`), `media-queries.ts`, `media-client.ts`.
- **task-15**: `scripts/import-legacy-images.ts` (`pnpm import:images --source C:\OSPanel\home\74.loc`). Галереи заполнены (hero 1, услуги по 5, bar 6, about 1, cta 2), у акций и всех 30 турниров есть обложки. В `public/images/`: `logo.png`, `logo.webp`, `work-steps-bg.webp`, `tournament-default.webp`.
- **Важно для локального `next start`:** задать `UPLOAD_DIR=./.data/uploads` (в production по умолчанию `/data/uploads`).
