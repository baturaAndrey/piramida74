# Task 19: Админка — галереи, услуги, настройки, юр. документы, заявки, аккаунт, cron обезличивания

## Status

pending

## Wave

5

## Description

Остальные разделы админки, не связанные с каталогом: фото-галереи сайта, тексты 4 вкладок «Услуги», настройки сайта (контакты, тексты hero и «О клубе», SEO, реквизиты оператора, уведомления, срок хранения заявок), версии юридических документов (политика, согласие), заявки с карточкой, повтором уведомления и CSV-экспортом, аккаунт (пароль, 2FA) и cron-маршрут обезличивания старых заявок по 152-ФЗ. Все изменения на сайте видны сразу через `updateTag`.

## Dependencies

**Depends on:** task-14-admin-shell.md, task-12-public-queries.md, task-07-notify-lib.md, task-11-lead-capture.md (и транзитивно 03, 06, 08, 09)
**Blocks:** task-28-qa-verification.md

**Context from dependencies:**
- task-03 создал схему Drizzle: `src/lib/schema/club.ts` (`galleries` — `key text` **unique (не enum)**, `title`; `galleryItems` — `galleryId`, `mediaId`, `caption?`, `variant` (`'default' | 'mobile'`), `sortOrder`; `services` — `key` (`russian|american|vip|training`), `title`, `subtitle?`, `bullets text[]`, `priceFrom?`, `priceFromHallKind?`, `priceNote?`, `ctaType varchar` (`'booking' | 'callback'`, default `'booking'`), `ctaBlock text` (значение `sourceBlock` для заявки с кнопки), `galleryKey?` (→ `galleries.key`), `sortOrder`, `isActive`; колонки `description` нет), `src/lib/schema/leads.ts` (`leads`: `number` identity, `type`, `status`, `sourceBlock`, `formTitle`, `pageUrl`, `name?`, `phone?`, `callbackWindow?`, `preferredDate?`, `preferredTime?`, `guests?`, `comment?`, `promotionId?`, `tournamentId?`, `quoteSnapshot jsonb?`, `quoteTotal?`, `consentDocumentId`, `consentAt`, `ipHash char(64)` **nullable**, `userAgent`, `notifyStatus jsonb`, `anonymizedAt?`, `createdAt`; `legalDocuments`: `type` (`legal_doc_type`), `version varchar(32)`, `title text` (default `''`), `body text` (markdown **с плейсхолдерами**), `sha256 char(64)`, `publishedAt timestamptz` **nullable** (`null` = черновик), `createdAt`; уникальность `(type, version)`), `src/lib/schema/media.ts` (`mediaAssets` с `alt`, `folder`, `variants`), `src/lib/schema/settings.ts` (`siteSettings`: `key` text PK, `value jsonb`, `updatedAt`; `auditLog`). Enum'ы: `lead_type` = `callback|booking|promo|calculator|tournament`; `lead_status` = `new|in_progress|done|spam`; `callback_window` = `now|hour|day|week`; `legal_doc_type` = `policy|consent`. **Прочитайте эти файлы схемы до начала.**
- task-14: каркас админки, `src/components/admin/{data-table,sortable-list,image-upload-field,media-picker,confirm-dialog,form-actions,page-header}.tsx`, `POST /api/admin/media` (multipart, `requireAdminAction` → 401; возвращает `mediaId` — посмотрите точный формат запроса/ответа в `image-upload-field.tsx` и в самом route handler), `src/lib/admin/action.ts`, `src/lib/admin/audit.ts`. **Откройте компоненты** и возьмите их точные пропсы. Контракт `adminAction` (зафиксирован):
  ```ts
  export type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
  export class ActionError extends Error { constructor(message: string, readonly fieldErrors?: Record<string, string[]>) }
  export type ActionCtx = { userId: string; tx: DbOrTx }
  export function adminAction<S extends z.ZodType, T>(
    schema: S,
    handler: (input: z.output<S>, ctx: ActionCtx) => Promise<T>,
    opts: { tags: string[] | ((input: z.output<S>, result: T) => string[]) },
  ): (input: z.input<S>) => Promise<ActionResult<T>>
  ```
  Порядок: `requireAdminAction()` (нет админа → `{ ok: false, error: 'Нет доступа' }`) → `schema.safeParse` (→ `fieldErrors`) → `db.transaction(tx => handler(input, { userId, tx }))` → после коммита `updateTag` по тегам → `{ ok: true, data }`. Ошибка для пользователя — `throw new ActionError('текст', fieldErrors?)`.
  Аудит обёртка **не пишет** — handler сам: `import { audit } from '@/lib/admin/audit'`, `audit(userId: string, action: string, entity: string, entityId: string, diff?: unknown, tx?: DbOrTx): Promise<void>` → `await audit(ctx.userId, 'gallery.reorder', 'gallery', key, diff, ctx.tx)`. Вне `adminAction` (route handlers) — `await audit(session.user.id, …)` без `tx`.
