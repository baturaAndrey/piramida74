/**
 * Идемпотентный seed первичных данных: `pnpm seed`.
 *
 * Принцип «создать, если нет»: каждая сущность ищется по естественному ключу; найденная строка
 * не изменяется (повторный запуск не затирает правки админа), ненайденная — вставляется.
 * Ничего не удаляется. Одна транзакция на домен. Данные — в scripts/seed-data/*.ts.
 *
 * Коды (`code`) позиций меню, вариантов, сетов и уровней сеток генерируются только при вставке
 * и попадают в URL калькулятора — у существующих строк они никогда не меняются.
 */
import { createHash } from "node:crypto";
import { and, asc, count, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import { db, queryClient } from "../src/lib/db";
import {
  banquetSetItems,
  banquetSets,
  extraServices,
  galleries,
  halls,
  legalDocuments,
  menuCategories,
  menuItems,
  menuItemVariants,
  menuModifiers,
  penaltyItems,
  priceGroups,
  priceGroupTiers,
  promotions,
  rentalTariffs,
  services,
  siteSettings,
  tournamentSeries,
  tournaments,
} from "../src/lib/schema";
import { nanoCode, slugify } from "../src/lib/slug";
import { SEED_BANQUET_SETS } from "./seed-data/banquet-sets";
import { SEED_GALLERIES } from "./seed-data/galleries";
import {
  SEED_EXTRA_SERVICES,
  SEED_HALLS,
  SEED_PENALTIES,
  SEED_TARIFFS,
} from "./seed-data/halls-pricing";
import { ALLOWED_LEGAL_PLACEHOLDERS, SEED_LEGAL_DOCUMENTS } from "./seed-data/legal";
import { EXPECTED_MENU_ITEMS_COUNT, SEED_MENU, SEED_PRICE_GROUPS } from "./seed-data/menu";
import { SEED_PROMOTIONS } from "./seed-data/promotions";
import { SEED_SERVICES } from "./seed-data/services";
import { SEED_SETTINGS } from "./seed-data/settings";
import { SEED_TOURNAMENT_SERIES, SEED_TOURNAMENTS } from "./seed-data/tournaments";
import type { SeedCategory, SeedItem, SeedVariant } from "./seed-data/types";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const FUN_FACT_TITLE = "Интересный факт";
const EXPECTED_TOURNAMENTS = 30;
const EXPECTED_PENALTIES = 56;
const EXPECTED_SETTINGS_KEYS = 20;

// ── Счётчики «создано / уже было» ──────────────────────────────────────────

const stats = new Map<string, { created: number; existing: number }>();

function track(domain: string, created: boolean): void {
  const s = stats.get(domain) ?? { created: 0, existing: 0 };
  if (created) s.created++;
  else s.existing++;
  stats.set(domain, s);
}

/**
 * Ищет строку по естественному ключу; если не найдена — создаёт.
 * Возвращает найденную/созданную строку и флаг `created`.
 */
async function findOrCreate<T>(
  domain: string,
  find: () => Promise<T | undefined>,
  create: () => Promise<T>
): Promise<{ row: T; created: boolean }> {
  const found = await find();
  if (found !== undefined) {
    track(domain, false);
    return { row: found, created: false };
  }
  const row = await create();
  track(domain, true);
  return { row, created: true };
}

/** Первая строка результата или ошибка (для insert … returning) */
function first<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error("Insert returned no rows");
  return row;
}

// ── Уникальные коды ────────────────────────────────────────────────────────

/**
 * Все занятые коды по 4 таблицам. Коды проверяются глобально (не только в пределах таблицы),
 * чтобы составные коды калькулятора `${item.code}-${tier.code}` не путались с кодами вариантов.
 */
const usedCodes = new Set<string>();

async function loadUsedCodes(): Promise<void> {
  const tables = [menuItems, menuItemVariants, banquetSets, priceGroupTiers] as const;
  for (const table of tables) {
    const rows = await db.select({ code: table.code }).from(table);
    for (const r of rows) usedCodes.add(r.code);
  }
}

