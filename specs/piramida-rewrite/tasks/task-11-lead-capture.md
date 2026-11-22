# Task 11: Приём заявок (submitLead, LeadForm, попапы, /spasibo)

## Status

complete

## Wave

3

## Description

Единый конвейер заявок для всего сайта: Server Action `submitLead` (zod, honeypot, rate limit, согласие, серверный пересчёт калькулятора, запись в `leads`, уведомления на email и в Telegram без потери заявки при сбое), компонент формы `LeadForm` с маской телефона и неотмеченным чекбоксом согласия, диалоги-триггеры `LeadDialogTrigger` (замена четырёх попапов старого сайта), `PolicyDialog` и страница `/spasibo`. Один и тот же `LeadForm` используется в шапке, hero, акциях, услугах, CTA-блоке, календаре и калькуляторе — поведение определяют пропсы `type`, `block`, `formTitle`.

## Dependencies

**Depends on:** task-02-design-tokens-layout.md, task-03-db-schema.md, task-05-calculator-core.md, task-06-shared-utils.md, task-07-notify-lib.md
**Blocks:** task-13-site-layout.md, task-24-calculator-ui.md

**Context from dependencies:**
- Task 02 задал токены Tailwind v4 (`primary`, `primary-dark`, `foreground`, `muted-foreground`, `accent-red`, `date` и др. в `@theme` `globals.css`), шрифт Onest и корневой layout (`html/body`, `Toaster`).
- Task 03 создал таблицы `leads` и `legalDocuments`, `siteSettings` в `src/lib/schema/*.ts`. Ключевые поля `leads`: `number` (identity), `type` (`callback`/`booking`/`promo`/`calculator`/`tournament`), `status`, `sourceBlock`, `formTitle`, `pageUrl`, `name?`, `phone?`, `callbackWindow?` (`now`/`hour`/`day`/`week`), `preferredDate? date`, `preferredTime? varchar(5)`, `guests?`, `comment?`, `promotionId?`, `tournamentId?`, `quoteSnapshot jsonb?`, `quoteTotal?`, `consentDocumentId`, `consentAt`, `ipHash char(64)` **nullable** (сюда пишется результат `hashIp`; cron обезличивания задачи 19 позже ставит `null`), `userAgent`, `notifyStatus jsonb`, `anonymizedAt?`. `legalDocuments`: `type` (`policy`/`consent`), `version varchar(32)`, `title`, `body` (markdown с плейсхолдерами), `sha256 char(64)`, `publishedAt timestamptz`, `createdAt`; текущий документ типа — последний по `publishedAt`. Таблицы меню (для `leads-catalog.ts`): `menuCategories` (`id`, `slug`, `title`, `priceGroupId?`, `sortOrder`, `isActive`), `menuItems` (`id`, `code`, `categoryId`, `name`, `priceGroupId?`, `sortOrder`, `isActive`), `menuItemVariants` (`code`, `itemId`, `label?`, `price`, `sortOrder`, `isActive`), `priceGroupTiers` (`code varchar(8)` unique, `groupId`, `label`, `price`, `sortOrder`).
- Task 05 создал `src/lib/calculator/types.ts` (`CalculatorCatalog`, `QuoteInput`, `Quote`; `CalcMenuVariant = { code; itemName; label: string; price; categorySlug; categoryName }`), `calculate.ts` (`calculateQuote(input, catalog): Quote`, чистая функция) и `catalog-mapper.ts`: `buildMenuVariants(rows: MenuVariantSourceRows): CalcMenuVariant[]`, где `MenuVariantSourceRows = { categories: { id; slug; title; priceGroupId: string | null; sortOrder }[]; items: { id; code; name; categoryId; priceGroupId: string | null; sortOrder }[]; variants: { code; itemId; label: string | null; price; sortOrder }[]; tiers: { code; groupId; label; price; sortOrder }[] }`. Позиции со своими вариантами дают `code = variant.code`; позиции с сеткой цен (`item.priceGroupId ?? category.priceGroupId`) — по записи на уровень с `code = \`${item.code}-${tier.code}\`` (до 17 символов, с `-`). Всё реэкспортируется из `@/lib/calculator`.
- Task 06 создал `src/lib/dates.ts` (`minToClock`, `getOpDate`, `TZ`), `src/lib/request-ip.ts` (`getClientIp(headers)`, `hashIp(ip)`), `src/lib/rate-limit.ts` (`rateLimit(key, { limit, windowMs }) → { ok, retryAfter }`, in-memory LRU).
- Task 07 создал `src/lib/notify/email.ts` (`sendEmail`), `telegram.ts` (`sendTelegram(html)`), `lead-templates.ts` (`leadEmail(lead)`, `leadTelegram(lead, { includePii })`); перед использованием открыть эти файлы и сверить точные сигнатуры и тип аргумента `lead` (ожидается строка `leads` из БД; `leadEmail` возвращает `{ subject, html, text }`).
- Task 12 (параллельно) пишет кэшируемые запросы; **не импортировать их**: в этой задаче каталог для пересчёта калькулятора читается отдельным НЕкэшируемым запросом (`leads-catalog.ts`).
- Файл `src/app/(site)/layout.tsx` (шапка, футер, cookie-баннер) создаёт задача 13 позже; страница `/spasibo` должна работать и под корневым layout.