- task-12: `src/lib/cache-tags.ts` (`TAGS.galleries`, `TAGS.services`, `TAGS.settings`, `TAGS.legal`), `src/lib/queries/settings.ts` (`getSettings(): Promise<SiteSettings>` с дефолтами), `src/lib/settings-defaults.ts` (`SiteSettings`, `SETTINGS_DEFAULTS`, `SETTING_KEYS`, `mergeSettings(rows)`; модуль без серверных импортов — можно импортировать в клиентскую форму), `getCurrentLegalDocument(type)` → `{ id; type; version; title; text; publishedAt; sha256 } | null` (`text` уже с подставленными плейсхолдерами; **подстановка — только там**). Канонический тип (других ключей нет; `workingHours`, `mapLat`, `mapLon`, `mapYandexOid`, `mapEmbedUm`, `operatorName`/…, `retentionMonths`, `seo` **не существуют**):
  ```ts
  export type SiteSettings = {
    phone: string; phoneHref: string /* "tel:+79000685000" — готовый href */; email: string;
    address: string; addressNote: string; hours: string; telegramUrl: string; vkUrl: string;
    mapConstructorId: string /* с префиксом "constructor:" */; mapOrgId: string; geo: { lat: number; lon: number };
    heroTitle: string; heroSubtitle: string; heroBadgePhrases: string[];
    aboutTitle: string; aboutPoints: { title: string; text: string }[];
    seoDefaults: { title: string; description: string; ogImageMediaId: string | null };
    operator: { name: string; inn: string; ogrn: string; address: string; email: string };
    telegramIncludePii: boolean /* default false */; leadRetentionMonths: number /* default 12 */;
  }
  ```
  Каждый ключ — отдельная строка `siteSettings` (`key` = имя поля верхнего уровня, `value` = jsonb, для `geo`/`seoDefaults`/`operator` — объект целиком).
