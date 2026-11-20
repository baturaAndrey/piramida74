# Task 07: Библиотека уведомлений — email (nodemailer) и Telegram

## Status

complete

## Wave

2

## Description

Создаёт слой уведомлений о заявках: отправка email через SMTP Яндекс 360 (`smtp.yandex.ru:465`, TLS), отправка в Telegram через Bot API (`parse_mode=HTML`, экранирование, таймаут 5 с) и шаблоны сообщений для заявки (письмо — полная заявка, Telegram — по умолчанию **без персональных данных**). Библиотека используется задачей 11 (`submitLead`), задачей 08 (письмо сброса пароля) и задачей 19 (повтор уведомления из админки). Шаблоны принимают простой тип `LeadForNotify`, определённый в этой задаче, — **без импорта схемы БД**, чтобы задача выполнялась параллельно с задачей 03.

## Dependencies

**Depends on:** task-01-starter-cleanup-deps.md
**Blocks:** task-08-auth-admin.md, task-11-lead-capture.md

**Context from dependencies:** задача 01 поставила `nodemailer` и `@types/nodemailer`, переписала `src/lib/env.ts`: там есть `getServerEnv()` (ленивая валидация и кэш; поля `SMTP_HOST`, `SMTP_PORT` (число), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `LEADS_EMAIL_TO`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — все **необязательные**, пустые строки считаются «не задано») и `getClientEnv()` (`NEXT_PUBLIC_SITE_URL`, по умолчанию `http://localhost:3000`). Задача 07 больше ни от чего не зависит.

## Files to Create

- `src/lib/notify/email.ts` — `sendEmail`
- `src/lib/notify/telegram.ts` — `sendTelegram`, `escapeHtml`
- `src/lib/notify/lead-templates.ts` — тип `LeadForNotify`, `leadEmail`, `leadTelegram`

## Files to Modify

Нет.

## Technical Details

### Implementation Steps

1. **`email.ts`.** Транспорт `nodemailer.createTransport` создаётся лениво один раз на процесс. Параметры: `host`, `port` (по умолчанию 465), `secure: port === 465`, `auth: { user, pass }`, таймауты `connectionTimeout: 10_000`, `greetingTimeout: 10_000`, `socketTimeout: 15_000`. Получатель по умолчанию — `LEADS_EMAIL_TO` (допускается список через запятую). Отправитель — `SMTP_FROM`, а если не задан — `SMTP_USER` (Яндекс отклоняет письма, если адрес `From` не совпадает с авторизованным ящиком); если `SMTP_FROM` без `<…>`, оформлять как `Пирамида 74 <адрес>`. Если SMTP не настроен (нет `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`) или нет получателя — не бросать исключение: `console.warn("[notify/email] SMTP не настроен — письмо пропущено")` и вернуть `{ ok: false, error: "not_configured" }`. Любая ошибка отправки → `{ ok: false, error: <сообщение> }` + `console.error` (без тела письма и без пароля — тело содержит ПДн). Функция **никогда не бросает** исключений.
2. **`telegram.ts`.** `POST https://api.telegram.org/bot<TOKEN>/sendMessage` с JSON `{ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }`, `signal: AbortSignal.timeout(5000)`. Нет токена или chat id → `console.warn` + `{ ok: false, error: "not_configured" }`. Ответ HTTP не 2xx или `json.ok !== true` → `{ ok: false, error: "telegram http <status>: <description>" }`. Ошибку сети/таймаута превращать в `{ ok: false, error: "network_error" }` / `"timeout"` — **текст исходной ошибки `fetch` не возвращать и не логировать целиком** (в нём может оказаться URL с токеном). Токен никогда не попадает в логи. Текст ограничить 4096 символами (в шаблонах длинные поля обрезаются заранее, чтобы не разрезать теги).
3. **`escapeHtml`** экранирует `&`, `<`, `>`, `"` (порядок: `&` первым). Используется в Telegram- и HTML-шаблонах для **каждого** пользовательского значения.
4. **`lead-templates.ts`** — тип и шаблоны (код ниже). Требования к содержимому:
   - **Город.** Telegram-чат общий с Тюменью, поэтому во всех сообщениях есть строка `Город: Челябинск` (как в старом сайте).
   - **Подписи типов:** `callback` — «Обратный звонок», `booking` — «Бронирование стола», `promo` — «Акция», `calculator` — «Расчёт калькулятора», `tournament` — «Заявка на турнир».
   - **Окно звонка:** `now` — «Сейчас», `hour` — «В течение часа», `day` — «В течение дня», `week` — «На этой неделе».
   - **Блок и форма:** строки «Форма: …» (`formTitle`) и «Блок: …» (`sourceBlock`: «Шапка сайта», «Первый экран», «Календарный план» …), в письме ещё «Страница: …» (`pageUrl`).
   - **Telegram без ПДн** (`includePii: false`): `Новая заявка #12 (калькулятор, 8 гостей, 5 дек 19:00)` + город/форма/блок + ссылка «Открыть в админке» `${NEXT_PUBLIC_SITE_URL}/admin/leads/${id}`; **нет** имени, телефона, комментария. С `includePii: true` добавляются имя, телефон, комментарий (до 300 символов), название акции/турнира.
   - **Письмо:** полная заявка — все поля, телефон как `tel:`-ссылка, для `calculator` — таблица строк расчёта (позиция, количество, цена, сумма), итоги (аренда, меню, всего, на гостя), предупреждения расчёта, дисклеймер «Расчёт предварительный, итог подтверждает администратор», ссылка на заявку в админке. Все значения — через `escapeHtml`. Тема: `Заявка #12 — Бронирование стола (Челябинск)`.
   - Поля `name`/`phone` могут быть `null` (обезличенные заявки) — выводить «—».
   - Суммы форматировать с неразрывным пробелом: `19 140 ₽` (своя функция, без `Intl`). Даты — по-русски (`5 дек` в Telegram, `5 декабря 2026` в письме) — **собственные** маленькие хелперы (не импортировать `@/lib/dates` — он пишется параллельно).