## Files to Create

- `src/lib/actions/leads-schema.ts` — zod-схемы и типы (`LeadInput`, `SubmitLeadResult`); файл с `'use server'` не может экспортировать ничего, кроме async-функций, поэтому схемы отдельно
- `src/lib/actions/leads.ts` — Server Action `submitLead` (`'use server'`)
- `src/lib/actions/leads-catalog.ts` — `loadCatalogForQuote(): Promise<CalculatorCatalog>`, прямой запрос к БД без кэша
- `src/lib/phone.ts` — изоморфная маска и нормализация телефона
- `src/lib/metrika.ts` — `reachGoal(goal)` для Яндекс Метрики
- `src/components/leads/lead-form.tsx` — форма (client)
- `src/components/leads/lead-dialog.tsx` — `LeadDialogTrigger` (client)
- `src/components/leads/policy-dialog.tsx` — `PolicyDialog` (client)
- `src/components/leads/phone-input.tsx` — поле телефона с маской (client)
- `src/app/(site)/spasibo/page.tsx` — страница благодарности
- `public/images/popup-bg.webp` — фон попапа (копия `C:\OSPanel\home\74.loc\public\themes\piramida\assets\img\content\main-popup-bg.webp`; если файл уже существует с тем же содержимым — не трогать)

## Files to Modify

Нет.

## Technical Details

### Implementation Steps

1. Прочитать `src/lib/schema/leads.ts` (и связанные), `src/lib/calculator/types.ts`, `src/lib/notify/*`, `src/lib/rate-limit.ts`, `src/lib/request-ip.ts`, `src/lib/dates.ts`, `src/components/ui/{dialog,input,button,select,checkbox,label}.tsx`.

2. **`src/lib/phone.ts`** (без зависимостей от React, используется и на клиенте, и на сервере). Маска старого сайта `+7(999)999-99-99`; валидный номер — 10 цифр после `+7`.

```ts
/**
 * Оставляет только цифры национального номера (максимум 10). Одна ведущая «7» или «8» всегда считается
 * кодом страны и отбрасывается (российский номер начинается с 9/3/4/8xx…, поэтому правило однозначно;
 * «+7(» из самой маски тоже даёт ведущую «7»).
 */
export function nationalDigits(input: string): string {
  let d = input.replace(/\D/g, "")
  if (d[0] === "7" || d[0] === "8") d = d.slice(1)
  return d.slice(0, 10)
}
export function formatPhone(input: string): string { /* "" → ""; "9" → "+7(9"; "900" → "+7(900"; "9000685" → "+7(900)068-5"; полный → "+7(900)068-50-00" */ }
export function isPhoneComplete(input: string): boolean { return nationalDigits(input).length === 10 }
/** Каноничный вид для БД и уведомлений: "+7 (900) 068-50-00" */
export function normalizePhone(input: string): string | null
```

   Нюанс ввода: вставка «89000685000», «+79000685000» и «9000685000» должна давать один и тот же результат `+7(900)068-50-00` (правило ведущей «7»/«8» в `nationalDigits`). Нюанс удаления: если после `onChange` новое отформатированное значение не короче предыдущего, а пользователь удалял символ (длина сырого значения уменьшилась), удалить последнюю цифру, иначе нельзя стереть «)» и «-».

