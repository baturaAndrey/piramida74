"use server";

import { and, count, eq, inArray, max, ne } from "drizzle-orm";
import { ActionError, adminAction } from "@/lib/admin/action";
import { audit, type DbOrTx } from "@/lib/admin/audit";
import { TAGS } from "@/lib/cache-tags";
import { getToday } from "@/lib/dates";
import { extraServices, halls, penaltyItems, rentalTariffs } from "@/lib/schema";
import { slugify } from "@/lib/slug";
import { formatHole, formatOverlapsForCandidate, pluralRu } from "./_lib/labels";
import { findHoles, findOverlaps, type TariffLike } from "./_lib/tariff-analysis";
import {
  extraSchema,
  hallSchema,
  idSchema,
  penaltySchema,
  reorderPenaltiesSchema,
  reorderSchema,
  tariffSchema,
  toggleSchema,
} from "./_schema";

/** Все изменения раздела меняют прайс, страницу /prices и каталог калькулятора */
const PRICING_TAGS = { tags: [TAGS.pricing] };

/** Максимальная длина slug в схеме (`varchar(64)`) с запасом под суффикс «-NN» */
const SLUG_BASE_MAX = 58;
const SLUG_FALLBACK = "hall";
const NEW_TARIFF_ID = "__new__";
const COPY_SUFFIX = " (копия)";
const MAX_LABEL_LENGTH = 120;

/** Следующий sortOrder в конце списка */
async function nextSortOrder(
  tx: DbOrTx,
  table: typeof halls | typeof rentalTariffs | typeof extraServices | typeof penaltyItems
): Promise<number> {
  const [row] = await tx.select({ value: max(table.sortOrder) }).from(table);
  return (row?.value ?? -1) + 1;
}

/** Уникальный slug зала: `obshchiy-zal`, при занятости — `obshchiy-zal-2`, `-3`… */
async function uniqueHallSlug(tx: DbOrTx, name: string, excludeId?: string): Promise<string> {
  const base = (slugify(name) || SLUG_FALLBACK).slice(0, SLUG_BASE_MAX).replace(/-+$/, "");
  const rows = await tx
    .select({ slug: halls.slug })
    .from(halls)
    .where(excludeId ? ne(halls.id, excludeId) : undefined);
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

/* ───────────────────────── Залы ───────────────────────── */

export const saveHall = adminAction(
  hallSchema,
  async (input, ctx) => {
    const { id, ...values } = input;
    if (id) {
      const [before] = await ctx.tx.select().from(halls).where(eq(halls.id, id));
      if (!before) throw new ActionError("Зал не найден");
      // slug меняется только вместе с названием — иначе ссылки не «прыгают» при каждом сохранении
      const slug =
        before.name === values.name ? before.slug : await uniqueHallSlug(ctx.tx, values.name, id);
      await ctx.tx
        .update(halls)
        .set({ ...values, slug })
        .where(eq(halls.id, id));
      await audit(
        ctx.userId,
        "hall.update",
        "hall",
        id,
        { before, after: { ...values, slug } },
        ctx.tx
      );
      return { id };
    }

    const slug = await uniqueHallSlug(ctx.tx, values.name);
    const sortOrder = await nextSortOrder(ctx.tx, halls);
    const [created] = await ctx.tx
      .insert(halls)
      .values({ ...values, slug, sortOrder })
      .returning({ id: halls.id });
    if (!created) throw new ActionError("Не удалось создать зал");
    await audit(
      ctx.userId,
      "hall.create",
      "hall",
      created.id,
      { after: { ...values, slug } },
      ctx.tx
    );
    return { id: created.id };
  },
  PRICING_TAGS
);

export const deleteHall = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const [hall] = await ctx.tx.select().from(halls).where(eq(halls.id, id));
    if (!hall) throw new ActionError("Зал не найден");
    // FK тарифов — onDelete cascade: без этой проверки удаление зала молча стёрло бы его цены
    const [usage] = await ctx.tx
      .select({ n: count() })
      .from(rentalTariffs)
      .where(eq(rentalTariffs.hallId, id));
    const n = usage?.n ?? 0;
    if (n > 0) {
      throw new ActionError(
        `У зала ${n} ${pluralRu(n, ["тариф", "тарифа", "тарифов"])}. Удалите или перенесите их`
      );
    }
    await ctx.tx.delete(halls).where(eq(halls.id, id));
    await audit(ctx.userId, "hall.delete", "hall", id, { before: hall }, ctx.tx);
  },
  PRICING_TAGS
);