function freshCode(): string {
  // Коллизия nanoid(6) из 36 символов крайне маловероятна, но повторяем до свободного кода
  for (;;) {
    const code = nanoCode();
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
}

// ── Домены ─────────────────────────────────────────────────────────────────

async function seedSettings(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(SEED_SETTINGS)) {
      const inserted = await tx
        .insert(siteSettings)
        .values({ key, value })
        .onConflictDoNothing({ target: siteSettings.key })
        .returning({ key: siteSettings.key });
      track("settings", inserted.length > 0);
    }
  });
}

async function seedHallsAndPricing(): Promise<void> {
  await db.transaction(async (tx) => {
    const hallIdBySlug = new Map<string, string>();
    for (const [i, h] of SEED_HALLS.entries()) {
      const { row } = await findOrCreate(
        "halls",
        async () => (await tx.select().from(halls).where(eq(halls.slug, h.slug)))[0],
        async () =>
          first(
            await tx
              .insert(halls)
              .values({ ...h, sortOrder: i })
              .returning()
          )
      );
      hallIdBySlug.set(h.slug, row.id);
    }

    for (const [i, t] of SEED_TARIFFS.entries()) {
      const hallId = hallIdBySlug.get(t.hallSlug);
      if (!hallId) throw new Error(`Unknown hall slug in tariff: ${t.hallSlug}`);
      const { hallSlug: _hallSlug, ...tariff } = t;
      await findOrCreate(
        "tariffs",
        async () => {
          // Сравнение массива дней — в JS, чтобы не зависеть от порядка/типа smallint[] в SQL
          const candidates = await tx
            .select()
            .from(rentalTariffs)
            .where(
              and(
                eq(rentalTariffs.hallId, hallId),
                eq(rentalTariffs.label, t.label),
                eq(rentalTariffs.startMin, t.startMin),
                eq(rentalTariffs.endMin, t.endMin),
                eq(rentalTariffs.audience, t.audience)
              )
            );
          return candidates.find((c) => sameNumbers(c.daysOfWeek, t.daysOfWeek));
        },
        async () =>
          first(
            await tx
              .insert(rentalTariffs)
              .values({ ...tariff, hallId, sortOrder: i })
              .returning()
          )
      );
    }

    for (const [i, s] of SEED_EXTRA_SERVICES.entries()) {
      await findOrCreate(
        "extraServices",
        async () =>
          (await tx.select().from(extraServices).where(eq(extraServices.name, s.name)))[0],
        async () =>
          first(
            await tx
              .insert(extraServices)
              .values({ ...s, sortOrder: i })
              .returning()
          )
      );
    }

    // sortOrder — порядок внутри своего вида штрафа (как в таблицах источника)
    const orderByKind = new Map<string, number>();
    for (const pen of SEED_PENALTIES) {
      const sortOrder = orderByKind.get(pen.kind) ?? 0;
      orderByKind.set(pen.kind, sortOrder + 1);
      await findOrCreate(
        "penalties",
        async () =>
          (
            await tx
              .select()
              .from(penaltyItems)
              .where(and(eq(penaltyItems.kind, pen.kind), eq(penaltyItems.name, pen.name)))
          )[0],
        async () =>
          first(
            await tx
              .insert(penaltyItems)
              .values({ ...pen, priceIsMinimum: pen.priceIsMinimum ?? false, sortOrder })
              .returning()
          )
      );
    }
  });
}