3. **`phone-input.tsx`:** обёртка над `Input` (shadcn), `type="tel"`, `inputMode="tel"`, `autoComplete="tel"`, при фокусе на пустом поле подставляет `+7(`, при потере фокуса пустое `+7(` очищается. Принимает `value`, `onChange(formatted: string)`, `aria-invalid`, `className`. Класс **`ym-disable-keys`** обязателен (Вебвизор Метрики не должен записывать ввод).

4. **`src/lib/metrika.ts`:**

```ts
declare global { interface Window { ym?: (id: number, method: string, ...args: unknown[]) => void } }
export function reachGoal(goal: string): void {
  const id = Number(process.env.NEXT_PUBLIC_YM_ID)
  if (typeof window !== "undefined" && id && typeof window.ym === "function") window.ym(id, "reachGoal", goal)
}
```

5. **`leads-schema.ts`:**

```ts
import { z } from "zod"
export const LEAD_TYPES = ["callback", "booking", "promo", "calculator", "tournament"] as const
export const CALLBACK_WINDOWS = ["now", "hour", "day", "week"] as const

const code = z.string().regex(/^[a-z0-9-]{1,20}$/)   // nanoid-коды и составные коды уровней сетки `${item.code}-${tier.code}`

export const quoteInputSchema = z.object({   // зеркало QuoteInput из src/lib/calculator/types.ts (контракт задачи 05)
  opDate: z.iso.date(), startMin: z.number().int().min(0).max(1440), durationMin: z.number().int().min(30).max(720),
  guests: z.number().int().min(1).max(200), hallId: z.uuid(), tables: z.number().int().min(1).max(50), pensioner: z.boolean(),
  extras: z.array(z.object({ id: z.uuid(), qty: z.number().int().min(1).max(50) })).max(20),
  sets: z.array(z.object({ code, qty: z.number().int().min(1).max(200) })).max(20),
  items: z.array(z.object({ code, qty: z.number().int().min(1).max(200) })).max(100),
})

export const leadInputSchema = z.object({
  type: z.enum(LEAD_TYPES),
  sourceBlock: z.string().trim().min(1).max(120),     // как data-hidden-id старого сайта: "Шапка сайта", "Первый экран"…
  formTitle: z.string().trim().min(1).max(120),       // "Перезвоните мне", "Забронировать"…
  pagePath: z.string().max(300).startsWith("/").optional(),  // location.pathname + search с клиента
  name: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(32),
  callbackWindow: z.enum(CALLBACK_WINDOWS).optional(),
  preferredDate: z.iso.date().optional(),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  guests: z.number().int().min(1).max(200).optional(),
  comment: z.string().trim().max(1000).optional(),
  promotionId: z.uuid().optional(),
  tournamentId: z.uuid().optional(),
  quote: z.string().max(20000).optional(),             // калькулятор: JSON.stringify(QuoteInput) из hidden-поля LeadForm
  consent: z.literal(true, { error: "Необходимо согласие на обработку данных" }),
  website: z.string().max(200).optional(),             // honeypot
}).superRefine(/* phone: nationalDigits ровно 10; name обязателен для type !== "callback" (мин. 2 символа);
                  type === "calculator" требует непустой quote (ошибка в fieldErrors.quote); type === "callback" допускает отсутствие name */)
export type LeadInput = z.input<typeof leadInputSchema>
export type SubmitLeadResult =
  | { ok: true; number: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
```

   Из-за `exactOptionalPropertyTypes` в клиенте опциональные поля не передавать как `undefined` — собирать payload без пустых ключей.