- task-07: `src/lib/notify/{email,telegram,lead-templates}.ts` (`sendEmail`, `sendTelegram`, `leadEmail(lead)`, `leadTelegram(lead, { includePii })`).
- task-08: `src/lib/auth.ts` (Better Auth с плагинами `admin`, `twoFactor` с `issuer: 'Пирамида — админка'`), `src/lib/auth-client.ts` (клиент с `twoFactorClient`), `src/lib/session.ts` (`requireAdmin()` — только страницы/layout'ы, redirect на `/login`; `requireAdminAction()` — Server Actions и route handlers, без админа бросает `Error('UNAUTHORIZED')`, возвращает сессию). В route handlers `/api/admin/*`: `let session; try { session = await requireAdminAction() } catch { return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 }) }`.
- task-01 установил `react-qr-code` (QR для 2FA): `import QRCode from "react-qr-code"`, `<QRCode value={totpURI} />`.
- task-06: `src/lib/dates.ts` (`TZ`, `getToday`), `src/lib/request-ip.ts`.
- task-11: формат `notifyStatus` в `leads`: `{ email?: { ok: boolean; error?: string; at: string }, telegram?: { ok: boolean; error?: string; at: string } }` — подтвердите по коду `src/lib/actions/leads.ts` и используйте тот же формат.

## Files to Create

Галереи:
- `src/app/(admin)/admin/galleries/page.tsx`
- `src/app/(admin)/admin/galleries/_components/gallery-editor.tsx` — загрузка нескольких файлов, сортировка, alt/caption, удаление
- `src/app/(admin)/admin/galleries/_lib/labels.ts` — ключи и подписи галерей
- `src/app/(admin)/admin/galleries/_queries.ts`, `_schema.ts`, `_actions.ts`

Услуги:
- `src/app/(admin)/admin/services/page.tsx`
- `src/app/(admin)/admin/services/_components/service-form.tsx`
- `src/app/(admin)/admin/services/_queries.ts`, `_schema.ts`, `_actions.ts`

Настройки:
- `src/app/(admin)/admin/settings/page.tsx`
- `src/app/(admin)/admin/settings/_components/settings-form.tsx`
- `src/app/(admin)/admin/settings/_components/telegram-pii-switch.tsx`
- `src/app/(admin)/admin/settings/_schema.ts`, `_actions.ts`

Юридические документы:
- `src/app/(admin)/admin/legal/page.tsx` — версии по типам
- `src/app/(admin)/admin/legal/new/page.tsx` — новая версия (`?type=policy|consent`)
- `src/app/(admin)/admin/legal/[id]/page.tsx` — просмотр / правка черновика
- `src/app/(admin)/admin/legal/_components/legal-form.tsx`, `legal-versions.tsx`
- `src/app/(admin)/admin/legal/_schema.ts`, `_queries.ts`, `_actions.ts`

Заявки:
- `src/app/(admin)/admin/leads/page.tsx` — список с фильтрами и пагинацией
- `src/app/(admin)/admin/leads/[id]/page.tsx` — карточка
- `src/app/(admin)/admin/leads/_components/leads-table.tsx`, `leads-filters.tsx`, `lead-status-select.tsx`, `resend-notification-button.tsx`, `quote-snapshot-view.tsx`
- `src/app/(admin)/admin/leads/_lib/labels.ts` — подписи типов/статусов/окон звонка, цвета бейджей
- `src/app/(admin)/admin/leads/_lib/filters.ts` — разбор `searchParams` в условие drizzle (общий для списка и CSV)
- `src/app/(admin)/admin/leads/_queries.ts`, `_actions.ts`
- `src/app/api/admin/leads/export/route.ts` — `GET /api/admin/leads/export` (CSV)

Аккаунт:
- `src/app/(admin)/admin/account/page.tsx`
- `src/app/(admin)/admin/account/_components/change-password-form.tsx`, `two-factor-card.tsx`

Cron:
- `src/app/api/cron/retention/route.ts` — `POST /api/cron/retention`

## Files to Modify

Нет. Не трогать схему, `src/lib/queries/**`, `src/lib/auth*.ts`, `package.json`, `globals.css`, admin layout, `src/components/admin/*`, `src/components/ui/*`. Если нужного shadcn-компонента (`tabs`, `form`, `select`, `switch`, `alert-dialog`, `badge`, `table`, `accordion`, `textarea`) нет — сообщите в отчёте.

## Technical Details

### Общие правила

1. Страницы админки: синхронный компонент → `<Suspense>` → async `Content` с `await requireAdmin()` и запросами (cacheComponents). Следуйте шаблону task-14.
2. Мутации — через `adminAction(schema, async (input, ctx) => { … }, { tags })`. Для разделов без публичного кэша (заявки) `tags: []`. Каждый handler сам пишет аудит: `await audit(ctx.userId, '<entity>.<op>', '<entity>', id, diff, ctx.tx)`; сущности `gallery`, `gallery_item`, `service`, `settings`, `legal_document`, `lead`. Аккаунт (пароль, 2FA) — только через `authClient`, своих actions нет.
3. Формы: `react-hook-form` + `zodResolver` + shadcn `Form`; успех — `toast.success`; ошибки — `toast.error`.
4. Удаления — `ConfirmDialog`. Интерфейс на русском, по `DESIGN.md`, пригоден на 375px.
5. Даты и время в интерфейсе выводить в зоне `Asia/Yekaterinburg`: `new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' })`.

---

### A. `/admin/galleries`

`galleries.key` — свободный `text` unique (не enum). Системные ключи, которые создаёт seed (задача 10) и на которые опирается код сайта (подписи в `labels.ts`, `SYSTEM_GALLERY_KEYS`): `hero` «Первый экран (hero)», `service_russian` «Услуги — Русский бильярд», `service_pool` «Услуги — Американский бильярд», `service_vip` «Услуги — VIP-комнаты», `service_training` «Услуги — Обучение», `bar` «Бар и кухня», `about` «О клубе (фон)», `cta` «Блок «Оставьте заявку» (фон/фото)». Страница: слева список галерей из БД (системные сверху с подписями, затем остальные по `title`; на мобильных — Select) + кнопка «Новая галерея», справа редактор выбранной галереи (`?key=`).

**Создание галереи**: Dialog с полями `key` (zod `z.string().regex(/^[a-z0-9_]{2,64}$/, 'Только латиница в нижнем регистре, цифры и _ (2–64)')`, уникальность проверяется в action → `ActionError` с `fieldErrors.key`) и `title` (1–120). Action `createGallery({ key, title })`. Подсказка: «Сайт показывает только системные галереи; новые можно привязать к услуге (поле «Галерея» в /admin/services)».
**Удаление галереи** — `deleteGallery({ key })`: для 8 системных ключей **запрещено** (кнопка не показывается, action отклоняет `ActionError('Системную галерею удалить нельзя')`); для прочих — `ConfirmDialog` с предупреждением, если на ключ ссылается `services.galleryKey` (тогда отклонить с перечислением услуг). Удаляются строки `galleryItems` и `galleries`, файлы остаются в медиатеке. Переименование `title` — `renameGallery({ key, title })`; `key` после создания не меняется.

Подсказки по размерам (показать в редакторе): hero — «1920×1080 и больше, первое фото — главное»; услуги — «5 фото, первое показывается крупно (≈ 3:2)»; бар — «6 фото, первое крупно (≈ 21:9)»; about — «1 фото 1920×1080, тёмное»; cta — «1–2 фото (фон и фото человека); пусто — сайт покажет стандартные изображения».

**`gallery-editor.tsx`** (клиент):
- Кнопка «Добавить фото» + зона drag-and-drop файлов; `<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple>`. Для каждого файла последовательно (ограничение параллелизма 2): `fetch('/api/admin/media', { method:'POST', body: formData })` **так же, как это делает `image-upload-field.tsx`** (прочитайте его и повторите имена полей FormData: файл, `folder = galleries/<key>`, `alt`), получить `mediaId`, затем один вызов `addGalleryItems({ key, mediaIds })`. Прогресс по каждому файлу, ошибки (формат/размер >10 МБ) показываются у файла, остальные продолжают загружаться.
- Сетка миниатюр (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`) на `sortable-list`; порядок → `reorderGalleryItems({ key, ids })`. Первая миниатюра помечена бейджем «Главное».
- Карточка элемента: миниатюра (`<Picture>`), Input `alt` (до 160; пишет в `mediaAssets.alt`), Input `caption` (до 160; `galleryItems.caption`), кнопки «Сохранить» (появляется при изменениях) и «Убрать из галереи» (`ConfirmDialog`; удаляется только `galleryItems`, файл остаётся в медиатеке).
- Для пустой галереи — пустое состояние «Фото ещё нет».

Actions (`tags: [TAGS.galleries]`, каждый с `await audit(ctx.userId, …, ctx.tx)`): `createGallery`, `renameGallery`, `deleteGallery`, `addGalleryItems` (если строки `galleries` с таким `key` нет — создать `insert … onConflictDoNothing`, `title` — подпись из `labels.ts` или сам `key`; новые элементы добавляются в конец), `updateGalleryItem({ id, alt, caption })`, `removeGalleryItem({ id })`, `reorderGalleryItems({ key, ids })`. `key` во всех схемах — `z.string().regex(/^[a-z0-9_]{2,64}$/)` (не `z.enum`).

### B. `/admin/services`

Четыре вкладки (`Tabs`) по строкам `services` в порядке `sortOrder` (русский, американский, VIP, обучение). Форма на вкладку: `title` (до 80), `subtitle` (Textarea до 600; эмодзи допускаются), `bullets` — список строк (Input + кнопка «+ Пункт», удаление, ↑/↓; 0–8 пунктов до 120 симв.), `priceFrom` (целое ≥ 0, необязательно; подсказка «Пусто — цена «от» считается автоматически из тарифов (Русский/Американский/VIP). Для «Обучения» заполните вручную, например 2580»), `priceNote` (до 80, например «Тренер + стол»), `ctaType` (Select: `booking` «Забронировать» / `callback` «Оставить заявку»; zod `z.enum(['booking','callback'])`, по умолчанию `booking`), `ctaBlock` (Input до 60, латиница/цифры/`_`/`-`, например `service_russian` — уходит в `leads.sourceBlock`; подсказка «Метка блока в заявках»), `galleryKey` (Select из ключей существующих галерей + «Без галереи»; ссылка «Редактировать галерею» → `/admin/galleries?key=…`). Action `saveService` (`tags: [TAGS.services]`, `await audit(ctx.userId, 'service.update', 'service', id, diff, ctx.tx)`). Если строк `services` меньше четырёх (не засеяно) — показать пустое состояние с пояснением «Запустите seed».

### C. `/admin/settings`

Данные читаются через `getSettings()` (после `updateTag` он возвращает свежие значения). Форма — группы в `Accordion`/`Card` (все открыты на десктопе). Ключи — **ровно** поля `SiteSettings` (см. «Context from dependencies»; других нет):

| Группа | Ключ | Тип / ограничение |
|---|---|---|
| Контакты | `phone` | string, как показывать: «+7 (900) 068-50-00» |
| | `phoneHref` | string — **готовый href** с префиксом: `tel:+79000685000`; zod `regex(/^tel:\+\d{11,15}$/, 'Формат: tel:+79000685000')`; кнопка «Заполнить из телефона» собирает `tel:+` + цифры из `phone` (8 в начале → 7). На сайте используется как `href={settings.phoneHref}` без добавления `tel:` |
| | `email` | email |
| | `address` | string до 200, «г. Челябинск, Орджоникидзе 58а к3» |
| | `addressNote` | string до 200, «Горсад им. А.С. Пушкина» |
| | `hours` | string до 100, «Ежедневно 09:00–02:00» |
| | `telegramUrl`, `vkUrl` | https URL (VK — `vk.ru`) |
| | `geo` | объект `{ lat: number (−90..90), lon: number (−180..180) }` — два Input «Широта» / «Долгота» (55.153739, 61.404441) |
| | `mapOrgId` | string из цифр (47911977113) — oid организации в Яндекс Картах |
| | `mapConstructorId` | string — значение `um=` конструктора Яндекс Карт **с префиксом** `constructor:` (zod `regex(/^constructor:[A-Za-z0-9_-]+$/)` или пусто) |
| Hero | `heroTitle` | string до 200 |
| | `heroSubtitle` | string до 300 |
| | `heroBadgePhrases` | string[] 1–10 фраз до 40 симв. (список Input + «+», ↑/↓) |
| О клубе | `aboutTitle` | string до 300 |
| | `aboutPoints` | массив из 4 объектов `{ title, text }` (до 40 и 160 симв.) |
| SEO по умолчанию | `seoDefaults` | объект `{ title: string до 70; description: string до 200; ogImageMediaId: uuid \| null }` — OG-картинка выбирается через `image-upload-field` / `media-picker` (`folder="seo"`, подсказка «1200×630») |
| Реквизиты оператора ПДн | `operator` | объект `{ name: string (ИП/ООО, до 200); inn: цифры 10 или 12 \| ''; ogrn: цифры 13 или 15 \| ''; address: string до 300; email: email \| '' }` — пять Input в одной группе |
| Хранение заявок | `leadRetentionMonths` | целое 1–120, по умолчанию 12; подсказка «Через этот срок имя, телефон, комментарий и хэш IP заявки удаляются автоматически» |
| Уведомления | `telegramIncludePii` | boolean — **не в этой форме**, отдельный компонент (см. ниже) |

ID Яндекс Метрики в настройках **нет** (только env `NEXT_PUBLIC_YM_ID`).

Action `saveSettings` (`tags: [TAGS.settings]`): zod-схема `settingsSchema` (в `_schema.ts`) со всеми ключами **кроме** `telegramIncludePii`; `settingsSchema` типизирован как `z.ZodType<Omit<SiteSettings, 'telegramIncludePii'>>` (ключи из `SETTING_KEYS` без `telegramIncludePii`); handler `async (input, ctx)` читает текущие строки через `ctx.tx`, делает upsert по каждому изменившемуся ключу верхнего уровня: `ctx.tx.insert(siteSettings).values({ key, value }).onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } })` (`geo`, `seoDefaults`, `operator` пишутся объектом целиком), затем `await audit(ctx.userId, 'settings.update', 'settings', '*', { [key]: { from, to } /* только изменённые */ }, ctx.tx)`. Пустые необязательные строки сохраняются как `''`; `mergeSettings(rows)` подставляет дефолты из `SETTINGS_DEFAULTS` только для отсутствующих ключей.

**`telegram-pii-switch.tsx`**: отдельный Switch «Включать имя и телефон в Telegram-уведомления» вне основной формы, текст-предупреждение: «Telegram хранит данные за пределами РФ. Включая этот флаг, вы осознанно соглашаетесь на трансграничную передачу персональных данных клиентов. По умолчанию выключено». Включение открывает `AlertDialog` с обязательным Checkbox «Я понимаю и беру ответственность» (кнопка «Включить» disabled до отметки); выключение — без подтверждения. Action `setTelegramPii({ enabled: boolean, confirmed: boolean })` (`tags: [TAGS.settings]`): при `enabled = true` zod требует `confirmed === true`; пишет `telegramIncludePii` в `siteSettings` (отдельная строка, ключ `telegramIncludePii`) и **обязательно** в handler: `await audit(ctx.userId, 'settings.telegramIncludePii', 'settings', 'telegramIncludePii', { from, to, confirmed }, ctx.tx)` (обёртка аудит не пишет — дублирования нет).

### D. `/admin/legal`

Две секции — «Политика обработки ПДн» и «Согласие на обработку ПДн». В каждой: бейдж «Текущая версия» у опубликованного документа с максимальным `publishedAt` (именно его возвращает `getCurrentLegalDocument(type)`), таблица всех версий (версия, статус «Черновик»/«Опубликован»/«Архив», дата публикации, sha256 первые 8 символов, действие «Открыть») и кнопка «Создать новую версию».

**Форма (`legal-form.tsx`)**: `type` (из `?type`), `title` (Input до 200, например «Политика обработки персональных данных»), `body` — большой Textarea (markdown, 12+ строк) с вкладками «Редактор / Предпросмотр» (предпросмотр — `react-markdown` + `remark-gfm`, уже установлены). В БД `body` сохраняется **с плейсхолдерами как есть**. Предпросмотр может подставлять значения по тем же правилам, что и публичная выдача (значения из `getSettings()` передаются в форму пропсом, `{{site_url}}` — `process.env.NEXT_PUBLIC_SITE_URL`, пустое → «[не указано]»), но это только превью: на сайте подстановку делает исключительно `getCurrentLegalDocument(type)` (задача 12). Подсказка: «Можно использовать плейсхолдеры `{{operator_name}}`, `{{operator_inn}}`, `{{operator_ogrn}}`, `{{operator_address}}`, `{{operator_email}}`, `{{phone}}`, `{{site_url}}`, `{{retention_months}}` — они подставляются из «Настроек» при показе страницы (пустое значение → «[не указано]»). Хэш считается от исходного текста с плейсхолдерами». Других плейсхолдеров нет; при сохранении неизвестные `{{…}}` дают предупреждение (`toast.warning`), но не блокируют. Кнопки: «Сохранить черновик» и «Опубликовать» (с `ConfirmDialog`: «Опубликованную версию нельзя изменить. Новые согласия будут ссылаться на неё»).

Правила:
- Версия (`version varchar(32)`) назначается автоматически: строка `YYYY-MM-DD` (дата в `TZ`) с суффиксом `-2`, `-3`… при совпадении внутри типа (уникальность `(type, version)`).
- `sha256 = createHash('sha256').update(body, 'utf8').digest('hex')` (`node:crypto`) вычисляется на сервере при **каждом** сохранении текста.
- Черновик (`publishedAt = null`) можно править и удалять. **Опубликованные версии неизменяемы:** action отклоняет любое изменение/удаление (на них ссылаются `leads.consentDocumentId`); страница `[id]` в этом случае показывает текст в режиме «только чтение» без кнопок.
- `publishLegalDocument({ id })` ставит `publishedAt = now()` — версия становится текущей автоматически; старые остаются в архиве.
- Tag: `TAGS.legal` (на публичные страницы `/politika`, `/soglasie`).

Actions (`tags: [TAGS.legal]`, аудит `legal_document.create|update|publish|delete` через `await audit(ctx.userId, …, id, diff, ctx.tx)`): `saveLegalDraft`, `publishLegalDocument`, `deleteLegalDraft`.

### E. `/admin/leads`

**Список.** `searchParams`: `status`, `type`, `q` (по имени, телефону, номеру заявки; номер — точное совпадение `number = N`, если `q` целое), `from`, `to` (даты `YYYY-MM-DD`, по `createdAt` в зоне Екатеринбурга), `page` (по 50). Разбор — `_lib/filters.ts`, функция `buildLeadsWhere(params)` возвращает условие drizzle; используется и в CSV.

Фильтры (`leads-filters.tsx`): Select статуса («Все», Новые, В работе, Готово, Спам), Select типа («Все», Обратный звонок, Бронь, Акция, Калькулятор, Турнир), поиск, два date-input, кнопка «Сбросить». Изменение фильтров → `router.replace` с `useTransition`, `page` сбрасывается. Кнопка «Экспорт CSV» ведёт на `/api/admin/leads/export?<те же параметры>`.

Колонки (`leads-table.tsx` на `data-table`): № (`#123`), Дата (Екатеринбург, «20 ноя, 14:05»), Тип (бейдж), Блок (`sourceBlock`), Имя (или «обезличено» серым, если `anonymizedAt`), Телефон (ссылка `tel:`), Гостей, Сумма (`quoteTotal` «12 400 ₽» или «—»), Статус (цветной бейдж: `new` синий, `in_progress` жёлтый, `done` зелёный `text-green-600`, `spam` серый), Уведомления (две иконки `Mail`/`Send` — зелёная/красная/серая по `notifyStatus`). Строка кликабельна → `/admin/leads/[id]`. Новые заявки (`status = 'new'`) выделены жирным. Сортировка: `createdAt desc`. Пагинация «Назад/Вперёд» с общим числом.

