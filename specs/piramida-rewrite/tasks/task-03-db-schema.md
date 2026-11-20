# Task 03: Полная схема БД (Drizzle) + одна миграция

## Status

complete

## Wave

2

## Description

Создаёт всю схему базы данных проекта одним потоком и одной миграцией: таблицы Better Auth (с колонками плагинов `admin`, `twoFactor` и таблицей `rate_limit`), клуб (турниры, акции, услуги, галереи), аренда и тарифы, меню и банкетные сеты, заявки и юридические документы, медиатека, блог (авторы, рубрики, теги, статьи, редиректы), настройки и журнал аудита. После этой задачи **никто больше не меняет схему**: следующие задачи только читают/пишут данные. Также делает `src/lib/db.ts` пригодным для `next build` без БД.

## Dependencies

**Depends on:** task-01-starter-cleanup-deps.md
**Blocks:** task-08-auth-admin.md, task-09-media-core.md, task-10-seed-data.md, task-11-lead-capture.md, task-12-public-queries.md

**Context from dependencies:** задача 01 почистила стартер и обновила пакеты (`drizzle-orm` ≈0.45, `drizzle-kit` 0.31, драйвер `postgres`), оставила `docker-compose.yml` с `postgres:18-alpine` (`dev_user` / `dev_password` / `postgres_dev`, порт 5432), создала `env.example` (`POSTGRES_URL=postgresql://dev_user:dev_password@localhost:5432/postgres_dev`) и скрипты `db:generate` / `db:migrate` в `package.json`. В репозитории сейчас: `src/lib/schema.ts` (4 таблицы Better Auth: `user`, `session`, `account`, `verification`), `src/lib/db.ts` (импортирует `./schema`), `drizzle.config.ts` (указывает на `./src/lib/schema.ts`), `drizzle/` со старыми стартовыми миграциями `0000_*.sql`, `0001_*.sql`.

## Files to Create

- `src/lib/schema/_common.ts` — фабрики общих колонок
- `src/lib/schema/enums.ts` — все `pgEnum`
- `src/lib/schema/auth.ts` — Better Auth: `user`, `session`, `account`, `verification`, `twoFactor`, `rateLimit`
- `src/lib/schema/media.ts` — `mediaAssets`
- `src/lib/schema/menu.ts` — `menuCategories`, `priceGroups`, `priceGroupTiers`, `menuItems`, `menuItemVariants`, `menuModifiers`, `banquetSets`, `banquetSetItems`
- `src/lib/schema/club.ts` — `tournamentSeries`, `tournaments`, `promotions`, `services`, `galleries`, `galleryItems`
- `src/lib/schema/pricing.ts` — `halls`, `rentalTariffs`, `extraServices`, `penaltyItems`
- `src/lib/schema/leads.ts` — `legalDocuments`, `leads`
- `src/lib/schema/content.ts` — `authors`, `rubrics`, `blogTags`, `articleTags`, `articles`, `redirects`
- `src/lib/schema/settings.ts` — `siteSettings`, `auditLog`
- `src/lib/schema/relations.ts` — `relations()` для relational-запросов
- `src/lib/schema/index.ts` — реэкспорт всего
- `drizzle/0000_*.sql` + `drizzle/meta/*` — **генерируются** `pnpm db:generate`

## Files to Modify

- `drizzle.config.ts` — `schema: "./src/lib/schema/index.ts"`, подхват `.env`
- `src/lib/db.ts` — импорт `./schema` (теперь каталог), ленивая/безопасная для сборки инициализация

## Files to Delete

- `src/lib/schema.ts` — заменён каталогом `src/lib/schema/`
- `drizzle/0000_chilly_the_phantom.sql`, `drizzle/0001_last_warpath.sql`, `drizzle/meta/*` — стартовые миграции (на проде ничего не применялось); вместо них генерируется **одна** новая миграция

## Technical Details

### Implementation Steps

1. Убедиться, что Docker-БД поднята **с чистого листа**: `docker compose down -v && docker compose up -d` (локальная БД могла хранить старые стартовые миграции). Скопировать `env.example` в `.env`, если его ещё нет (нужны `POSTGRES_URL` и любой `BETTER_AUTH_SECRET` ≥ 32 символов).
2. Удалить `src/lib/schema.ts` и содержимое `drizzle/` (`git rm -r drizzle`). Создать каталог `src/lib/schema/` и файлы ниже.
3. **Правила для всех файлов схемы:**
   - Импорты **только относительные** (`./enums`, `./auth`) — `drizzle-kit` не понимает алиас `@/`.
   - Не-Better-Auth таблицы: PK `uuid("id").primaryKey().defaultRandom()` (никаких serial/integer id). Таблицы Better Auth: `text("id").primaryKey()` (так требует библиотека).
   - SQL-имена — `snake_case`, Drizzle-ключи — `camelCase`. Деньги — `integer` (целые рубли). Даты без времени — `date(..., { mode: "string" })` (формат `YYYY-MM-DD`). Моменты времени — `timestamp(..., { withTimezone: true })` (кроме Better Auth — там как было).
   - FK на `mediaAssets` — **`onDelete: "restrict"`**. FK на таблицы справочников из «мягких» связей — `set null`; дочерние строки — `cascade`.
   - Для каждой таблицы экспортировать типы: `export type X = typeof x.$inferSelect; export type NewX = typeof x.$inferInsert;`.