function sameNumbers(a: number[], b: number[]): boolean {
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

async function seedTournaments(): Promise<void> {
  await db.transaction(async (tx) => {
    const seriesIdBySlug = new Map<string, string>();
    for (const [i, s] of SEED_TOURNAMENT_SERIES.entries()) {
      const { row } = await findOrCreate(
        "tournamentSeries",
        async () =>
          (await tx.select().from(tournamentSeries).where(eq(tournamentSeries.slug, s.slug)))[0],
        async () =>
          first(
            await tx
              .insert(tournamentSeries)
              .values({ ...s, sortOrder: i })
              .returning()
          )
      );
      seriesIdBySlug.set(s.slug, row.id);
    }

    for (const t of SEED_TOURNAMENTS) {
      const slug = `${slugify(t.title)}-${t.startDate}`;
      const seriesId = t.series ? seriesIdBySlug.get(t.series.slug) : undefined;
      if (t.series && !seriesId) throw new Error(`Unknown series slug: ${t.series.slug}`);
      await findOrCreate(
        "tournaments",
        async () => (await tx.select().from(tournaments).where(eq(tournaments.slug, slug)))[0],
        async () =>
          first(
            await tx
              .insert(tournaments)
              .values({
                title: t.title,
                slug,
                seriesId: seriesId ?? null,
                stageNumber: t.series?.stage ?? null,
                discipline: t.discipline,
                level: t.level,
                categories: t.categories,
                startDate: t.startDate,
                endDate: t.endDate,
                entryFee: null,
                prizeFund: null,
                description: null,
                coverMediaId: null,
                registrationOpen: false,
                isPublished: true,
              })
              .returning()
          )
      );
    }
  });
}

// ── Меню ───────────────────────────────────────────────────────────────────

async function seedMenu(): Promise<void> {
  await db.transaction(async (tx) => {
    const groupIdByKey = await seedPriceGroups(tx);
    for (const [i, cat] of SEED_MENU.entries()) {
      await seedCategory(tx, cat, null, i, groupIdByKey);
    }
  });
}

async function seedPriceGroups(tx: Tx): Promise<Map<string, string>> {
  const groupIdByKey = new Map<string, string>();
  for (const [i, pg] of SEED_PRICE_GROUPS.entries()) {
    const { row } = await findOrCreate(
      "priceGroups",
      async () => (await tx.select().from(priceGroups).where(eq(priceGroups.name, pg.name)))[0],
      async () =>
        first(await tx.insert(priceGroups).values({ name: pg.name, sortOrder: i }).returning())
    );
    groupIdByKey.set(pg.key, row.id);

    for (const [j, tier] of pg.tiers.entries()) {
      await findOrCreate(
        "priceGroupTiers",
        async () =>
          (
            await tx
              .select()
              .from(priceGroupTiers)
              .where(
                and(eq(priceGroupTiers.groupId, row.id), eq(priceGroupTiers.label, tier.label))
              )
          )[0],
        async () =>
          first(
            await tx
              .insert(priceGroupTiers)
              .values({ ...tier, groupId: row.id, code: freshCode(), sortOrder: j })
              .returning()
          )
      );
    }
  }
  return groupIdByKey;
}

async function seedCategory(
  tx: Tx,
  cat: SeedCategory,
  parentId: string | null,
  sortOrder: number,
  groupIdByKey: Map<string, string>
): Promise<void> {
  const priceGroupId = cat.priceGroup ? groupIdByKey.get(cat.priceGroup) : undefined;
  if (cat.priceGroup && !priceGroupId) throw new Error(`Unknown price group: ${cat.priceGroup}`);

  const { row } = await findOrCreate(
    "menuCategories",
    async () =>
      (await tx.select().from(menuCategories).where(eq(menuCategories.slug, cat.slug)))[0],
    async () =>
      first(
        await tx
          .insert(menuCategories)
          .values({
            parentId,
            title: cat.title,
            slug: cat.slug,
            funFactTitle: cat.funFact ? FUN_FACT_TITLE : null,
            funFactText: cat.funFact ?? null,
            priceGroupId: priceGroupId ?? null,
            sortOrder,
          })
          .returning()
      )
  );

  for (const [i, item] of cat.items.entries()) {
    await seedMenuItem(tx, item, row.id, i, cat);
  }

  for (const [i, mod] of (cat.modifiers ?? []).entries()) {
    await findOrCreate(
      "menuModifiers",
      async () =>
        (await tx.select().from(menuModifiers).where(eq(menuModifiers.name, mod.name)))[0],
      async () =>
        first(
          await tx
            .insert(menuModifiers)
            .values({ ...mod, categoryId: row.id, sortOrder: i })
            .returning()
        )
    );
  }

  for (const [i, child] of (cat.children ?? []).entries()) {
    await seedCategory(tx, child, row.id, i, groupIdByKey);
  }
}

/** Варианты позиции: явный список или короткая форма одной цены; у позиций сетки — пусто */
function itemVariants(item: SeedItem, cat: SeedCategory): SeedVariant[] {
  if (item.variants) return item.variants;
  if (item.price === undefined) {
    if (!cat.priceGroup) {
      throw new Error(`Menu item "${item.name}" has neither price nor price group`);
    }
    return [];
  }
  const v: SeedVariant = { price: item.price };
  if (item.amount !== undefined) v.amount = item.amount;
  if (item.unit !== undefined) v.unit = item.unit;
  return [v];
}

async function seedMenuItem(
  tx: Tx,
  item: SeedItem,
  categoryId: string,
  sortOrder: number,
  cat: SeedCategory
): Promise<void> {
  const variants = itemVariants(item, cat);
  if (cat.priceGroup && variants.length > 0) {
    throw new Error(`Item "${item.name}" in price-group category must not have own variants`);
  }

  const { row } = await findOrCreate(
    "menuItems",
    async () =>
      (
        await tx
          .select()
          .from(menuItems)
          .where(and(eq(menuItems.categoryId, categoryId), eq(menuItems.name, item.name)))
      )[0],
    async () =>
      first(
        await tx
          .insert(menuItems)
          .values({
            code: freshCode(),
            categoryId,
            name: item.name,
            description: item.description ?? null,
            choiceNote: item.choiceNote ?? null,
            originCountry: item.originCountry ?? null,
            isTakeawayDiscount: item.takeawayDiscount ?? cat.takeawayDiscount,
            sortOrder,
          })
          .returning()
      )
  );

  for (const [i, v] of variants.entries()) {
    await findOrCreate(
      "menuItemVariants",
      async () =>
        (
          await tx
            .select()
            .from(menuItemVariants)
            .where(and(eq(menuItemVariants.itemId, row.id), eq(menuItemVariants.sortOrder, i)))
        )[0],
      async () =>
        first(
          await tx
            .insert(menuItemVariants)
            .values({
              code: freshCode(),
              itemId: row.id,
              label: v.label ?? null,
              amount: v.amount ?? null,
              unit: v.unit ?? null,
              price: v.price,
              sortOrder: i,
            })
            .returning()
        )
    );
  }
}

// ── Акции ──────────────────────────────────────────────────────────────────

async function seedPromotions(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const promo of SEED_PROMOTIONS) {
      let targetMenuCategoryId: string | null = null;
      if (promo.targetMenuCategorySlug) {
        const [cat] = await tx
          .select({ id: menuCategories.id })
          .from(menuCategories)
          .where(eq(menuCategories.slug, promo.targetMenuCategorySlug));
        if (!cat) throw new Error(`Menu category not found: ${promo.targetMenuCategorySlug}`);
        targetMenuCategoryId = cat.id;
      }
      const { targetMenuCategorySlug: _slug, ...values } = promo;
      await findOrCreate(
        "promotions",
        async () => (await tx.select().from(promotions).where(eq(promotions.slug, promo.slug)))[0],
        async () =>
          first(
            await tx
              .insert(promotions)
              .values({ ...values, targetMenuCategoryId, coverMediaId: null })
              .returning()
          )
      );
    }
  });
}