6. **`leads-catalog.ts`:** `loadCatalogForQuote(): Promise<CalculatorCatalog>` — прямые запросы Drizzle (без `'use cache'`, без `next/cache`): активные залы (`id`, `slug`, `name`, `kind`, `tablesCount`, `seatsPerTable`), активные тарифы (`isActive`, поля `validFrom/validTo` вернуть как есть), активные доп. услуги, активные банкетные сеты (`code`, `title`, `pricingMode`, `price`, `minGuests`, `maxGuests`), акции (поле `promotions` каталога — тип `CalcPromotion` в `types.ts`). `menuVariants` **не** собираются вручную/JOIN'ом: выбрать четыре плоских набора строк и передать их в `buildMenuVariants` из `@/lib/calculator/catalog-mapper` (та же функция, что в `getCalculatorCatalog` задачи 12, поэтому коды и цены совпадают с клиентским превью):

```ts
import { buildMenuVariants } from "@/lib/calculator/catalog-mapper"

const [categories, items, variants, tiers] = await Promise.all([
  db.select({ id: menuCategories.id, slug: menuCategories.slug, title: menuCategories.title,
              priceGroupId: menuCategories.priceGroupId, sortOrder: menuCategories.sortOrder })
    .from(menuCategories).where(eq(menuCategories.isActive, true)),
  db.select({ id: menuItems.id, code: menuItems.code, name: menuItems.name, categoryId: menuItems.categoryId,
              priceGroupId: menuItems.priceGroupId, sortOrder: menuItems.sortOrder })
    .from(menuItems).where(eq(menuItems.isActive, true)),
  db.select({ code: menuItemVariants.code, itemId: menuItemVariants.itemId, label: menuItemVariants.label,
              price: menuItemVariants.price, sortOrder: menuItemVariants.sortOrder })
    .from(menuItemVariants).where(eq(menuItemVariants.isActive, true)),
  db.select({ code: priceGroupTiers.code, groupId: priceGroupTiers.groupId, label: priceGroupTiers.label,
              price: priceGroupTiers.price, sortOrder: priceGroupTiers.sortOrder })
    .from(priceGroupTiers),
])
const menuVariants = buildMenuVariants({ categories, items, variants, tiers })
```

   Результат — ровно тип `CalculatorCatalog` из task 05 (та же форма, что у `getCalculatorCatalog` задачи 12). Позиции с общей сеткой цен (Teatone, фирменные чаи, лимонады) попадают в `menuVariants` по уровням сетки с кодом `${item.code}-${tier.code}`.

7. **`leads.ts`** (`'use server'`, единственный export — `submitLead`). Порядок:

```ts
export async function submitLead(raw: unknown): Promise<SubmitLeadResult> {
  const input = raw instanceof FormData ? formDataToObject(raw) : raw
  const parsed = leadInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Проверьте введённые данные", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const data = parsed.data

  if (data.website) return { ok: true, number: 0 }          // honeypot: тихо «успех», ничего не сохраняем

  const h = await headers()
  const ipHash = hashIp(getClientIp(h))
  const rl = rateLimit(`lead:${ipHash}`, { limit: 5, windowMs: 10 * 60 * 1000 })
  if (!rl.ok) return { ok: false, error: `Слишком много заявок. Попробуйте через ${Math.ceil(rl.retryAfter / 60)} мин.` }
  ...
}
```

   Далее:
   - **IP:** `ipHash` (результат `hashIp`) записывается в `leads.ipHash` (колонка nullable — `null` там появляется только после обезличивания).
   - **Согласие:** текущая версия документа `consent` — последняя по `publishedAt` из `legalDocuments` среди опубликованных (`publishedAt IS NOT NULL`; `null` — черновик) (прямой запрос, не кэшируемый). Нет документа → `{ ok: false, error: "Заявки временно не принимаются" }` и `console.error`. Сохранить `consentDocumentId`, `consentAt = new Date()`.
   - **Телефон:** `normalizePhone(data.phone)` → «+7 (900) 068-50-00».
   - **Калькулятор (`type === "calculator"`):** `data.quote` — JSON-строка. `let json: unknown; try { json = JSON.parse(data.quote) } catch { return { ok: false, error: "Не удалось прочитать расчёт", fieldErrors: { quote: ["Некорректный расчёт"] } } }`; затем `const qi = quoteInputSchema.safeParse(json)`; неуспех → `{ ok: false, error: "Не удалось прочитать расчёт", fieldErrors: { quote: ["Некорректный расчёт"] } }` (ничего не пишется). Далее `catalog = await loadCatalogForQuote()`, `quote = calculateQuote(qi.data, catalog)` — только серверный пересчёт, клиентские суммы игнорировать. Записать `quoteSnapshot = { input: qi.data, quote, calculatedAt: ISO }`, `quoteTotal = quote.total`; `preferredDate = qi.data.opDate`, `preferredTime = minToClock(qi.data.startMin)`, `guests = qi.data.guests` (перезаписывают клиентские значения). `calculateQuote` не бросает исключений: проблемы расчёта приходят в `quote.warnings` — заявка всё равно сохраняется, предупреждения остаются в `quoteSnapshot`.
   - **Прочее:** `pageUrl = NEXT_PUBLIC_SITE_URL + data.pagePath` (если `pagePath` есть), `userAgent = h.get("user-agent")?.slice(0, 300) ?? ""`, `status = "new"`, `notifyStatus = {}`. Вставка `insert(leads).values(...).returning()`.
   - **Уведомления без потери заявки:** после вставки в `after(async () => { ... })` (`import { after } from "next/server"`): прочитать `telegramIncludePii` из `siteSettings` (прямой запрос, значение jsonb; отсутствует → `false`), затем `Promise.allSettled([sendEmail(leadEmail(lead)), sendTelegram(leadTelegram(lead, { includePii }))])`; результат (`{ email: { ok, error?, at }, telegram: { ok, error?, at } }`, `at` — ISO) записать в `notifyStatus` строки; всё в `try/catch` с `console.error`, исключение никогда не должно влиять на ответ клиенту. Email отправляется на `LEADS_EMAIL_TO` (`sendEmail` без `to` использует его сам).
   - Ответ: `{ ok: true, number: lead.number }`. Любое неожиданное исключение до вставки — `console.error` и `{ ok: false, error: "Не удалось отправить заявку. Позвоните нам или попробуйте позже." }`.
   - `formDataToObject`: поля формы в объект, `consent` — `value === "on" || "true"` → `true`, числовые поля — в `number`.

8. **`lead-form.tsx`** (`"use client"`): react-hook-form + `zodResolver` по клиентской схеме **только видимых полей** (`name`, `phone`, `callbackWindow`, `consent`, `website` — экспортировать из `leads-schema.ts` как `leadFormFieldsSchema` с теми же правилами телефона/имени), т. к. `hidden`/`promotionId`/`tournamentId` не являются полями формы; полную проверку `leadInputSchema` делает `submitLead`. Пропсы по контракту:

```ts
type LeadFormProps = {
  type: LeadType                     // 'callback' | 'booking' | 'promo' | 'calculator' | 'tournament'
  block: string                      // → sourceBlock
  formTitle: string
  promotionId?: string
  tournamentId?: string
  hidden?: Record<string, string>    // скрытые поля, уходят в payload как есть (калькулятор: { quote: JSON.stringify(quoteInput) })
  submitLabel?: string
  onSuccess?: (number: number) => void
  className?: string
}
```

   Пропсов `fields` и `extra` нет. Набор видимых полей определяется только `type`: `callback` — время звонка (`callbackWindow`) + телефон; все остальные — имя + телефон. `submitLabel` по умолчанию по `type`: `callback` — «Заказать звонок», `booking` — «Забронировать», `promo` — «Отправить заявку», `calculator` — «Отправить расчёт в клуб», `tournament` — «Записаться».

   Поведение:
   - Поля: «Ваше имя» (`name`, `autoComplete="name"`, класс `ym-disable-keys`), «Ваш номер телефона» (`PhoneInput`), для `callbackWindow` — shadcn `Select` с опциями «Сейчас» (`now`), «В течение часа» (`hour`), «В течение дня» (`day`), «На этой неделе» (`week`), подпись «В какое время вам позвонить?». Скрытое honeypot-поле `website` (визуально скрыто через `sr-only`/`absolute -left-[9999px]`, `tabIndex={-1}`, `autoComplete="off"`, `aria-hidden`).
   - Чекбокс согласия **не отмечен по умолчанию** (shadcn `Checkbox`), подпись: «Я даю [согласие на обработку персональных данных](/soglasie) и ознакомлен(а) с [политикой конфиденциальности](/politika)» — ссылки `target="_blank" rel="noopener"`. Кнопка отправки неактивна, пока не отмечено согласие и не заполнен корректный телефон; все ошибки показываются под полями (`aria-invalid`, `role="alert"`), общая ошибка сервера — над кнопкой.
   - Отправка через `useTransition`/`isSubmitting`: сборка payload (`type`, `sourceBlock: block`, `formTitle`, `pagePath: location.pathname + location.search`, видимые поля формы, `promotionId`/`tournamentId` если заданы, затем `...hidden` — все пары как есть, `consent: true`), вызов `submitLead(payload)`. Ключи `hidden` не перекрывают служебные поля (`type`, `sourceBlock`, `formTitle`, `consent`) — их добавлять после `hidden`. `fieldErrors` с сервера проставляются в форму через `setError`.
   - Успех: `reachGoal(type === "calculator" ? "calculator_submit" : "lead_submit")`, вызов `onSuccess?.(number)` и `router.push("/spasibo")`.
   - Визуал по старому сайту (`C:\OSPanel\home\74.loc\public\themes\piramida\assets\css\main.css`, блоки `.md-standart-form` ~строки 1050–1230 и `.main-popup` ~9200–9260): поля — высота `clamp(48px, 3.6vw, 100px)` (на десктопе 100px при 1920), скругление `rounded-xl` (≈12px), белый фон, шрифт Onest 500, `px-5`; кнопка — shadcn `Button` с токенами `bg-primary hover:bg-primary-dark`, высота `h-12 md:h-14`, жирный шрифт; ошибки — цветом токена `destructive`. Layout формы: в узком контейнере поля друг под другом; в широком (`className` от вызывающего) допускается ряд. Не использовать фиксированные `vw`.

9. **`lead-dialog.tsx`** (`"use client"`):

```ts
type LeadDialogTriggerProps = {
  kind: "callback" | "booking" | "promo" | "tournament"
  block: string
  formTitle?: string
  promotionId?: string
  tournamentId?: string
  asChild?: boolean
  className?: string
  children: React.ReactNode
}
```

   Использует shadcn `Dialog` (`DialogTrigger asChild` оборачивает `children`; без `asChild` рендерится `<button type="button">`). Содержимое по виду (тексты старого сайта): `callback` — заголовок «Перезвоните мне», форма `type="callback"`, кнопка «Заказать звонок», `formTitle` по умолчанию «Перезвоните мне»; `promo` — «Узнайте подробнее», подзаголовок «Перезвоним через пару минут для уточнения деталей», `type="promo"`, кнопка «Отправить заявку», `formTitle` по умолчанию «Участвовать в акции», передаёт `promotionId`; `booking` — «Забронировать», `type="booking"`, кнопка «Забронировать», `formTitle` «Забронировать»; `tournament` — заголовок «Записаться на турнир», форма `type="tournament"`, кнопка «Записаться», `formTitle` по умолчанию «Запись на турнир», передаёт `tournamentId` (используется календарём турниров, задача 22: `<LeadDialogTrigger kind="tournament" tournamentId={t.id} block="Календарь турниров">`). Окно: ширина `max-w-md`, фон `bg-white` с `public/images/popup-bg.webp` (`bg-cover`), заголовок `text-[clamp(22px,1.8vw,35px)] font-bold text-center`, `DialogTitle`/`DialogDescription` обязательны (доступность). При `onSuccess` закрыть диалог. Состояние формы сбрасывается при каждом открытии (монтировать `LeadForm` только когда диалог открыт).