4. Написать `drizzle.config.ts` и `src/lib/db.ts` (код ниже).
5. `pnpm db:generate --name init` → должен появиться **один** файл `drizzle/0000_init.sql`. Открыть и проверить: есть `GENERATED ALWAYS AS IDENTITY` у `leads.number`; все 14 `CREATE TYPE`; индекс `tournaments_end_date_idx`; уникальные ограничения на `code` у `menu_items`, `menu_item_variants`, `banquet_sets`, `price_group_tiers`; `CHECK`-ограничения; `ON DELETE restrict` у ссылок на `media_assets`.
6. `pnpm db:migrate` (**никогда** `drizzle-kit push`). Затем проверить таблицы:

   ```bash
   docker compose exec postgres psql -U dev_user -d postgres_dev -c "\dt"
   docker compose exec postgres psql -U dev_user -d postgres_dev -c "\d leads"
   ```
   Ожидаемо 35 таблиц в схеме public (6 auth + 1 media + 8 menu + 6 club + 4 pricing + 2 leads + 6 content + 2 settings), плюс служебная таблица миграций drizzle. Если счёт расходится — сверить с «Files to Create».
7. Дымовая проверка identity и ограничений (вручную в psql, транзакция откатывается):

   ```sql
   BEGIN;
   INSERT INTO legal_documents (type, version, body, sha256) VALUES ('consent','1','x',repeat('a',64)) RETURNING id;
   -- подставить id:
   INSERT INTO leads (type, source_block, form_title, page_url, consent_document_id, consent_at, ip_hash)
     VALUES ('callback','Шапка сайта','Заказать звонок','/','<id>', now(), repeat('b',64)) RETURNING number;  -- 1
   ROLLBACK;
   ```
8. `pnpm lint`, `pnpm typecheck`, `pnpm build:ci` (без БД и без `.env`: проверить, что сборка **не падает** из-за `db.ts`).

### Code Snippets

`drizzle.config.ts`:

```ts
import { existsSync } from "node:fs";
import type { Config } from "drizzle-kit";

// drizzle-kit сам .env не читает
if (existsSync(".env")) process.loadEnvFile(".env");

export default {
  dialect: "postgresql",
  schema: "./src/lib/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.POSTGRES_URL! },
} satisfies Config;
```

`src/lib/db.ts` (должен работать при `next build` без `POSTGRES_URL`: клиент `postgres-js` не подключается до первого запроса):

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };

function createClient() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    // Во время `next build` (в том числе docker build) БД нет — клиент не подключается,
    // пока не выполнен запрос; в рантайме отсутствие переменной — ошибка конфигурации.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return postgres("postgres://build:build@127.0.0.1:5432/build", { max: 1 });
    }
    throw new Error("POSTGRES_URL environment variable is not set");
  }
  return postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
}

// один клиент на процесс (в dev переживает HMR)
export const queryClient = globalForDb.__pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = queryClient;

export const db = drizzle(queryClient, { schema });
export type Db = typeof db;
```
Скрипты (`seed`, `seed-admin`, `import-legacy-images`) закрывают соединение `await queryClient.end()`.

`src/lib/schema/_common.ts`:

```ts
import { boolean, integer, timestamp, uuid } from "drizzle-orm/pg-core";

// Каждая функция возвращает НОВЫЙ builder — вызывать в каждой таблице отдельно.
export const id = () => uuid("id").primaryKey().defaultRandom();
export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();
export const sortOrder = () => integer("sort_order").notNull().default(0);
export const isActive = () => boolean("is_active").notNull().default(true);
```

`src/lib/schema/enums.ts` (значения — строго из `contracts.md`):

```ts
import { pgEnum } from "drizzle-orm/pg-core";

export const disciplineEnum = pgEnum("discipline", [
  "free_pyramid", "combined_pyramid", "dynamic_pyramid", "moscow_pyramid",
  "free_pyramid_continuation", "pool", "other",
]);
export const tournamentLevelEnum = pgEnum("tournament_level", [
  "regional_championship", "regional_youth", "club", "other",
]);
export const hallKindEnum = pgEnum("hall_kind", ["common", "vip"]);
export const priceUnitEnum = pgEnum("price_unit", ["per_hour", "fixed", "per_session"]);
export const tariffAudienceEnum = pgEnum("tariff_audience", ["all", "pensioner"]);
export const promotionTargetEnum = pgEnum("promotion_target", [
  "table_rental", "menu_category", "takeaway", "other",
]);
export const measureUnitEnum = pgEnum("measure_unit", ["g", "ml", "l", "pcs"]);
export const setPricingModeEnum = pgEnum("set_pricing_mode", ["per_person", "fixed"]);
export const penaltyKindEnum = pgEnum("penalty_kind", ["dishware", "property"]);
export const leadTypeEnum = pgEnum("lead_type", [
  "callback", "booking", "promo", "calculator", "tournament",
]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "in_progress", "done", "spam"]);
export const callbackWindowEnum = pgEnum("callback_window", ["now", "hour", "day", "week"]);
export const articleStatusEnum = pgEnum("article_status", ["draft", "scheduled", "published"]);
export const legalDocTypeEnum = pgEnum("legal_doc_type", ["policy", "consent"]);
```

`src/lib/schema/auth.ts` — Better Auth (колонки плагинов `admin` и `twoFactor`; если после установки версия `better-auth` требует иных колонок — сверить с документацией этой версии через context7 и привести в соответствие, добавляя только nullable/default-колонки):

```ts
import { bigint, boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ВАЖНО: id таблиц Better Auth — text (исключение из правила UUID)

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    // plugin: admin
    role: text("role").default("user"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
    // plugin: twoFactor
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
  },
  (t) => [index("user_email_idx").on(t.email)]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // plugin: admin
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("session_user_id_idx").on(t.userId), index("session_token_idx").on(t.token)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("account_user_id_idx").on(t.userId),
    index("account_provider_account_idx").on(t.providerId, t.accountId),
  ]
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// plugin: twoFactor (SQL-имя таблицы — two_factor; ключ в схеме должен быть twoFactor)
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until"),
  },
  (t) => [index("two_factor_secret_idx").on(t.secret), index("two_factor_user_id_idx").on(t.userId)]
);