// ── Банкетные сеты ─────────────────────────────────────────────────────────

/** Первый (по sortOrder) вариант позиции меню с уникальным названием */
async function findFirstVariantByItemName(
  tx: Tx,
  itemName: string
): Promise<{ id: string; price: number }> {
  const items = await tx
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(eq(menuItems.name, itemName));
  if (items.length !== 1) {
    throw new Error(`Expected exactly one menu item named "${itemName}", found ${items.length}`);
  }
  const [variant] = await tx
    .select({ id: menuItemVariants.id, price: menuItemVariants.price })
    .from(menuItemVariants)
    .where(eq(menuItemVariants.itemId, items[0]!.id))
    .orderBy(asc(menuItemVariants.sortOrder))
    .limit(1);
  if (!variant) throw new Error(`Menu item "${itemName}" has no variants`);
  return variant;
}

/** Округление цены на человека вверх до десятков рублей */
const ROUND_TO = 10;

async function seedBanquetSets(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [i, set] of SEED_BANQUET_SETS.entries()) {
      const existing = (
        await tx.select().from(banquetSets).where(eq(banquetSets.title, set.title))
      )[0];
      if (existing) {
        track("banquetSets", false);
        continue;
      }

      const resolved = [];
      for (const it of set.items) {
        resolved.push({ ...it, variant: await findFirstVariantByItemName(tx, it.itemName) });
      }
      const total = resolved.reduce((sum, r) => sum + r.variant.price * r.qty, 0);
      const price =
        set.pricingMode === "per_person"
          ? Math.ceil(total / (set.pricePerPersonDivisor ?? 1) / ROUND_TO) * ROUND_TO
          : total;

      const created = first(
        await tx
          .insert(banquetSets)
          .values({
            code: freshCode(),
            title: set.title,
            description: set.description,
            pricingMode: set.pricingMode,
            price,
            minGuests: set.minGuests,
            maxGuests: set.maxGuests,
            coverMediaId: null,
            sortOrder: i,
          })
          .returning()
      );
      track("banquetSets", true);

      await tx.insert(banquetSetItems).values(
        resolved.map((r, j) => ({
          setId: created.id,
          menuItemVariantId: r.variant.id,
          qty: r.qty,
          sortOrder: j,
        }))
      );
    }
  });
}