5. Проверка вручную (без тестов): `pnpm tsx -e "…"` — собрать `LeadForNotify` для каждого `type`, распечатать `leadTelegram(l, {includePii:false})`, `…true` и `leadEmail(l).subject/text`; убедиться, что при `includePii:false` нет имени/телефона, а спецсимволы (`<script>`, `&`) в комментарии экранированы. `sendEmail`/`sendTelegram` без настроек возвращают `ok: false` и не падают.
6. `pnpm lint`, `pnpm typecheck` проходят (`pnpm build:ci` — по желанию: модули нигде не импортируются).

### Code Snippets

`src/lib/notify/email.ts`:

```ts
import nodemailer, { type Transporter } from "nodemailer";
import { getServerEnv } from "@/lib/env";

export interface SendEmailInput {
  /** По умолчанию LEADS_EMAIL_TO (можно список через запятую) */
  to?: string;
  subject: string;
  html: string;
  text: string;
}
export type NotifyResult = { ok: boolean; error?: string };

let transporter: Transporter | undefined;
let transporterKey = "";

function getTransporter(host: string, port: number, user: string, pass: string): Transporter {
  const key = `${host}:${port}:${user}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host, port, secure: port === 465, // Яндекс 360: smtp.yandex.ru:465, implicit TLS
      auth: { user, pass },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    });
    transporterKey = key;
  }
  return transporter;
}