// Better Auth rate limit в БД (storage: "database"); ключ в схеме — rateLimit
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
```

`src/lib/schema/media.ts`:

```ts
import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id } from "./_common";

export type MediaVariant = { w: number; format: "avif" | "webp"; file: string };

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: id(),
    /** Путь относительно UPLOAD_DIR без расширения, например `2026/11/<uuid>` */
    path: text("path").notNull().unique(),
    originalName: text("original_name").notNull(),
    mime: varchar("mime", { length: 64 }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    size: integer("size").notNull(),
    blurDataUrl: text("blur_data_url").notNull(),
    variants: jsonb("variants").$type<MediaVariant[]>().notNull().default(sql`'[]'::jsonb`),
    alt: text("alt").notNull().default(""),
    folder: varchar("folder", { length: 64 }).notNull().default("general"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("media_assets_folder_idx").on(t.folder),
    index("media_assets_created_at_idx").on(t.createdAt),
  ]
);

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
```

`src/lib/schema/menu.ts`:

```ts
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn, boolean, check, index, integer, numeric, pgTable, text, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, isActive, sortOrder, updatedAt } from "./_common";
import { measureUnitEnum, setPricingModeEnum } from "./enums";
import { mediaAssets } from "./media";

/** Общая сетка цен на раздел (Teatone, фирменные чаи, лимонады) */
export const priceGroups = pgTable("price_groups", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const priceGroupTiers = pgTable(
  "price_group_tiers",
  {
    id: id(),
    groupId: uuid("group_id").notNull().references(() => priceGroups.id, { onDelete: "cascade" }),
    /** nanoid 6 символов [0-9a-z]; код позиции калькулятора для сетки = `${menuItems.code}-${code}` */
    code: varchar("code", { length: 8 }).notNull().unique(),
    label: text("label").notNull(), // «Чайник 600 мл»
    amount: numeric("amount", { precision: 8, scale: 2, mode: "number" }),
    unit: measureUnitEnum("unit"),
    price: integer("price").notNull(),
    sortOrder: sortOrder(),
  },
  (t) => [index("price_group_tiers_group_idx").on(t.groupId), check("price_group_tiers_price_chk", sql`${t.price} >= 0`)]
);

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: id(),
    parentId: uuid("parent_id").references((): AnyPgColumn => menuCategories.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    description: text("description"),
    funFactTitle: text("fun_fact_title"),
    funFactText: text("fun_fact_text"),
    priceGroupId: uuid("price_group_id").references(() => priceGroups.id, { onDelete: "set null" }),
    sortOrder: sortOrder(),
    isActive: isActive(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("menu_categories_parent_idx").on(t.parentId)]
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: id(),
    /** nanoid 6 символов [0-9a-z] — для URL калькулятора */
    code: varchar("code", { length: 8 }).notNull().unique(),
    categoryId: uuid("category_id").notNull().references(() => menuCategories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    choiceNote: text("choice_note"), // «на выбор: …»
    originCountry: text("origin_country"),
    /** Либо priceGroupId (цены из price_group_tiers), либо >= 1 menu_item_variants. Проверяется в zod/Server Action */
    priceGroupId: uuid("price_group_id").references(() => priceGroups.id, { onDelete: "set null" }),
    imageMediaId: uuid("image_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
    isTakeawayDiscount: boolean("is_takeaway_discount").notNull().default(false),
    sortOrder: sortOrder(),
    isActive: isActive(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("menu_items_category_idx").on(t.categoryId, t.sortOrder)]
);

export const menuItemVariants = pgTable(
  "menu_item_variants",
  {
    id: id(),
    code: varchar("code", { length: 8 }).notNull().unique(),
    itemId: uuid("item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
    label: text("label"),
    amount: numeric("amount", { precision: 8, scale: 2, mode: "number" }),
    unit: measureUnitEnum("unit"),
    price: integer("price").notNull(),
    sortOrder: sortOrder(),
    isActive: isActive(),
  },
  (t) => [index("menu_item_variants_item_idx").on(t.itemId), check("menu_item_variants_price_chk", sql`${t.price} >= 0`)]
);

/** Платные добавки — в калькулятор не входят, показываются текстом */
export const menuModifiers = pgTable("menu_modifiers", {
  id: id(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  categoryId: uuid("category_id").references(() => menuCategories.id, { onDelete: "set null" }),
  sortOrder: sortOrder(),
  isActive: isActive(),
});

export const banquetSets = pgTable(
  "banquet_sets",
  {
    id: id(),
    code: varchar("code", { length: 8 }).notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
    pricingMode: setPricingModeEnum("pricing_mode").notNull().default("per_person"),
    price: integer("price").notNull(),
    minGuests: integer("min_guests"),
    maxGuests: integer("max_guests"),
    sortOrder: sortOrder(),
    isActive: isActive(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("banquet_sets_guests_chk", sql`${t.minGuests} is null or ${t.maxGuests} is null or ${t.maxGuests} >= ${t.minGuests}`)]
);

export const banquetSetItems = pgTable(
  "banquet_set_items",
  {
    id: id(),
    setId: uuid("set_id").notNull().references(() => banquetSets.id, { onDelete: "cascade" }),
    menuItemVariantId: uuid("menu_item_variant_id").references(() => menuItemVariants.id, { onDelete: "set null" }),
    customLabel: text("custom_label"), // если нет варианта меню
    qty: integer("qty").notNull().default(1),
    sortOrder: sortOrder(),
  },
  (t) => [index("banquet_set_items_set_idx").on(t.setId), check("banquet_set_items_qty_chk", sql`${t.qty} > 0`)]
);

export type MenuCategory = typeof menuCategories.$inferSelect;
export type PriceGroup = typeof priceGroups.$inferSelect;
export type PriceGroupTier = typeof priceGroupTiers.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type MenuItemVariant = typeof menuItemVariants.$inferSelect;
export type MenuModifier = typeof menuModifiers.$inferSelect;
export type BanquetSet = typeof banquetSets.$inferSelect;
export type BanquetSetItem = typeof banquetSetItems.$inferSelect;
```
(`uniqueIndex` в импорте убрать, если не используется — иначе `noUnusedLocals`.)

`src/lib/schema/pricing.ts`:

```ts
import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, smallint, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, id, isActive, sortOrder, updatedAt } from "./_common";
import { hallKindEnum, penaltyKindEnum, priceUnitEnum, tariffAudienceEnum } from "./enums";

export const halls = pgTable("halls", {
  id: id(),
  name: text("name").notNull(), // «Общий зал», «VIP 1»
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  kind: hallKindEnum("kind").notNull(),
  /** У VIP-комнат = 1 (цена за комнату) */
  tablesCount: integer("tables_count").notNull().default(1),
  seatsPerTable: integer("seats_per_table").notNull().default(4),
  description: text("description"),
  sortOrder: sortOrder(),
  isActive: isActive(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const rentalTariffs = pgTable(
  "rental_tariffs",
  {
    id: id(),
    hallId: uuid("hall_id").notNull().references(() => halls.id, { onDelete: "cascade" }),
    /** 0 = воскресенье … 6 = суббота; день D операционных суток (с 09:00 D до 09:00 D+1) */
    daysOfWeek: smallint("days_of_week").array().notNull(),
    /** Минуты от 09:00 операционных суток: 16:00–02:00 → 420–1020; 02:00–09:00 → 1020–1440 */
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    price: integer("price").notNull(),
    priceUnit: priceUnitEnum("price_unit").notNull().default("per_hour"),
    audience: tariffAudienceEnum("audience").notNull().default("all"),
    label: text("label").notNull(),
    validFrom: date("valid_from", { mode: "string" }),
    validTo: date("valid_to", { mode: "string" }),
    isActive: isActive(),
    sortOrder: sortOrder(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("rental_tariffs_hall_idx").on(t.hallId),
    check("rental_tariffs_window_chk", sql`${t.startMin} >= 0 and ${t.endMin} <= 1440 and ${t.endMin} > ${t.startMin}`),
    check("rental_tariffs_price_chk", sql`${t.price} >= 0`),
  ]
);

/** Нарды/шахматы, прокат кия, тренер. priceUnit: per_hour | per_session (fixed не используется — проверяется в zod) */
export const extraServices = pgTable("extra_services", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  priceUnit: priceUnitEnum("price_unit").notNull().default("per_session"),
  sortOrder: sortOrder(),
  isActive: isActive(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const penaltyItems = pgTable(
  "penalty_items",
  {
    id: id(),
    kind: penaltyKindEnum("kind").notNull(),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    priceIsMinimum: boolean("price_is_minimum").notNull().default(false), // «от …»
    sortOrder: sortOrder(),
    isActive: isActive(),
  },
  (t) => [index("penalty_items_kind_idx").on(t.kind, t.sortOrder)]
);

export type Hall = typeof halls.$inferSelect;
export type RentalTariff = typeof rentalTariffs.$inferSelect;
export type ExtraService = typeof extraServices.$inferSelect;
export type PenaltyItem = typeof penaltyItems.$inferSelect;
```

`src/lib/schema/club.ts`:

```ts
import { sql } from "drizzle-orm";
import {
  boolean, check, date, index, integer, pgTable, smallint, text, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, isActive, sortOrder, updatedAt } from "./_common";
import {
  disciplineEnum, hallKindEnum, promotionTargetEnum, tournamentLevelEnum,
} from "./enums";
import { mediaAssets } from "./media";
import { menuCategories } from "./menu";

export const tournamentSeries = pgTable("tournament_series", {
  id: id(),
  name: text("name").notNull(), // «Марафон-Промнефтегаз», «Сеньоры Челябинска»
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  description: text("description"),
  sortOrder: sortOrder(),
  isActive: isActive(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const tournaments = pgTable(
  "tournaments",
  {
    id: id(),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    seriesId: uuid("series_id").references(() => tournamentSeries.id, { onDelete: "set null" }),
    stageNumber: integer("stage_number"),
    discipline: disciplineEnum("discipline"),
    level: tournamentLevelEnum("level").notNull().default("other"),
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    startDate: date("start_date", { mode: "string" }).notNull(),
    /** = startDate для однодневных. Фильтр «предстоящие»: endDate >= сегодня (Екатеринбург) */
    endDate: date("end_date", { mode: "string" }).notNull(),
    entryFee: integer("entry_fee"), // ₽
    prizeFund: integer("prize_fund"), // ₽
    description: text("description"),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
    registrationOpen: boolean("registration_open").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tournaments_end_date_idx").on(t.endDate),
    index("tournaments_series_idx").on(t.seriesId),
    check("tournaments_dates_chk", sql`${t.endDate} >= ${t.startDate}`),
  ]
);

export const promotions = pgTable(
  "promotions",
  {
    id: id(),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    shortText: text("short_text").notNull(),
    description: text("description").notNull().default(""), // markdown
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
    discountPercent: integer("discount_percent"),
    /** День D операционных суток: 0 = вс … 6 = сб; null = каждый день */
    daysOfWeek: smallint("days_of_week").array(),
    /** Минуты от 09:00 операционных суток (0..1440), как у тарифов */
    startMin: integer("start_min"),
    endMin: integer("end_min"),
    target: promotionTargetEnum("target").notNull().default("other"),
    targetMenuCategoryId: uuid("target_menu_category_id").references(() => menuCategories.id, { onDelete: "set null" }),
    audienceNote: text("audience_note"),
    validFrom: date("valid_from", { mode: "string" }),
    validTo: date("valid_to", { mode: "string" }),
    showInCarousel: boolean("show_in_carousel").notNull().default(true),
    isActive: isActive(),
    sortOrder: sortOrder(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "promotions_window_chk",
      sql`(${t.startMin} is null and ${t.endMin} is null) or (${t.startMin} >= 0 and ${t.endMin} <= 1440 and ${t.endMin} > ${t.startMin})`
    ),
    check("promotions_discount_chk", sql`${t.discountPercent} is null or (${t.discountPercent} between 1 and 100)`),
  ]
);

/** 4 вкладки «Услуги»: key = russian | american | vip | training */
export const services = pgTable("services", {
  id: id(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  bullets: text("bullets").array().notNull().default(sql`'{}'::text[]`),
  /** Ручная цена «от …»; если null и задан priceFromHallKind — считается из rental_tariffs */
  priceFrom: integer("price_from"),
  priceFromHallKind: hallKindEnum("price_from_hall_kind"),
  priceNote: text("price_note"), // «/час», «Тренер + стол»
  /** Значение block для попапа брони, например «Русский бильярд» */
  ctaBlock: text("cta_block").notNull().default("Бронирование"),
  /** Тип кнопки вкладки: "booking" (попап брони) | "callback" (обратный звонок); проверяется zod в админке */
  ctaType: varchar("cta_type", { length: 16 }).notNull().default("booking"),
  /** key галереи (galleries.key) с фото вкладки: service_russian | service_pool | service_vip | service_training */
  galleryKey: text("gallery_key"),
  sortOrder: sortOrder(),
  isActive: isActive(),
  updatedAt: updatedAt(),
});

/** key (text, не enum): seed создаёт hero | service_russian | service_pool | service_vip | service_training | bar | about | cta; админка может добавлять другие */
export const galleries = pgTable("galleries", {
  id: id(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  updatedAt: updatedAt(),
});

export const galleryItems = pgTable(
  "gallery_items",
  {
    id: id(),
    galleryId: uuid("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id").notNull().references(() => mediaAssets.id, { onDelete: "restrict" }),
    caption: text("caption"),
    /** 'default' | 'mobile' — hero имеет отдельное мобильное изображение */
    variant: varchar("variant", { length: 16 }).notNull().default("default"),
    sortOrder: sortOrder(),
  },
  (t) => [
    index("gallery_items_gallery_idx").on(t.galleryId, t.sortOrder),
    uniqueIndex("gallery_items_unique_idx").on(t.galleryId, t.mediaId, t.variant),
  ]
);

export type TournamentSeries = typeof tournamentSeries.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type Promotion = typeof promotions.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Gallery = typeof galleries.$inferSelect;
export type GalleryItem = typeof galleryItems.$inferSelect;
```

`src/lib/schema/leads.ts`:

```ts
import { sql } from "drizzle-orm";
import {
  char, date, index, integer, jsonb, pgTable, text, timestamp, unique, uuid, varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_common";
import { callbackWindowEnum, leadStatusEnum, leadTypeEnum, legalDocTypeEnum } from "./enums";
import { tournaments, promotions } from "./club";

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: id(),
    type: legalDocTypeEnum("type").notNull(),
    version: varchar("version", { length: 32 }).notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull(), // markdown
    sha256: char("sha256", { length: 64 }).notNull(),
    /** null = черновик (правит админка, задача 19); текущая версия — максимальный НЕ null publishedAt */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique("legal_documents_type_version_uq").on(t.type, t.version), index("legal_documents_type_pub_idx").on(t.type, t.publishedAt)]
);

export type NotifyChannelStatus = { ok: boolean; error?: string; at: string };
export type LeadNotifyStatus = { email?: NotifyChannelStatus; telegram?: NotifyChannelStatus };

export const leads = pgTable(
  "leads",
  {
    id: id(),
    /** «Заявка #N» */
    number: integer("number").notNull().generatedAlwaysAsIdentity(),
    type: leadTypeEnum("type").notNull(),
    status: leadStatusEnum("status").notNull().default("new"),
    sourceBlock: text("source_block").notNull(), // «Шапка сайта», «Первый экран»…
    formTitle: text("form_title").notNull(),
    pageUrl: text("page_url").notNull(),
    name: varchar("name", { length: 120 }),
    phone: varchar("phone", { length: 32 }),
    callbackWindow: callbackWindowEnum("callback_window"),
    preferredDate: date("preferred_date", { mode: "string" }),
    preferredTime: varchar("preferred_time", { length: 5 }),
    guests: integer("guests"),
    comment: text("comment"),
    promotionId: uuid("promotion_id").references(() => promotions.id, { onDelete: "set null" }),
    tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "set null" }),
    /** Пересчитанный на сервере расчёт калькулятора (QuoteInput + Quote) */
    quoteSnapshot: jsonb("quote_snapshot").$type<Record<string, unknown>>(),
    quoteTotal: integer("quote_total"),
    consentDocumentId: uuid("consent_document_id").notNull().references(() => legalDocuments.id, { onDelete: "restrict" }),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    /** sha256(ip + BETTER_AUTH_SECRET); nullable — обнуляется cron'ом обезличивания */
    ipHash: char("ip_hash", { length: 64 }),
    userAgent: text("user_agent").notNull().default(""),
    notifyStatus: jsonb("notify_status").$type<LeadNotifyStatus>().notNull().default(sql`'{}'::jsonb`),
    /** Дата обезличивания (name/phone/comment/ipHash → null, userAgent → '') по сроку хранения */
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("leads_number_uq").on(t.number),
    index("leads_status_created_idx").on(t.status, t.createdAt),
    index("leads_created_idx").on(t.createdAt),
    index("leads_type_idx").on(t.type),
  ]
);

export type LegalDocument = typeof legalDocuments.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
```
Проверить в сгенерированном SQL, что у `number` стоит `GENERATED ALWAYS AS IDENTITY`; если Drizzle его не сгенерировал — исправить определение колонки (`integer("number").generatedAlwaysAsIdentity()` + `.notNull()` в зависимости от версии), а не обходить руками SQL.

`src/lib/schema/content.ts`:

```ts
import { sql } from "drizzle-orm";
import {
  boolean, check, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uuid, varchar,
} from "drizzle-orm/pg-core";
import { articleStatusEnum } from "./enums";
import { createdAt, id, sortOrder, updatedAt } from "./_common";
import { mediaAssets } from "./media";

/** Авторы-тренеры (бывший expert из billiard-darom) */
export const authors = pgTable("authors", {
  id: id(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  name: text("name").notNull(),
  photoMediaId: uuid("photo_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
  roleInClub: text("role_in_club"),
  rank: text("rank"), // разряд, звание
  bio: text("bio"), // markdown
  sameAs: jsonb("same_as").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  sortOrder: sortOrder(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const rubrics = pgTable("rubrics", {
  id: id(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  imageMediaId: uuid("image_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const blogTags = pgTable("blog_tags", {
  id: id(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const articles = pgTable(
  "articles",
  {
    id: id(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    body: text("body").notNull().default(""), // markdown
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "restrict" }),
    authorId: uuid("author_id").references(() => authors.id, { onDelete: "set null" }),
    rubricId: uuid("rubric_id").references(() => rubrics.id, { onDelete: "set null" }),
    isFeatured: boolean("is_featured").notNull().default(false),
    showToc: boolean("show_toc").notNull().default(true),
    status: articleStatusEnum("status").notNull().default("draft"),
    /** Для scheduled/published. Публичная выдача: status in (published, scheduled) and published_at <= now */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    readingMinutes: integer("reading_minutes").notNull().default(1),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    noindex: boolean("noindex").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("articles_status_published_idx").on(t.status, t.publishedAt),
    index("articles_rubric_idx").on(t.rubricId),
    index("articles_author_idx").on(t.authorId),
  ]
);

export const articleTags = pgTable(
  "article_tags",
  {
    articleId: uuid("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => blogTags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.tagId] }), index("article_tags_tag_idx").on(t.tagId)]
);

/** 301 при смене slug и для старых URL. Проверяется только при промахе страницы */
export const redirects = pgTable(
  "redirects",
  {
    id: id(),
    fromPath: text("from_path").notNull().unique(),
    toPath: text("to_path").notNull(),
    code: smallint("code").notNull().default(301),
    createdAt: createdAt(),
  },
  (t) => [check("redirects_code_chk", sql`${t.code} in (301, 302, 307, 308)`)]
);

export type Author = typeof authors.$inferSelect;
export type Rubric = typeof rubrics.$inferSelect;
export type BlogTag = typeof blogTags.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Redirect = typeof redirects.$inferSelect;
```

`src/lib/schema/settings.ts`:

```ts
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./_common";

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(), // «tournament.create», «lead.status»…
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    diff: jsonb("diff").$type<unknown>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId), index("audit_log_created_idx").on(t.createdAt)]
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
```
(убрать неиспользуемые импорты `timestamp`, `uuid`.)

`src/lib/schema/relations.ts` (relational query API v1 — `relations()`):

```ts
import { relations } from "drizzle-orm";
import { account, session, twoFactor, user } from "./auth";
import { articles, articleTags, authors, blogTags, rubrics } from "./content";
import { galleries, galleryItems, promotions, tournamentSeries, tournaments } from "./club";
import { leads, legalDocuments } from "./leads";
import { mediaAssets } from "./media";
import {
  banquetSetItems, banquetSets, menuCategories, menuItemVariants, menuItems, priceGroupTiers, priceGroups,
} from "./menu";
import { halls, rentalTariffs } from "./pricing";

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session), accounts: many(account), twoFactors: many(twoFactor),
}));
export const sessionRelations = relations(session, ({ one }) => ({ user: one(user, { fields: [session.userId], references: [user.id] }) }));
export const accountRelations = relations(account, ({ one }) => ({ user: one(user, { fields: [account.userId], references: [user.id] }) }));
export const twoFactorRelations = relations(twoFactor, ({ one }) => ({ user: one(user, { fields: [twoFactor.userId], references: [user.id] }) }));

export const tournamentSeriesRelations = relations(tournamentSeries, ({ many }) => ({ tournaments: many(tournaments) }));
export const tournamentsRelations = relations(tournaments, ({ one }) => ({
  series: one(tournamentSeries, { fields: [tournaments.seriesId], references: [tournamentSeries.id] }),
  cover: one(mediaAssets, { fields: [tournaments.coverMediaId], references: [mediaAssets.id] }),
}));
export const promotionsRelations = relations(promotions, ({ one }) => ({
  cover: one(mediaAssets, { fields: [promotions.coverMediaId], references: [mediaAssets.id] }),
  menuCategory: one(menuCategories, { fields: [promotions.targetMenuCategoryId], references: [menuCategories.id] }),
}));
export const galleriesRelations = relations(galleries, ({ many }) => ({ items: many(galleryItems) }));
export const galleryItemsRelations = relations(galleryItems, ({ one }) => ({
  gallery: one(galleries, { fields: [galleryItems.galleryId], references: [galleries.id] }),
  media: one(mediaAssets, { fields: [galleryItems.mediaId], references: [mediaAssets.id] }),
}));

export const hallsRelations = relations(halls, ({ many }) => ({ tariffs: many(rentalTariffs) }));
export const rentalTariffsRelations = relations(rentalTariffs, ({ one }) => ({ hall: one(halls, { fields: [rentalTariffs.hallId], references: [halls.id] }) }));

export const menuCategoriesRelations = relations(menuCategories, ({ one, many }) => ({
  parent: one(menuCategories, { fields: [menuCategories.parentId], references: [menuCategories.id], relationName: "category_tree" }),
  children: many(menuCategories, { relationName: "category_tree" }),
  items: many(menuItems),
  priceGroup: one(priceGroups, { fields: [menuCategories.priceGroupId], references: [priceGroups.id] }),
}));
export const priceGroupsRelations = relations(priceGroups, ({ many }) => ({ tiers: many(priceGroupTiers) }));
export const priceGroupTiersRelations = relations(priceGroupTiers, ({ one }) => ({ group: one(priceGroups, { fields: [priceGroupTiers.groupId], references: [priceGroups.id] }) }));
export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(menuCategories, { fields: [menuItems.categoryId], references: [menuCategories.id] }),
  priceGroup: one(priceGroups, { fields: [menuItems.priceGroupId], references: [priceGroups.id] }),
  image: one(mediaAssets, { fields: [menuItems.imageMediaId], references: [mediaAssets.id] }),
  variants: many(menuItemVariants),
}));
export const menuItemVariantsRelations = relations(menuItemVariants, ({ one }) => ({ item: one(menuItems, { fields: [menuItemVariants.itemId], references: [menuItems.id] }) }));
export const banquetSetsRelations = relations(banquetSets, ({ one, many }) => ({
  cover: one(mediaAssets, { fields: [banquetSets.coverMediaId], references: [mediaAssets.id] }),
  items: many(banquetSetItems),
}));
export const banquetSetItemsRelations = relations(banquetSetItems, ({ one }) => ({
  set: one(banquetSets, { fields: [banquetSetItems.setId], references: [banquetSets.id] }),
  variant: one(menuItemVariants, { fields: [banquetSetItems.menuItemVariantId], references: [menuItemVariants.id] }),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  promotion: one(promotions, { fields: [leads.promotionId], references: [promotions.id] }),
  tournament: one(tournaments, { fields: [leads.tournamentId], references: [tournaments.id] }),
  consentDocument: one(legalDocuments, { fields: [leads.consentDocumentId], references: [legalDocuments.id] }),
}));

export const authorsRelations = relations(authors, ({ one, many }) => ({
  photo: one(mediaAssets, { fields: [authors.photoMediaId], references: [mediaAssets.id] }),
  articles: many(articles),
}));
export const rubricsRelations = relations(rubrics, ({ many }) => ({ articles: many(articles) }));
export const blogTagsRelations = relations(blogTags, ({ many }) => ({ articleTags: many(articleTags) }));
export const articlesRelations = relations(articles, ({ one, many }) => ({
  author: one(authors, { fields: [articles.authorId], references: [authors.id] }),
  rubric: one(rubrics, { fields: [articles.rubricId], references: [rubrics.id] }),
  cover: one(mediaAssets, { fields: [articles.coverMediaId], references: [mediaAssets.id] }),
  tags: many(articleTags),
}));
export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  article: one(articles, { fields: [articleTags.articleId], references: [articles.id] }),
  tag: one(blogTags, { fields: [articleTags.tagId], references: [blogTags.id] }),
}));
```

`src/lib/schema/index.ts`:

```ts
export * from "./enums";
export * from "./auth";
export * from "./media";
export * from "./menu";
export * from "./club";
export * from "./pricing";
export * from "./leads";
export * from "./content";
export * from "./settings";
export * from "./relations";
```
(`_common.ts` не реэкспортировать — внутренний.)

### Environment Variables

- `POSTGRES_URL` — для `db:generate` не нужен, для `db:migrate` обязателен (`postgresql://dev_user:dev_password@localhost:5432/postgres_dev`). Берётся из `.env` (подхватывается в `drizzle.config.ts`).

## Acceptance Criteria

- [ ] Есть все файлы `src/lib/schema/*` из списка; `src/lib/schema.ts` удалён; `src/lib/db.ts` импортирует `./schema` и безопасен для `next build` без `POSTGRES_URL`
- [ ] `drizzle.config.ts` указывает на `./src/lib/schema/index.ts`
- [ ] Все 14 enum'ов совпадают с `contracts.md` по именам и значениям
- [ ] Все таблицы из таблицы контракта присутствуют; у не-Better-Auth таблиц PK `uuid ... defaultRandom()`; `code varchar(8)` unique у `menu_items`, `menu_item_variants`, `banquet_sets`, `price_group_tiers`
- [ ] `galleries.key` — `text NOT NULL UNIQUE` (не enum); `services.gallery_key` — `text`; `leads.ip_hash` — `char(64)` **nullable**
- [ ] `leads.number` — `integer GENERATED ALWAYS AS IDENTITY` с unique; смоделированная вставка в psql возвращает `number = 1`
- [ ] В `tournaments` есть индекс по `end_date`; в `rental_tariffs` и `promotions` — CHECK на окно минут (`0..1440`, `end > start`)
- [ ] Все FK на `media_assets` — `ON DELETE RESTRICT`; в таблице `user` есть `role`, `banned`, `ban_reason`, `ban_expires`, `two_factor_enabled`; в `session` — `impersonated_by`; есть таблицы `two_factor` и `rate_limit`
- [ ] Старые миграции удалены; в `drizzle/` ровно одна миграция `0000_init.sql` + `meta/`; миграция применена к чистой локальной БД командой `pnpm db:migrate` (**не `push`**)
- [ ] `drizzle-kit push` нигде не использовался и не добавлен в скрипты
- [ ] `pnpm lint`, `pnpm typecheck` проходят; `pnpm build:ci` проходит без БД

## Notes

- Схема не меняется после этой задачи. Если задача из следующих волн обнаружит нехватку колонки — она сообщает об этом, правка делается в этой задаче (новая миграция только по решению координатора).
- Поля, которых нет в `contracts.md`, добавлены по `PLAN.md` и описаны здесь: `services.{key,title,subtitle,bullets,priceFrom,priceFromHallKind,priceNote,ctaBlock,galleryKey}`, `galleries.{key (text unique),title}`, `galleryItems.variant` (мобильный hero), `legalDocuments.{title,body,sha256,publishedAt}`, `priceGroups/priceGroupTiers` (у уровня есть `code`), `menuCategories.{parentId,funFact*,priceGroupId}`.
- Правило «либо `priceGroupId`, либо ≥ 1 вариант у позиции меню» проверяется в zod и Server Action (задача 18), в БД не ограничивается.
- Таблицы `articleTags` и `blogTags`, `redirects.fromPath` (не `from` — зарезервированное слово).
- `siteSettings.value` и `auditLog.diff` — `jsonb`; типизация значений настроек — в `src/lib/settings-defaults.ts` (задача 12).
- Seed обязан создать хотя бы по одному документу `legal_documents` типов `policy` и `consent` (иначе `leads.consent_document_id` не заполнить) — это учтено в задаче 10/23.
- Better Auth Drizzle-адаптеру передаётся `schema` из `./schema`; ключи `user`, `session`, `account`, `verification`, `twoFactor`, `rateLimit` должны остаться именно такими.