// ── Услуги, галереи, юр. документы ─────────────────────────────────────────

async function seedServicesAndGalleries(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [i, s] of SEED_SERVICES.entries()) {
      await findOrCreate(
        "services",
        async () => (await tx.select().from(services).where(eq(services.key, s.key)))[0],
        async () =>
          first(
            await tx
              .insert(services)
              .values({ ...s, sortOrder: i })
              .returning()
          )
      );
    }
    for (const g of SEED_GALLERIES) {
      await findOrCreate(
        "galleries",
        async () => (await tx.select().from(galleries).where(eq(galleries.key, g.key)))[0],
        async () => first(await tx.insert(galleries).values(g).returning())
      );
    }
  });
}

const PLACEHOLDER_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

function assertLegalPlaceholders(body: string, type: string): void {
  const allowed = new Set<string>(ALLOWED_LEGAL_PLACEHOLDERS);
  for (const m of body.matchAll(PLACEHOLDER_RE)) {
    if (!allowed.has(m[1]!)) throw new Error(`Unknown placeholder {{${m[1]}}} in legal ${type}`);
  }
}

async function seedLegal(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const doc of SEED_LEGAL_DOCUMENTS) {
      assertLegalPlaceholders(doc.body, doc.type);
      await findOrCreate(
        "legalDocuments",
        async () =>
          (
            await tx
              .select()
              .from(legalDocuments)
              .where(
                and(eq(legalDocuments.type, doc.type), eq(legalDocuments.version, doc.version))
              )
          )[0],
        async () =>
          first(
            await tx
              .insert(legalDocuments)
              .values({
                ...doc,
                sha256: createHash("sha256").update(doc.body, "utf8").digest("hex"),
                publishedAt: new Date(),
              })
              .returning()
          )
      );
    }
  });
}