10. **`policy-dialog.tsx`** (`"use client"`): `PolicyDialog({ title, markdown, children })`, `children` — триггер (`asChild`), в диалоге прокручиваемый (`max-h-[85vh] overflow-y-auto`, `max-w-3xl`) markdown через `react-markdown` + `remark-gfm` с компонентами заголовков/абзацев/списков в типографике сайта. Данные документа получает **серверный** родитель (футер, задача 13) из `getCurrentLegalDocument('policy')` (задача 12; возвращает `{ id; type; version; title; text; publishedAt; sha256 } | null`, где `text` — уже с подставленными реквизитами) и передаёт `title`/`text` как пропсы `title`/`markdown`. `PolicyDialog` **не** выполняет подстановку плейсхолдеров повторно — рендерит `markdown` как есть (подстановка происходит только в `getCurrentLegalDocument`).

11. **`src/app/(site)/spasibo/page.tsx`:** серверная страница, `export const metadata = { title: "Спасибо за обращение", robots: { index: false, follow: false } }`. Разметка в стиле старой страницы (`C:\OSPanel\home\74.loc\spasibo\index.php`): секция-hero со скруглением 25px (`rounded-[25px]`), фон — тёмно-зелёный градиент по токену `primary-dark`; поверх, если доступна, фотография из галереи `hero` — вложить в `<Suspense fallback={null}>` отдельный async-компонент, который делает `await connection()` и вызывает `getGallery("hero")` из `@/lib/queries/galleries` (задача 12; если на момент реализации файла ещё нет — оставить только градиент и вернуться к фону отдельным шагом после слияния Wave 3, указав это в отчёте); `<Picture priority>` из `@/components/media/picture` (задача 09) по тому же принципу. Контент: `h1` «**Спасибо за обращение** в Бильярдный клуб «Пирамида»!» (`clamp(24px, 3.4vw, 65px)`, белый, 600), ряд из трёх пульсирующих точек (три `<span>` `size-2.5 rounded-full border border-primary` с `animate-pulse` и `style={{ animationDelay: "0s" | ".3s" | ".6s" }}`, цвет — светлый на тёмном фоне) и текст «Мы скоро свяжемся с вами»; кнопка «На главную» (`Button asChild` → `/`, зелёная, как у `LeadForm`). Страница статична, БД не требует.

### Code Snippets

Пример использования потребителями (задачи 13, 20, 21, 22, 24):

```tsx
<LeadDialogTrigger kind="callback" block="Шапка сайта" asChild>
  <button className="…">Заказать звонок</button>
</LeadDialogTrigger>

<LeadDialogTrigger kind="tournament" tournamentId={t.id} block="Календарь турниров" asChild>
  <button className="…">Записаться</button>
</LeadDialogTrigger>

<LeadForm type="booking" block="Бильярдная забронировать стол" formTitle="Хотите забронировать стол" submitLabel="Оставить заявку" />

<LeadForm type="calculator" block="Калькулятор" formTitle="Расчёт из калькулятора"
  submitLabel="Отправить расчёт в клуб" hidden={{ quote: JSON.stringify(quoteInput) }} />
```

### Environment Variables

- `NEXT_PUBLIC_SITE_URL` — для `pageUrl`
- `NEXT_PUBLIC_YM_ID` — id счётчика Метрики для `reachGoal`
- `BETTER_AUTH_SECRET` — соль `hashIp` (через `src/lib/request-ip.ts`)
- `LEADS_EMAIL_TO`, `SMTP_*`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — используются библиотекой уведомлений (task 07)

### API Endpoints

Отдельных маршрутов нет: `submitLead` — Server Action. Вход: `LeadInput` (объект) или `FormData`; выход: `{ ok: true; number } | { ok: false; error; fieldErrors? }`.

## Acceptance Criteria