export async function sendEmail(input: SendEmailInput): Promise<NotifyResult> {
  try {
    const env = getServerEnv();
    const to = input.to ?? env.LEADS_EMAIL_TO;
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !to) {
      console.warn("[notify/email] SMTP не настроен или нет получателя — письмо пропущено");
      return { ok: false, error: "not_configured" };
    }
    const fromRaw = env.SMTP_FROM ?? env.SMTP_USER;
    const from = fromRaw.includes("<") ? fromRaw : `Пирамида 74 <${fromRaw}>`;
    await getTransporter(env.SMTP_HOST, env.SMTP_PORT ?? 465, env.SMTP_USER, env.SMTP_PASS).sendMail({
      from, to, subject: input.subject, html: input.html, text: input.text,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[notify/email] send failed:", message);
    return { ok: false, error: message };
  }
}
```

`src/lib/notify/telegram.ts`:

```ts
import { getServerEnv } from "@/lib/env";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendTelegram(html: string): Promise<{ ok: boolean; error?: string }> {
  let token: string | undefined;
  let chatId: string | undefined;
  try {
    const env = getServerEnv();
    token = env.TELEGRAM_BOT_TOKEN;
    chatId = env.TELEGRAM_CHAT_ID;
  } catch {
    return { ok: false, error: "invalid_env" };
  }
  if (!token || !chatId) {
    console.warn("[notify/telegram] бот не настроен — сообщение пропущено");
    return { ok: false, error: "not_configured" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html.slice(0, 4096),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!res.ok || json.ok !== true) {
      const error = `telegram http ${res.status}: ${json.description ?? "unknown"}`;
      console.error("[notify/telegram]", error);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    console.error("[notify/telegram] request failed:", timeout ? "timeout" : "network_error");
    return { ok: false, error: timeout ? "timeout" : "network_error" };
  }
}
```

`src/lib/notify/lead-templates.ts` — тип (контракт для задачи 11, которая собирает его из строки `leads`):

```ts
import { getClientEnv } from "@/lib/env";
import { escapeHtml } from "./telegram";

export type LeadNotifyType = "callback" | "booking" | "promo" | "calculator" | "tournament";
export type LeadCallbackWindow = "now" | "hour" | "day" | "week";

export interface LeadQuoteForNotify {
  lines: { kind: "rental" | "extra" | "set" | "item"; label: string; qty: number; unitPrice: number; total: number }[];
  rentalTotal: number;
  foodTotal: number;
  total: number;
  perGuest: number;
  warnings: string[];
  hallName: string | null;
  tables: number | null;
}

/** Плоское представление заявки для уведомлений (собирается из строки leads, без импорта схемы) */
export interface LeadForNotify {
  id: string; // uuid — для ссылки в админку
  number: number; // «Заявка #N»
  type: LeadNotifyType;
  sourceBlock: string; // «Шапка сайта», «Первый экран»…
  formTitle: string;
  pageUrl: string;
  name: string | null;
  phone: string | null;
  callbackWindow: LeadCallbackWindow | null;
  preferredDate: string | null; // YYYY-MM-DD
  preferredTime: string | null; // HH:mm
  guests: number | null;
  comment: string | null;
  promotionTitle: string | null;
  tournamentTitle: string | null;
  quote: LeadQuoteForNotify | null; // из quoteSnapshot (type === "calculator")
}

export interface LeadEmail { subject: string; html: string; text: string }

export function leadEmail(lead: LeadForNotify): LeadEmail { /* см. требования шага 4 */ }
export function leadTelegram(lead: LeadForNotify, opts: { includePii: boolean }): string { /* то же */ }

export function adminLeadUrl(lead: Pick<LeadForNotify, "id">): string {
  return `${getClientEnv().NEXT_PUBLIC_SITE_URL}/admin/leads/${lead.id}`;
}
```

Пример результата `leadTelegram` для заявки калькулятора без ПДн (HTML Telegram):

```
<b>Новая заявка #12</b> (калькулятор, 8 гостей, 5 дек 19:00)
<b>Город:</b> Челябинск
<b>Форма:</b> Отправить расчёт в клуб
<b>Блок:</b> Калькулятор
<b>Сумма:</b> 19 140 ₽
<a href="https://piramida-billiard-74.ru/admin/leads/…">Открыть в админке</a>
```
С `includePii: true` после «Блок» добавляются `<b>Имя:</b> …`, `<b>Телефон:</b> …`, `<b>Комментарий:</b> …`.

### Environment Variables

- `SMTP_HOST` (`smtp.yandex.ru`), `SMTP_PORT` (`465`), `SMTP_USER` (полный адрес ящика Яндекс 360), `SMTP_PASS` (пароль приложения), `SMTP_FROM` (по умолчанию = `SMTP_USER`), `LEADS_EMAIL_TO` (адрес клуба для заявок) — все необязательные
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — необязательные; **токен бота перевыпускается** (старый засвечен в старом проекте), чат общий с Тюменью
- `NEXT_PUBLIC_SITE_URL` — для ссылки на заявку в админке

## Acceptance Criteria

- [ ] `sendEmail({ to?, subject, html, text }) → Promise<{ ok: boolean; error?: string }>`: без настроек SMTP возвращает `{ ok: false, error: "not_configured" }` и пишет `console.warn`, **не бросает**; Яндекс-параметры: порт 465 → `secure: true`; тайм-ауты заданы; адрес `From` по умолчанию совпадает с `SMTP_USER`
- [ ] `sendTelegram(html) → Promise<{ ok, error? }>`: `parse_mode: "HTML"`, таймаут 5 с (`AbortSignal.timeout(5000)`), без настроек — `not_configured` + `console.warn`; токен и текст исходных сетевых ошибок не попадают в логи и в возвращаемую ошибку
- [ ] `escapeHtml` экранирует `& < > "`; **каждое** пользовательское значение в шаблонах проходит через неё
- [ ] `leadTelegram(lead, { includePii: false })` не содержит имени, телефона и комментария; содержит `Город: Челябинск`, тип, форму, блок и ссылку `${NEXT_PUBLIC_SITE_URL}/admin/leads/${id}`; с `includePii: true` — содержит имя и телефон
- [ ] `leadEmail(lead)` возвращает `{ subject, html, text }`; для `calculator` содержит таблицу строк расчёта, итоги и дисклеймер; для `callback` — подпись окна звонка по-русски; для `promo`/`tournament` — название акции/турнира; `null`-значения имени/телефона выводятся как «—»
- [ ] Тип `LeadForNotify` экспортирован из `lead-templates.ts`; модуль **не импортирует** `@/lib/schema`, `@/lib/dates`, `@/lib/calculator`
- [ ] Ручная проверка из шага 5 выполнена (в отчёте — краткий вывод шаблонов)
- [ ] `pnpm lint` и `pnpm typecheck` проходят

## Notes

- Тест-доступ к реальному SMTP/Telegram не требуется; e2e (задача 28) мокает отправку.
- Подпись для типа `calculator` в Telegram без ПДн содержит число гостей и дату/время (если заданы) и сумму — это не ПДн.
- Включение ПДн в Telegram — флаг `telegramIncludePii` в `SiteSettings` (форма — задача 19), по умолчанию `false`; вызывающий код (`submitLead`) передаёт `includePii`.
- Письмо сброса пароля (задача 08) вызывает `sendEmail({ to: user.email, subject, html, text })` с явным `to`.
- При ошибке отправки заявка не теряется: вызывающий код пишет результат в `leads.notify_status` и показывает кнопку «Повторить уведомление» (задача 19).