export const toggleHall = adminAction(
  toggleSchema,
  async ({ id, isActive }, ctx) => {
    const [row] = await ctx.tx
      .update(halls)
      .set({ isActive })
      .where(eq(halls.id, id))
      .returning({ id: halls.id });
    if (!row) throw new ActionError("Зал не найден");
    await audit(ctx.userId, "hall.toggle", "hall", id, { isActive }, ctx.tx);
  },
  PRICING_TAGS
);

export const reorderHalls = adminAction(
  reorderSchema,
  async ({ ids }, ctx) => {
    for (const [index, id] of ids.entries()) {
      await ctx.tx.update(halls).set({ sortOrder: index }).where(eq(halls.id, id));
    }
    await audit(ctx.userId, "hall.reorder", "hall", "*", { ids }, ctx.tx);
  },
  PRICING_TAGS
);

/* ───────────────────────── Тарифы ───────────────────────── */

/**
 * Блокирует строку зала до конца транзакции: параллельные сохранения тарифов одного зала
 * выполняются по очереди, и проверка пересечений не обходится гонкой.
 */
async function lockHall(tx: DbOrTx, hallId: string) {
  const [hall] = await tx
    .select({ id: halls.id, name: halls.name })
    .from(halls)
    .where(eq(halls.id, hallId))
    .for("update");
  if (!hall) throw new ActionError("Зал не найден", { hallId: ["Зал не найден"] });
  return hall;
}

/** Бросает ActionError, если активный кандидат пересекается с активными тарифами того же зала */
type LabeledTariff = TariffLike & { label: string };

function assertNoOverlaps(candidate: LabeledTariff, others: LabeledTariff[]) {
  if (!candidate.isActive || !candidate.id) return;
  const candidateId = candidate.id;
  const conflicts = findOverlaps([...others, candidate]).filter(
    (o) => o.a.id === candidateId || o.b.id === candidateId
  );
  if (conflicts.length > 0) {
    throw new ActionError(formatOverlapsForCandidate(conflicts, candidateId));
  }
}

/** Предупреждения о «дырах» зала после изменения — не блокируют сохранение */
async function hallHoleWarnings(tx: DbOrTx, hall: { id: string; name: string }) {
  const tariffs = await tx.select().from(rentalTariffs).where(eq(rentalTariffs.hallId, hall.id));
  return findHoles(tariffs, [hall.id], getToday()).map((h) => formatHole(h, hall.name));
}

/**
 * Блокирует несколько залов в фиксированном порядке (по id), чтобы два параллельных переноса
 * тарифов между одними и теми же залами не взяли блокировки встречно и не попали в deadlock.
 */
async function lockHalls(tx: DbOrTx, hallIds: string[]) {
  const ordered = [...new Set(hallIds)].sort();
  const locked: { id: string; name: string }[] = [];
  for (const hallId of ordered) locked.push(await lockHall(tx, hallId));
  return locked;
}

export type SaveTariffResult = { id: string; warnings: string[] };

export const saveTariff = adminAction(
  tariffSchema,
  async (input, ctx): Promise<SaveTariffResult> => {
    const { id: inputId, ...values } = input;

    // Исходный зал нужен до блокировок: при переносе тарифа меняются «дыры» обоих залов
    let previousHallId: string | undefined;
    if (inputId) {
      const [current] = await ctx.tx
        .select({ hallId: rentalTariffs.hallId })
        .from(rentalTariffs)
        .where(eq(rentalTariffs.id, inputId));
      if (!current) throw new ActionError("Тариф не найден");
      previousHallId = current.hallId;
    }
    const lockedHalls = await lockHalls(
      ctx.tx,
      previousHallId ? [input.hallId, previousHallId] : [input.hallId]
    );

    // 1) остальные тарифы того же зала (кроме сохраняемого)
    const others = await ctx.tx
      .select()
      .from(rentalTariffs)
      .where(
        and(
          eq(rentalTariffs.hallId, input.hallId),
          inputId ? ne(rentalTariffs.id, inputId) : undefined
        )
      );

    // 2) пересечения, затрагивающие кандидата: при конфликте ничего не записывается
    assertNoOverlaps({ ...values, id: inputId ?? NEW_TARIFF_ID }, others);

    // 3) запись
    let id: string;
    if (inputId) {
      const [before] = await ctx.tx
        .select()
        .from(rentalTariffs)
        .where(eq(rentalTariffs.id, inputId));
      if (!before) throw new ActionError("Тариф не найден");
      // Тариф перенесли параллельно, пока брались блокировки: старый зал не заблокирован
      if (before.hallId !== previousHallId) {
        throw new ActionError("Тариф изменён в другой вкладке. Обновите страницу");
      }
      await ctx.tx.update(rentalTariffs).set(values).where(eq(rentalTariffs.id, inputId));
      id = inputId;
      await audit(ctx.userId, "tariff.update", "tariff", id, { before, after: values }, ctx.tx);
    } else {
      const sortOrder = await nextSortOrder(ctx.tx, rentalTariffs);
      const [created] = await ctx.tx
        .insert(rentalTariffs)
        .values({ ...values, sortOrder })
        .returning({ id: rentalTariffs.id });
      if (!created) throw new ActionError("Не удалось создать тариф");
      id = created.id;
      await audit(ctx.userId, "tariff.create", "tariff", id, { after: values }, ctx.tx);
    }

    // 4) «дыры» — только предупреждение; при переносе — для обоих залов
    const warnings: string[] = [];
    const targetFirst = [...lockedHalls].sort(
      (a, b) => Number(b.id === input.hallId) - Number(a.id === input.hallId)
    );
    for (const hall of targetFirst) warnings.push(...(await hallHoleWarnings(ctx.tx, hall)));
    return { id, warnings };
  },
  PRICING_TAGS
);