**Карточка `/admin/leads/[id]`.** Блоки:
1. Шапка: «Заявка #N», дата, бейджи типа и статуса, кнопка «Назад к списку».
2. Контакты и запрос: имя, телефон (`tel:`), `callbackWindow` (подписи: `now` «Сейчас», `hour` «В течение часа», `day` «В течение дня», `week` «На этой неделе»), `preferredDate`/`preferredTime`, `guests`, `comment`, форма (`formTitle`), блок (`sourceBlock`), страница (`pageUrl`), связанная акция/турнир (названия ссылками), согласие (версия/дата `consentAt`, ссылка на документ), `userAgent` (мелко). Если `anonymizedAt` — плашка «Персональные данные удалены {дата} по сроку хранения».
3. **Расчёт (`quote-snapshot-view.tsx`)**: если `quoteSnapshot` есть — таблица строк `{ kind, label, qty, unitPrice, total }` (подписи `kind`: аренда/позиция/сет/услуга), итоги `rentalTotal`, `foodTotal`, `total`, `perGuest`, список `warnings` (жёлтый Alert) и `promoHints`. Входные данные расчёта (дата визита, начало, длительность, гости, зал, столы) — из snapshot, если там есть `input`.
4. Статус: `lead-status-select.tsx` — Select; смена вызывает `setLeadStatus({ id, status })` (`tags: []`; в handler `await audit(ctx.userId, 'lead.status', 'lead', id, { from, to }, ctx.tx)`).
5. Уведомления: статус email и Telegram (`ok`/ошибка/время из `notifyStatus`) и кнопка «Повторить уведомление» (`resend-notification-button.tsx`) → action `resendLeadNotification({ id })`.