// ── Сверка ─────────────────────────────────────────────────────────────────

async function countRows(
  table: Parameters<ReturnType<typeof db.select>["from"]>[0]
): Promise<number> {
  const [r] = await db.select({ n: count() }).from(table);
  return r?.n ?? 0;
}

async function verify(): Promise<boolean> {
  let ok = true;
  /**
   * strict = нарушение структурного правила меню (ошибка). Иначе расхождение счётчика — только
   * предупреждение: на staging админ мог добавить/удалить строки после первого seed.
   */
  const check = (label: string, actual: number, expected: number, strict = false) => {
    const pass = actual === expected;
    if (!pass && strict) ok = false;
    const mark = pass ? "OK  " : strict ? "FAIL" : "WARN";
    console.log(`  ${mark} ${label}: ${actual} (ожидалось ${expected})`);
  };

  check("турниры", await countRows(tournaments), EXPECTED_TOURNAMENTS);
  const dishware = await db
    .select({ n: count() })
    .from(penaltyItems)
    .where(eq(penaltyItems.kind, "dishware"));
  const property = await db
    .select({ n: count() })
    .from(penaltyItems)
    .where(eq(penaltyItems.kind, "property"));
  const d = dishware[0]?.n ?? 0;
  const p = property[0]?.n ?? 0;
  check(`штрафы (${d} + ${p})`, d + p, EXPECTED_PENALTIES);
  check("ключи site_settings", await countRows(siteSettings), EXPECTED_SETTINGS_KEYS);
  check("позиции меню", await countRows(menuItems), EXPECTED_MENU_ITEMS_COUNT);

  // Позиции без собственных вариантов и без сетки (ни у позиции, ни у категории) — нарушение правила
  const groupCats = db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(sql`${menuCategories.priceGroupId} is not null`);
  const orphans = await db
    .select({ name: menuItems.name })
    .from(menuItems)
    .where(
      and(
        isNull(menuItems.priceGroupId),
        sql`${menuItems.categoryId} not in (${groupCats})`,
        notExists(
          db
            .select({ one: sql`1` })
            .from(menuItemVariants)
            .where(eq(menuItemVariants.itemId, menuItems.id))
        )
      )
    );
  check("позиции без варианта и без сетки цен", orphans.length, 0, true);
  if (orphans.length > 0) console.log(`       ${orphans.map((o) => o.name).join(", ")}`);

  const groupCatIds = (await groupCats).map((c) => c.id);
  if (groupCatIds.length > 0) {
    const [withVariants] = await db
      .select({ n: count() })
      .from(menuItemVariants)
      .innerJoin(menuItems, eq(menuItems.id, menuItemVariants.itemId))
      .where(inArray(menuItems.categoryId, groupCatIds));
    check("варианты у позиций категорий с сеткой", withVariants?.n ?? 0, 0, true);
  }
  return ok;
}

// ── main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("[seed] start");
  await loadUsedCodes();

  // Порядок важен: акции ссылаются на категорию меню, сеты — на варианты позиций
  await seedSettings();
  await seedHallsAndPricing();
  await seedTournaments();
  await seedMenu();
  await seedPromotions();
  await seedBanquetSets();
  await seedServicesAndGalleries();
  await seedLegal();

  console.log("[seed] создано / уже было:");
  for (const [domain, s] of stats) {
    console.log(`  ${domain.padEnd(18)} ${String(s.created).padStart(4)} / ${s.existing}`);
  }

  console.log("[seed] сверка:");
  const ok = await verify();
  if (!ok) {
    console.warn("[seed] сверка выявила расхождения (см. FAIL выше)");
    process.exitCode = 1;
  }
  console.log("[seed] done");
}

main()
  .catch((err: unknown) => {
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end();
  });