export const deleteTariff = adminAction(
  idSchema,
  async ({ id }, ctx): Promise<SaveTariffResult> => {
    const [before] = await ctx.tx.select().from(rentalTariffs).where(eq(rentalTariffs.id, id));
    if (!before) throw new ActionError("Тариф не найден");
    const hall = await lockHall(ctx.tx, before.hallId);
    await ctx.tx.delete(rentalTariffs).where(eq(rentalTariffs.id, id));
    await audit(ctx.userId, "tariff.delete", "tariff", id, { before }, ctx.tx);
    return { id, warnings: await hallHoleWarnings(ctx.tx, hall) };
  },
  PRICING_TAGS
);

export const toggleTariff = adminAction(
  toggleSchema,
  async ({ id, isActive }, ctx): Promise<SaveTariffResult> => {
    const [tariff] = await ctx.tx.select().from(rentalTariffs).where(eq(rentalTariffs.id, id));
    if (!tariff) throw new ActionError("Тариф не найден");
    const hall = await lockHall(ctx.tx, tariff.hallId);
    if (isActive) {
      const others = await ctx.tx
        .select()
        .from(rentalTariffs)
        .where(and(eq(rentalTariffs.hallId, tariff.hallId), ne(rentalTariffs.id, id)));
      assertNoOverlaps({ ...tariff, isActive: true }, others);
    }
    await ctx.tx.update(rentalTariffs).set({ isActive }).where(eq(rentalTariffs.id, id));
    await audit(ctx.userId, "tariff.toggle", "tariff", id, { isActive }, ctx.tx);
    return { id, warnings: await hallHoleWarnings(ctx.tx, hall) };
  },
  PRICING_TAGS
);