`resendLeadNotification`: загружает заявку и `getSettings()`; вызывает `sendEmail({ ...leadEmail(lead) })` и `sendTelegram(leadTelegram(lead, { includePii: settings.telegramIncludePii }))` (точную форму возвращаемых значений шаблонов смотрите в `src/lib/notify/lead-templates.ts`); результат записывает в `leads.notifyStatus` (`{ email: { ok, error?, at }, telegram: { ... } }` — `at` в ISO) и возвращает его клиенту для `toast`; аудит `await audit(ctx.userId, 'lead.resend', 'lead', id, notifyStatus, ctx.tx)`. Action — `adminAction(z.object({ id: z.string().uuid() }), async (input, ctx) => { … }, { tags: [] })`. Если `anonymizedAt` — кнопка disabled («данные удалены»), action отклоняет `ActionError`.

**CSV `GET /api/admin/leads/export`:**

```ts
import { requireAdminAction } from '@/lib/session';
import { audit } from '@/lib/admin/audit';

export async function GET(req: Request) {
  let session;
  try { session = await requireAdminAction(); }          // бросает Error('UNAUTHORIZED'); redirect из route handler не делаем
  catch { return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 }); }
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await db.select().from(leads).where(buildLeadsWhere(params)).orderBy(desc(leads.createdAt)).limit(20000);
  // разделитель «;», BOM ﻿, CRLF — чтобы Excel (ru) открывал без мастера импорта
  // экранирование: значение в кавычках, " → ""; защита от формул: если значение начинается с = + - @ \t \r — добавить в начало '
  // колонки: Номер; Дата (Екатеринбург, DD.MM.YYYY HH:mm); Тип; Блок; Форма; Имя; Телефон; Окно звонка; Желаемая дата; Желаемое время; Гостей; Сумма; Статус; Комментарий; Страница; Уведомления (email/telegram ok|error)
  await audit(session.user.id, 'leads.export', 'leads', 'csv', { count: rows.length, params });
  return new Response('﻿' + csv, { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="leads-${getToday()}.csv"`,
    'Cache-Control': 'no-store',
  }});
}
```
Проверка роли — только `requireAdminAction()` в try/catch → 401 (не `requireAdmin()`: он делает redirect). Запись в audit — вне транзакции, без `tx`: `await audit(session.user.id, 'leads.export', 'leads', 'csv', { count, params })`.

### F. `/admin/account`

- **Смена пароля** (`change-password-form.tsx`): поля «Текущий пароль», «Новый пароль» (≥ 10 символов), «Повторите»; `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`; сообщения об ошибках на русском.
- **2FA (`two-factor-card.tsx`)**: состояние берётся из `session.user.twoFactorEnabled`.
  - Выключена: кнопка «Включить 2FA» → диалог запрашивает пароль → `authClient.twoFactor.enable({ password })` возвращает `{ totpURI, backupCodes }`. Показать **QR-код** для `totpURI` и рядом секрет текстом (параметр `secret` из URI) для ручного ввода; поле «Код из приложения» → `authClient.twoFactor.verifyTotp({ code })`; после успеха показать резервные коды (моноширинным списком) с кнопками «Скопировать» и «Скачать .txt» и предупреждением «Сохраните — повторно не покажутся».
  - Включена: статус «2FA включена», кнопка «Отключить» → пароль → `authClient.twoFactor.disable({ password })`; кнопка «Новые резервные коды» → `authClient.twoFactor.generateBackupCodes({ password })`.
  - QR: пакет `react-qr-code` (поставлен задачей 01), клиентский рендер: `import QRCode from "react-qr-code"` → `<div className="rounded-lg border bg-white p-4 w-fit"><QRCode value={totpURI} size={192} /></div>` (белый фон и в тёмной теме — иначе сканеры не читают). Рядом — секрет текстом (параметр `secret` из `totpURI`, `font-mono`) с кнопкой «Скопировать» для ручного ввода. Других библиотек/внешних сервисов генерации QR не использовать.
  - `authClient` берётся из `src/lib/auth-client.ts`; убедитесь, что там подключён `twoFactorClient`, иначе сообщите в отчёте (файл не менять).

### G. `POST /api/cron/retention`

```ts
// src/app/api/cron/retention/route.ts
import { timingSafeEqual } from 'node:crypto';
export const dynamic = 'force-dynamic';

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;                       // если не задан — всегда 401
  if (!secret) return false;
  const given = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response('Unauthorized', { status: 401 });
  const months = (await getSettings()).leadRetentionMonths;      // по умолчанию 12
  if (!Number.isInteger(months) || months < 1) return Response.json({ ok: true, skipped: true });
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months);
  const res = await db.update(leads)
    .set({ name: null, phone: null, comment: null, ipHash: null, userAgent: '', anonymizedAt: new Date() })
    .where(and(lt(leads.createdAt, cutoff), isNull(leads.anonymizedAt)))
    .returning({ id: leads.id });
  console.info(`[retention] anonymized ${res.length} leads older than ${months} months`);
  return Response.json({ ok: true, anonymized: res.length });
}
```
`CRON_SECRET` читать через `src/lib/env.ts` (он там объявлен задачей 01), а не `process.env` напрямую. `leads.ipHash` nullable (`char(64)` без `notNull`) — ставится `null`; `userAgent` — `''`. Маршрут идемпотентен (повторный вызов ничего не меняет). Запросы приходят от Dokploy Schedules ежедневно.

## Acceptance Criteria

- [ ] `/admin/galleries`: для каждого из 8 системных ключей (`hero`, `service_russian`, `service_pool`, `service_vip`, `service_training`, `bar`, `about`, `cta`) и любых созданных можно загрузить несколько фото сразу, изменить порядок (drag-and-drop и ↑/↓), задать alt и подпись, убрать фото; изменения сразу видны на сайте (`updateTag('galleries')`).
- [ ] Новую галерею можно создать с ключом по `^[a-z0-9_]{2,64}$` (дубль ключа отклоняется); системные галереи удалить нельзя, прочие — с подтверждением.
- [ ] `/admin/services`: редактируются 4 вкладки (заголовок, подзаголовок, пункты, `priceFrom`, `priceNote`, `ctaType` booking/callback, `ctaBlock`, связь с галереей); пустой `priceFrom` явно описан как «автоматически».
- [ ] `/admin/settings`: форма использует ровно ключи `SiteSettings` (`hours`, `geo{lat,lon}`, `mapOrgId`, `mapConstructorId`, `seoDefaults{title,description,ogImageMediaId}`, `operator{name,inn,ogrn,address,email}`, …); `phoneHref` принимается только в виде `tel:+7…` (`^tel:\+\d{11,15}$`); все группы сохраняются через upsert с аудитом изменённых ключей; включение `telegramIncludePii` (отдельный Switch) требует подтверждения в диалоге и пишет запись в `audit_log`; `leadRetentionMonths` редактируется; ID Метрики в настройках отсутствует.
- [ ] `/admin/legal`: создаётся черновик новой версии (policy/consent) с `title` и `body`, `body` хранится с плейсхолдерами, подсказка перечисляет ровно 8 плейсхолдеров (`{{operator_name}}`, `{{operator_inn}}`, `{{operator_ogrn}}`, `{{operator_address}}`, `{{operator_email}}`, `{{phone}}`, `{{site_url}}`, `{{retention_months}}`), `version` — строка `YYYY-MM-DD[-N]`, `sha256` считается на сервере, публикация делает версию текущей, опубликованные версии нельзя изменить или удалить, старые видны только для чтения.
- [ ] `/admin/leads`: таблица с фильтрами (статус, тип, дата, поиск), пагинация по 50, цветные бейджи; карточка показывает данные заявки, `quoteSnapshot` построчно с итогами и предупреждениями, статус уведомлений; смена статуса и «Повторить уведомление» работают и обновляют `notifyStatus`.
- [ ] `GET /api/admin/leads/export` возвращает CSV (UTF-8 BOM, `;`, защита от формул) с учётом тех же фильтров; без сессии администратора — 401.
- [ ] `/admin/account`: смена пароля работает; 2FA включается (QR через `react-qr-code` + секрет текстом + проверка кода + резервные коды) и выключается.
- [ ] `POST /api/cron/retention` без корректного `Authorization: Bearer ${CRON_SECRET}` отвечает 401; с ним обезличивает заявки старше `leadRetentionMonths` (`name`, `phone`, `comment`, `ipHash` → null, `userAgent` → `''`, `anonymizedAt = now`) и возвращает число обработанных; повторный вызов ничего не меняет.
- [ ] Каждая страница вызывает `await requireAdmin()`; каждый action проходит через `adminAction` и пишет `await audit(ctx.userId, …, ctx.tx)` в handler; без сессии action возвращает `{ ok: false, error: 'Нет доступа' }`; route handler `/api/admin/leads/export` использует `requireAdminAction()` в try/catch → 401.
- [ ] Весь UI на русском, по `DESIGN.md`, пригоден на 375px; новых npm-пакетов нет; файлы вне списка не изменены.
- [ ] `pnpm lint` и `pnpm typecheck` проходят без ошибок.

## Notes

- Старый Telegram-токен скомпрометирован (см. action-required.md); админка его не хранит — токен только в env.
- Срок хранения заявок указывается в тексте `/politika` (плейсхолдер `{{retention_months}}`, значение `settings.leadRetentionMonths`).
- Обезличивание не удаляет заявку целиком: номер, тип, блок, сумма и снимок расчёта остаются для статистики.
