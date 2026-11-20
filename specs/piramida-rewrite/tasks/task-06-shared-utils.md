# Task 06: Общие утилиты — даты, slug, IP клиента, JSON-LD, rate limit

## Status

pending

## Wave

2

## Description

Набор небольших самодостаточных библиотек, на которые опираются почти все следующие задачи: работа с датами в часовом поясе Екатеринбурга (операционные сутки с 09:00, русский формат дат турниров), транслитерация и генерация slug/кодов, определение IP клиента за Traefik, билдеры JSON-LD для SEO и in-memory rate limit для форм. Тесты Vitest — для `dates` и `slug`. Функции портируются/расширяются из проекта `billiard-darom` там, где это указано.

## Dependencies

**Depends on:** task-01-starter-cleanup-deps.md
**Blocks:** task-11-lead-capture.md, task-12-public-queries.md (и косвенно 16–26)

**Context from dependencies:** задача 01 настроила Vitest (`pnpm test` = `vitest run`, алиас `@` → `src`, включаются `src/**/*.test.ts`), строгий `tsconfig` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`) и поставила `nanoid` (ESM, версия 5+/6). Остальные утилиты из этого Wave (calculator, notify, schema) пишутся параллельно — **ничего из них не импортировать**. Модули `dates.ts` и `slug.ts` должны быть «framework-free» (без `next/*`, React, БД): их импортируют и Server Actions, и клиентские компоненты.

## Files to Create

- `src/lib/dates.ts` — часовой пояс, операционная дата, форматирование дат событий, перевод минут операционных суток в часы
- `src/lib/dates.test.ts`
- `src/lib/slug.ts` — `slugify`, `nanoCode`
- `src/lib/slug.test.ts`
- `src/lib/request-ip.ts` — `getClientIp`, `hashIp`
- `src/lib/rate-limit.ts` — in-memory LRU rate limit
- `src/lib/seo/jsonld.ts` — билдеры JSON-LD

## Files to Modify

Нет.

## Technical Details

### Implementation Steps

1. **`src/lib/dates.ts`** — реализовать контракт целиком (код ниже). Только встроенный `Intl` (без date-fns): Екатеринбург — UTC+5 без перехода на летнее время, но смещение вычисляется через `Intl`, а не зашивается. Месяцы — в родительном падеже вручную (детерминированно, независимо от ICU сборки Node).
2. **`src/lib/slug.ts`** — портировать `C:\Users\ba2ra\Documents\__WORKS__\billiard-darom\src\lib\slug.ts` (карта транслитерации `CYRILLIC_MAP`, функция `slugify`, правила: нижний регистр, `х → h`, `ъ/ь` → пусто, всё не `a-z0-9` → дефис, обрезать дефисы по краям) **без изменений логики**, поправив комментарии/примеры под клуб. Добавить `nanoCode()` (код ниже).
3. **`src/lib/request-ip.ts`** — код ниже. Источник правды об IP — заголовок `x-real-ip`, который выставляет Traefik; значение `x-forwarded-for` клиентом подделывается, поэтому берётся только **последний** элемент как запасной вариант. Значение валидируется через `node:net` `isIP`.
4. **`src/lib/rate-limit.ts`** — скользящее окно, in-memory, один процесс (приложение работает в одной реплике). Хранилище — `Map` на `globalThis` (переживает HMR), лимит размера 10 000 ключей с вытеснением самых старых (LRU: при обращении запись перемещается в конец).
5. **`src/lib/seo/jsonld.ts`** — портировать `C:\Users\ba2ra\Documents\__WORKS__\billiard-darom\src\lib\seo\jsonld.ts`: оставить `jsonLdScript` (экранирование `<`, `>`, `&`, U+2028/2029 — **дословно**, это защита от XSS в `<script type="application/ld+json">`) и `breadcrumbJsonLd`; выкинуть всё магазинное (`Product`, `Offer`, `AggregateRating`, `Review`, `Store`, копейки, `reviewedBy`, FAQ); добавить `localBusinessJsonLd`, `sportsEventJsonLd`, `articleJsonLd` (без `reviewedBy`), а также `organizationJsonLd`, `personJsonLd`, `menuJsonLd` (нужны задачам 22, 23, 25). Все билдеры принимают **собственные простые типы** (без импорта схемы/настроек) — вызывающий код маппит данные. Цены в проекте — целые рубли: `price: String(rub)`, `priceCurrency: "RUB"`.
6. Написать тесты `dates.test.ts` и `slug.test.ts` по спискам ниже (в `dates.test.ts` — только фиксированные `Date` в UTC; **не** использовать `new Date()` без аргумента и не зависеть от часового пояса машины).
7. `pnpm test`, `pnpm lint`, `pnpm typecheck` проходят.

### Code Snippets

`src/lib/dates.ts`:

```ts
export const TZ = "Asia/Yekaterinburg";
/** Операционные сутки начинаются в 09:00 */
const OP_DAY_START_HOUR = 9;
const OP_DAY_START_MIN = OP_DAY_START_HOUR * 60;
const DAY_MIN = 1440;

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