- [ ] `submitLead` валидирует вход zod; неверный телефон, отсутствие согласия, отсутствие имени (для не-`callback`) возвращают `{ ok: false, fieldErrors }` и ничего не пишут в БД.
- [ ] Заполненное honeypot-поле `website` возвращает `{ ok: true, number: 0 }` без записи и уведомлений.
- [ ] Шестая заявка с одного IP за 10 минут отклоняется сообщением с числом минут (ключ — `ipHash`, а не сырой IP).
- [ ] Для каждой сохранённой заявки заполнены `consentDocumentId` (текущая версия `consent`) и `consentAt`; без опубликованного документа согласия заявка не принимается.
- [ ] Для `type: "calculator"` в `leads.quoteSnapshot` лежит результат `calculateQuote`, пересчитанный на сервере по свежему каталогу (подмена суммы клиентом не влияет), `quoteTotal` совпадает с `quote.total`, `preferredDate/Time` и `guests` взяты из разобранного `quote`. Отсутствующий, не-JSON или не проходящий `quoteInputSchema` `quote` возвращает `{ ok: false, fieldErrors.quote }` без записи; коды позиций вида `abc123-x9y8z7` (уровни сетки) принимаются.
- [ ] `loadCatalogForQuote` выбирает плоские строки категорий/активных позиций/активных вариантов/уровней сеток и собирает `menuVariants` через `buildMenuVariants`; позиции с сеткой цен попадают в каталог.
- [ ] `LeadForm` принимает ровно пропсы `type, block, formTitle, promotionId?, tournamentId?, hidden?, submitLabel?, onSuccess?, className?` (нет `fields`/`extra`); видимые поля определяются `type`; `hidden` попадает в payload; без `submitLabel` подставляется подпись по `type`.
- [ ] Email и Telegram отправляются через `after()` и не задерживают ответ; результат записывается в `notifyStatus` (`ok`/`error` + `at` для каждого канала); падение SMTP или Telegram не отменяет заявку и не даёт ошибки пользователю; в Telegram ПДн попадают только если `site_settings.telegramIncludePii = true` (по умолчанию нет).
- [ ] Маска телефона форматирует ввод `+7(900)068-50-00`, не даёт набрать больше 10 цифр, корректно обрабатывает вставку «89000685000» и удаление скобок/дефисов; поля имени и телефона имеют класс `ym-disable-keys`.
- [ ] Чекбокс согласия изначально не отмечен, ссылки ведут на `/soglasie` и `/politika`; без отметки отправка невозможна; ошибки валидации видны пользователю.
- [ ] Успешная отправка вызывает `reachGoal('lead_submit')` (для калькулятора `calculator_submit`) и ведёт на `/spasibo`; в `leads` появляется строка с корректными `sourceBlock`, `formTitle`, `pageUrl`.
- [ ] `LeadDialogTrigger` с `kind` `callback`/`booking`/`promo`/`tournament` открывает диалог с соответствующим заголовком и полями (для `callback` — выбор времени звонка и телефон), закрывается по успеху, фокус и Esc работают.
- [ ] `kind="tournament"`: заголовок «Записаться на турнир», кнопка «Записаться», `formTitle` по умолчанию «Запись на турнир»; заявка сохраняется с `type = "tournament"` и переданным `tournamentId`.
- [ ] `PolicyDialog` рендерит переданный `markdown` без повторной подстановки плейсхолдеров.
- [ ] `/spasibo` имеет `noindex`, показывает пульсирующие точки и кнопку «На главную».
- [ ] `'use server'`-файл `leads.ts` экспортирует только `submitLead`; `next build` проходит без БД.
- [ ] `pnpm lint` и `pnpm typecheck` проходят.

## Notes

- Обезличивание старых заявок по сроку хранения делает cron в задаче 19; здесь важно только сохранять `consentAt` и `consentDocumentId`.
- Сумма калькулятора, присланная клиентом, нигде не используется — это защита от подмены; клиентское превью считается теми же `calculateQuote` на клиенте.
- Позиции меню с общими сетками цен попадают в калькулятор по уровням сетки (`priceGroupTiers.code`, составной код `${item.code}-${tier.code}`), маппинг — общий `buildMenuVariants` задачи 05.
- `public/images/popup-bg.webp` принадлежит этой задаче (таблица владельцев в README).
- Стилизация «блика» кнопки и анимации — зона задачи 13 (`PrimaryButton`); здесь достаточно shadcn `Button` с токенами, последующая замена не ломает контракт `LeadForm`.