/** Копия создаётся неактивной: активная копия всегда пересекалась бы с оригиналом */
export const duplicateTariff = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const [source] = await ctx.tx.select().from(rentalTariffs).where(eq(rentalTariffs.id, id));
    if (!source) throw new ActionError("Тариф не найден");
    const { id: _sourceId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;
    const label = `${source.label.slice(0, MAX_LABEL_LENGTH - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
    const [created] = await ctx.tx
      .insert(rentalTariffs)
      .values({
        ...rest,
        label,
        isActive: false,
        sortOrder: await nextSortOrder(ctx.tx, rentalTariffs),
      })
      .returning({ id: rentalTariffs.id });
    if (!created) throw new ActionError("Не удалось создать копию");
    await audit(
      ctx.userId,
      "tariff.duplicate",
      "tariff",
      created.id,
      { sourceId: id, after: { ...rest, label, isActive: false } },
      ctx.tx
    );
    return { id: created.id };
  },
  PRICING_TAGS
);

/* ───────────────────────── Доп. услуги ───────────────────────── */

export const saveExtra = adminAction(
  extraSchema,
  async (input, ctx) => {
    const { id, ...values } = input;
    if (id) {
      const [before] = await ctx.tx.select().from(extraServices).where(eq(extraServices.id, id));
      if (!before) throw new ActionError("Услуга не найдена");
      await ctx.tx.update(extraServices).set(values).where(eq(extraServices.id, id));
      await audit(
        ctx.userId,
        "extra_service.update",
        "extra_service",
        id,
        { before, after: values },
        ctx.tx
      );
      return { id };
    }
    const sortOrder = await nextSortOrder(ctx.tx, extraServices);
    const [created] = await ctx.tx
      .insert(extraServices)
      .values({ ...values, sortOrder })
      .returning({ id: extraServices.id });
    if (!created) throw new ActionError("Не удалось создать услугу");
    await audit(
      ctx.userId,
      "extra_service.create",
      "extra_service",
      created.id,
      { after: values },
      ctx.tx
    );
    return { id: created.id };
  },
  PRICING_TAGS
);

export const deleteExtra = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const [before] = await ctx.tx.delete(extraServices).where(eq(extraServices.id, id)).returning();
    if (!before) throw new ActionError("Услуга не найдена");
    await audit(ctx.userId, "extra_service.delete", "extra_service", id, { before }, ctx.tx);
  },
  PRICING_TAGS
);

export const toggleExtra = adminAction(
  toggleSchema,
  async ({ id, isActive }, ctx) => {
    const [row] = await ctx.tx
      .update(extraServices)
      .set({ isActive })
      .where(eq(extraServices.id, id))
      .returning({ id: extraServices.id });
    if (!row) throw new ActionError("Услуга не найдена");
    await audit(ctx.userId, "extra_service.toggle", "extra_service", id, { isActive }, ctx.tx);
  },
  PRICING_TAGS
);

export const reorderExtras = adminAction(
  reorderSchema,
  async ({ ids }, ctx) => {
    for (const [index, id] of ids.entries()) {
      await ctx.tx.update(extraServices).set({ sortOrder: index }).where(eq(extraServices.id, id));
    }
    await audit(ctx.userId, "extra_service.reorder", "extra_service", "*", { ids }, ctx.tx);
  },
  PRICING_TAGS
);

/* ───────────────────────── Штрафы ───────────────────────── */

export const savePenalty = adminAction(
  penaltySchema,
  async (input, ctx) => {
    const { id, ...values } = input;
    if (id) {
      const [before] = await ctx.tx.select().from(penaltyItems).where(eq(penaltyItems.id, id));
      if (!before) throw new ActionError("Позиция не найдена");
      await ctx.tx.update(penaltyItems).set(values).where(eq(penaltyItems.id, id));
      await audit(ctx.userId, "penalty.update", "penalty", id, { before, after: values }, ctx.tx);
      return { id };
    }
    // Новая позиция добавляется в начало списка своего вида (как черновая строка в UI)
    const siblings = await ctx.tx
      .select({ id: penaltyItems.id })
      .from(penaltyItems)
      .where(eq(penaltyItems.kind, values.kind))
      .orderBy(penaltyItems.sortOrder, penaltyItems.name);
    const [created] = await ctx.tx
      .insert(penaltyItems)
      .values({ ...values, sortOrder: 0 })
      .returning({ id: penaltyItems.id });
    if (!created) throw new ActionError("Не удалось добавить позицию");
    for (const [index, sibling] of siblings.entries()) {
      await ctx.tx
        .update(penaltyItems)
        .set({ sortOrder: index + 1 })
        .where(eq(penaltyItems.id, sibling.id));
    }
    await audit(ctx.userId, "penalty.create", "penalty", created.id, { after: values }, ctx.tx);
    return { id: created.id };
  },
  PRICING_TAGS
);

export const deletePenalty = adminAction(
  idSchema,
  async ({ id }, ctx) => {
    const [before] = await ctx.tx.delete(penaltyItems).where(eq(penaltyItems.id, id)).returning();
    if (!before) throw new ActionError("Позиция не найдена");
    await audit(ctx.userId, "penalty.delete", "penalty", id, { before }, ctx.tx);
  },
  PRICING_TAGS
);

/** Проставляет `sortOrder = index` только переданным id данного вида */
export const reorderPenalties = adminAction(
  reorderPenaltiesSchema,
  async ({ kind, ids }, ctx) => {
    if (ids.length > 0) {
      const rows = await ctx.tx
        .select({ id: penaltyItems.id })
        .from(penaltyItems)
        .where(and(eq(penaltyItems.kind, kind), inArray(penaltyItems.id, ids)));
      if (rows.length !== new Set(ids).size) {
        throw new ActionError("Список устарел. Обновите страницу");
      }
    }
    for (const [index, id] of ids.entries()) {
      await ctx.tx
        .update(penaltyItems)
        .set({ sortOrder: index })
        .where(and(eq(penaltyItems.id, id), eq(penaltyItems.kind, kind)));
    }
    await audit(ctx.userId, "penalty.reorder", "penalty", "*", { kind, ids }, ctx.tx);
  },
  PRICING_TAGS
);