interface WallParts { year: number; month: number; day: number; hour: number; minute: number; second: number }

function wallParts(date: Date): WallParts {
  const o: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(date)) if (p.type !== "literal") o[p.type] = Number(p.value);
  return {
    year: o.year ?? 1970, month: o.month ?? 1, day: o.day ?? 1,
    hour: (o.hour ?? 0) % 24, minute: o.minute ?? 0, second: o.second ?? 0,
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

/** Календарная дата в Екатеринбурге, YYYY-MM-DD */
export function getToday(now: Date = new Date()): string {
  const p = wallParts(now);
  return isoOf(p.year, p.month, p.day);
}

/** Дата операционных суток: до 09:00 (по Екатеринбургу) считается предыдущий день */
export function getOpDate(now: Date = new Date()): string {
  const p = wallParts(now);
  if (p.hour >= OP_DAY_START_HOUR) return isoOf(p.year, p.month, p.day);
  const prev = new Date(Date.UTC(p.year, p.month - 1, p.day - 1));
  return isoOf(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate());
}

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
] as const;

function splitIso(iso: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new RangeError(`Invalid date: ${iso}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** "5 марта" | "5–7 марта" | "30 марта – 2 апреля" (без года; en dash) */
export function formatEventDate(start: string, end?: string | null): string {
  const s = splitIso(start);
  const monthOf = (m: number) => MONTHS_GEN[m - 1] ?? "";
  if (!end || end === start) return `${s.d} ${monthOf(s.m)}`;
  const e = splitIso(end);
  if (s.y === e.y && s.m === e.m) return `${s.d}–${e.d} ${monthOf(s.m)}`;
  return `${s.d} ${monthOf(s.m)} – ${e.d} ${monthOf(e.m)}`;
}

/** Минуты операционных суток → часы: 0 → "09:00", 960 → "01:00", 1020 → "02:00" */
export function minToClock(min: number): string {
  const total = (((OP_DAY_START_MIN + min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

/** Обратное преобразование: "09:00" → 0, "19:00" → 600, "01:00" → 960 */
export function clockToMin(hhmm: string): number {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) throw new RangeError(`Invalid time: ${hhmm}`);
  const abs = Number(match[1]) * 60 + Number(match[2]);
  return (((abs - OP_DAY_START_MIN) % DAY_MIN) + DAY_MIN) % DAY_MIN;
}

/** Смещение TZ относительно UTC (мс) в данный момент */
function tzOffsetMs(date: Date): number {
  const p = wallParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Значение <input type="datetime-local"> ("2026-12-05T19:30") как время Екатеринбурга → Date (UTC-момент) */
export function parseLocalDateTime(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) throw new RangeError(`Invalid datetime-local value: ${value}`);
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
  let t = asUtc - tzOffsetMs(new Date(asUtc));
  t = asUtc - tzOffsetMs(new Date(t)); // второй проход на случай смены смещения
  return new Date(t);
}
```
Если `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` ругаются на `o.year` — это нормально, там стоит `?? default`.

`src/lib/slug.ts` — добавить к портированному файлу:

```ts
import { customAlphabet } from "nanoid";

const codeAlphabet = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 6);

/** Короткий код позиции/сета для URL калькулятора: 6 символов [0-9a-z] */
export function nanoCode(): string {
  return codeAlphabet();
}
```

`src/lib/request-ip.ts`:

```ts
import { createHash } from "node:crypto";
import { isIP } from "node:net";

type HeaderReader = Pick<Headers, "get">;

function clean(raw: string | null): string | null {
  if (!raw) return null;
  let v = raw.trim();
  if (v.startsWith("::ffff:") && isIP(v.slice(7)) === 4) v = v.slice(7); // IPv4-mapped
  return isIP(v) ? v.toLowerCase() : null;
}

/**
 * IP клиента. Источник — x-real-ip (Traefik перезаписывает его своим значением);
 * запасной вариант — ПОСЛЕДНИЙ элемент x-forwarded-for (левые элементы клиент подделывает).
 * Если ничего валидного нет — "unknown".
 */
export function getClientIp(headers: HeaderReader): string {
  const real = clean(headers.get("x-real-ip"));
  if (real) return real;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const last = clean(xff.split(",").at(-1) ?? null);
    if (last) return last;
  }
  return "unknown";
}

/** sha256(ip + BETTER_AUTH_SECRET) в hex (64 символа). Исходный IP не хранится. */
export function hashIp(ip: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return createHash("sha256").update(ip + secret).digest("hex");
}
```

`src/lib/rate-limit.ts`:

```ts
export interface RateLimitOptions {
  limit: number; // максимум запросов в окне
  windowMs: number;
  now?: number; // только для тестов
}
export interface RateLimitResult {
  ok: boolean;
  retryAfter: number; // секунды до освобождения слота (0, если ok)
}

const MAX_KEYS = 10_000;
const globalForRl = globalThis as unknown as { __rateLimitStore?: Map<string, number[]> };
const store = (globalForRl.__rateLimitStore ??= new Map<string, number[]>());

/** Скользящее окно: хранит метки времени запросов за последние windowMs. */
export function rateLimit(key: string, { limit, windowMs, now = Date.now() }: RateLimitOptions): RateLimitResult {
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  store.delete(key); // LRU: переместить ключ в конец
  if (hits.length >= limit) {
    store.set(key, hits);
    const oldest = hits[0] ?? now;
    return { ok: false, retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  hits.push(now);
  store.set(key, hits);
  while (store.size > MAX_KEYS) {
    const first = store.keys().next().value;
    if (first === undefined) break;
    store.delete(first);
  }
  return { ok: true, retryAfter: 0 };
}
```
Типичное использование (в `submitLead`, задача 11): `rateLimit(`lead:${ip}`, { limit: 5, windowMs: 10 * 60_000 })`.

`src/lib/seo/jsonld.ts` — новые билдеры (после перенесённых `jsonLdScript` и `breadcrumbJsonLd`; общая константа `SCHEMA_CONTEXT = "https://schema.org"`):

```ts
export interface LocalBusinessInput {
  name: string;
  url: string;
  logo?: string;
  image?: string | string[];
  description?: string;
  telephone: string;      // "+7-900-068-50-00"
  email?: string;
  priceRange?: string;    // "₽₽"
  address: { street: string; city: string; region?: string; postalCode?: string };
  geo: { lat: number; lon: number }; // 55.153739, 61.404441
  /** Часы работы, например { opens: "09:00", closes: "02:00" } — ежедневно */
  hours: { opens: string; closes: string };
  sameAs?: string[];      // VK, Telegram
}

/** SportsActivityLocation (подтип LocalBusiness): адрес, часы, geo, телефон, sameAs */
export function localBusinessJsonLd(s: LocalBusinessInput) {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "SportsActivityLocation",
    name: s.name,
    url: s.url,
    ...(s.logo ? { logo: s.logo } : {}),
    ...(s.image ? { image: s.image } : {}),
    ...(s.description ? { description: s.description } : {}),
    telephone: s.telephone,
    ...(s.email ? { email: s.email } : {}),
    ...(s.priceRange ? { priceRange: s.priceRange } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: s.address.street,
      addressLocality: s.address.city,
      ...(s.address.region ? { addressRegion: s.address.region } : {}),
      ...(s.address.postalCode ? { postalCode: s.address.postalCode } : {}),
      addressCountry: "RU",
    },
    geo: { "@type": "GeoCoordinates", latitude: s.geo.lat, longitude: s.geo.lon },
    openingHoursSpecification: [{
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
      opens: s.hours.opens,
      closes: s.hours.closes,
    }],
    ...(s.sameAs?.length ? { sameAs: s.sameAs } : {}),
  };
}

export interface SportsEventInput {
  name: string;
  url: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  description?: string;
  image?: string | string[];
  sport?: string; // «Свободная пирамида»
  entryFee?: number | null; // ₽
  location: { name: string; street: string; city: string };
  organizer?: { name: string; url?: string };
}

export function sportsEventJsonLd(t: SportsEventInput) {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "SportsEvent",
    name: t.name,
    url: t.url,
    startDate: t.startDate,
    endDate: t.endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(t.description ? { description: t.description } : {}),
    ...(t.image ? { image: t.image } : {}),
    ...(t.sport ? { sport: t.sport } : {}),
    location: {
      "@type": "Place",
      name: t.location.name,
      address: { "@type": "PostalAddress", streetAddress: t.location.street, addressLocality: t.location.city, addressCountry: "RU" },
    },
    ...(t.organizer ? { organizer: { "@type": "Organization", name: t.organizer.name, ...(t.organizer.url ? { url: t.organizer.url } : {}) } } : {}),
    ...(t.entryFee && t.entryFee > 0
      ? { offers: { "@type": "Offer", price: String(t.entryFee), priceCurrency: "RUB", availability: "https://schema.org/InStock", url: t.url } }
      : {}),
  };
}

export interface ArticleJsonLdInput {
  headline: string;
  url: string;
  description?: string;
  image?: string | string[];
  datePublished?: string; // ISO
  dateModified?: string;
  author?: { name: string; url?: string; jobTitle?: string; sameAs?: string[] };
  publisher: { name: string; url: string; logo?: string };
}

export function articleJsonLd(a: ArticleJsonLdInput) {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Article",
    headline: a.headline,
    inLanguage: "ru-RU",
    mainEntityOfPage: { "@type": "WebPage", "@id": a.url },
    url: a.url,
    ...(a.description ? { description: a.description } : {}),
    ...(a.image ? { image: a.image } : {}),
    ...(a.datePublished ? { datePublished: a.datePublished } : {}),
    ...(a.dateModified ? { dateModified: a.dateModified } : {}),
    ...(a.author ? { author: personJsonLd(a.author, false) } : {}),
    publisher: organizationJsonLd(a.publisher, false),
  };
}
```
Дополнительно (в том же файле):
- `organizationJsonLd(o: { name; url; logo?; sameAs?; telephone? }, withContext = true)` — `@type: "Organization"`, `logo` как `ImageObject`/URL;
- `personJsonLd(p: { name; url?; image?; jobTitle?; description?; sameAs? }, withContext = true)`;
- `menuJsonLd(input: { name: string; url: string; sections: { name: string; items: { name: string; description?: string; price?: number }[] }[] })` — `@type: "Menu"`, `hasMenuSection` → `MenuSection` → `hasMenuItem` → `MenuItem` с `offers: { "@type": "Offer", price: String(price), priceCurrency: "RUB" }`; для позиций без цены `offers` опускается;
- `breadcrumbJsonLd(items: { label: string; href?: string }[])` (перенос без изменений).
Контракт обязателен только для имён `jsonLdScript`, `localBusinessJsonLd`, `sportsEventJsonLd`, `articleJsonLd`, `breadcrumbJsonLd`.

### Тест-кейсы

**`dates.test.ts`** (все `Date` — фиксированные UTC-моменты; Екатеринбург = UTC+5):

| Тест | Вход | Ожидание |
|---|---|---|
| `getOpDate` до 09:00 | `2026-11-20T03:59:00Z` (08:59 20 ноября) | `"2026-11-19"` |
| `getOpDate` ровно 09:00 | `2026-11-20T04:00:00Z` | `"2026-11-20"` |
| `getOpDate` после полуночи | `2026-11-19T19:30:00Z` (00:30 20 ноября) | `"2026-11-19"` |
| `getOpDate` поздний вечер | `2026-11-20T18:59:00Z` (23:59) | `"2026-11-20"` |
| `getOpDate` ночь через границу года | `2026-12-31T19:30:00Z` (00:30 1 января 2027) | `"2026-12-31"` |
| `getToday` | `2026-11-20T18:59:00Z` → `"2026-11-20"`; `2026-11-20T19:00:00Z` → `"2026-11-21"` | календарная дата в TZ |
| `formatEventDate` | `("2026-03-05")`, `("2026-03-05","2026-03-05")`, `("2026-03-05",null)` | `"5 марта"` |
| | `("2026-03-05","2026-03-07")`, `("2026-01-17","2026-01-18")`, `("2026-05-09","2026-05-10")` | `"5–7 марта"`, `"17–18 января"`, `"9–10 мая"` |
| | `("2026-03-30","2026-04-02")` | `"30 марта – 2 апреля"` |
| | `("2026-12-31","2027-01-02")` | `"31 декабря – 2 января"` |
| `formatEventDate` ошибка | `("2026-3-5")` | бросает `RangeError` |
| `minToClock` | `0, 30, 420, 960, 1020, 1440, -60` | `"09:00","09:30","16:00","01:00","02:00","09:00","08:00"` |
| `clockToMin` | `"09:00","19:00","00:00","08:30","01:00"` | `0, 600, 900, 1410, 960` |
| round-trip | для всех `m` кратных 30 в `0..1410`: `clockToMin(minToClock(m)) === m` | верно |
| `clockToMin` ошибка | `"25:00"`, `"9"` | `RangeError` |
| `parseLocalDateTime` | `"2026-12-05T19:30"` | `toISOString() === "2026-12-05T14:30:00.000Z"` |
| | `"2026-12-05T00:15"` | `"2026-12-04T19:15:00.000Z"` |
| | `"2026-12-05T19:30:15"` | секунды сохраняются: `"2026-12-05T14:30:15.000Z"` |
| | `"2026-12-05 19:30"` | `RangeError` |

**`slug.test.ts`:**

| Вход | Ожидание |
|---|---|
| `slugify("Девичник по понедельникам")` | `"devichnik-po-ponedelnikam"` |
| `slugify("Марафон-Промнефтегаз 1 тур")` | `"marafon-promneftegaz-1-tur"` |
| `slugify("Сеньоры Челябинска")` | `"senory-chelyabinska"` |
| `slugify("Мисс бильярд")` | `"miss-bilyard"` |
| `slugify("Ёлка & Щука!")` | `"elka-schuka"` |
| `slugify("Хамам")` | `"hamam"` |
| `slugify("  --Hello__World--  ")` | `"hello-world"` |
| `slugify("")`, `slugify("!!!")`, `slugify("ъь")` | `""` |
| `slugify("Pool 8 ball 2026")` | `"pool-8-ball-2026"` |
| `nanoCode()` × 1000 | каждый код соответствует `/^[0-9a-z]{6}$/`; среди 1000 значений не меньше 990 уникальных |

### Environment Variables

- `BETTER_AUTH_SECRET` — читается `hashIp()` (соль хэширования IP). Если не задана — бросается ошибка.

## Acceptance Criteria

- [ ] `src/lib/dates.ts` экспортирует `TZ`, `getOpDate`, `getToday`, `formatEventDate`, `minToClock`, `clockToMin`, `parseLocalDateTime` с сигнатурами из контракта; не использует `new Date()` без аргумента вне значений по умолчанию; не зависит от часового пояса машины
- [ ] `src/lib/slug.ts` экспортирует `slugify` (результат совпадает с `billiard-darom` на кириллице) и `nanoCode()` (6 символов `[0-9a-z]`); без импортов `next/*`/React/БД
- [ ] `getClientIp` берёт валидный `x-real-ip`, иначе последний элемент `x-forwarded-for`, иначе `"unknown"`; `hashIp` возвращает 64-символьный hex от `sha256(ip + BETTER_AUTH_SECRET)`
- [ ] `rateLimit(key, { limit, windowMs })` возвращает `{ ok, retryAfter }`; 6-й вызов подряд при `limit: 5` даёт `ok: false` и `retryAfter ≥ 1`; хранилище ограничено 10 000 ключей
- [ ] `src/lib/seo/jsonld.ts` экспортирует `jsonLdScript`, `localBusinessJsonLd`, `sportsEventJsonLd`, `articleJsonLd`, `breadcrumbJsonLd` (+ `organizationJsonLd`, `personJsonLd`, `menuJsonLd`); `jsonLdScript` экранирует `<`, `>`, `&`, U+2028/2029; в файле нет магазинных типов (Product/Offer-в-копейках/Review/Store)
- [ ] `dates.test.ts` и `slug.test.ts` реализуют все кейсы таблиц и проходят
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` проходят

## Notes

- Не добавлять `import "server-only"` в `request-ip.ts`/`rate-limit.ts`: пакет бросает исключение вне Next.js (в т.ч. в Vitest). Эти модули не должны попадать в клиентский бандл — это забота вызывающего кода.
- `hashIp` читает `process.env` напрямую (а не `getServerEnv()`), чтобы не требовать остальных переменных окружения.
- `rateLimit` — только на один процесс: в Dokploy выставлено `replicas = 1`.
- Описание старых проблем: `billiard-darom/src/lib/slug.ts` хранит карту транслитерации отдельно от `markdown.ts` намеренно (стабильность якорей) — в этом проекте повторять такое разделение не нужно, `slug.ts` самодостаточен.
- Задачи-потребители: `getOpDate`/`getToday` — задача 12 (параметр кэш-функций), `formatEventDate` — 20/22, `minToClock` — 17, `parseLocalDateTime` — 26, `getClientIp`/`hashIp`/`rateLimit` — 11 и 08, `nanoCode` — 18, JSON-LD — 22/23/25.
