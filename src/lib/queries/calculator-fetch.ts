// Без 'use cache', `next/*` и `server-only`: модуль используется и некэшированным серверным пересчётом
// заявки, и импортируется из Vitest.
import { and, asc, eq } from "drizzle-orm";
import { buildMenuVariants } from "@/lib/calculator/catalog-mapper";
import type { CalcExtraService, CalculatorCatalog } from "@/lib/calculator/types";
import type { Db } from "@/lib/db";
import {
  banquetSets,
  extraServices,
  halls,
  menuCategories,
  menuItems,
  menuItemVariants,
  priceGroupTiers,
  promotions,
  rentalTariffs,
} from "@/lib/schema";

/**
 * ЕДИНСТВЕННЫЙ источник каталога калькулятора: активные залы, тарифы активных залов, доп. услуги,
 * позиции меню, сеты и акции. Превью на клиенте (`getCalculatorCatalog`) и серверный пересчёт
 * заявки (`loadCatalogForQuote`) обязаны видеть одинаковые данные в одинаковом порядке — иначе
 * сумма в форме и в заявке может разойтись. Поэтому сортировка везде с детерминированным
 * tie-breaker'ом по `id`/`code`.
 * Без фильтра по дате — дата визита учитывается позже в `calculateQuote`.
 */
export async function fetchCalculatorCatalog(database: Db): Promise<CalculatorCatalog> {
  const [
    hallRows,
    tariffRows,
    extraRows,
    setRows,
    promotionRows,
    categories,
    items,
    variants,
    tiers,
  ] = await Promise.all([
    database
      .select({
        id: halls.id,
        slug: halls.slug,
        name: halls.name,
        kind: halls.kind,
        tablesCount: halls.tablesCount,
        seatsPerTable: halls.seatsPerTable,
      })
      .from(halls)
      .where(eq(halls.isActive, true))
      .orderBy(asc(halls.sortOrder), asc(halls.name), asc(halls.id)),
    database
      .select({
        id: rentalTariffs.id,
        hallId: rentalTariffs.hallId,
        daysOfWeek: rentalTariffs.daysOfWeek,
        startMin: rentalTariffs.startMin,
        endMin: rentalTariffs.endMin,
        price: rentalTariffs.price,
        priceUnit: rentalTariffs.priceUnit,
        audience: rentalTariffs.audience,
        label: rentalTariffs.label,
        validFrom: rentalTariffs.validFrom,
        validTo: rentalTariffs.validTo,
      })
      .from(rentalTariffs)
      // Тарифы неактивного зала не должны участвовать в расчёте
      .innerJoin(halls, eq(rentalTariffs.hallId, halls.id))
      .where(and(eq(rentalTariffs.isActive, true), eq(halls.isActive, true)))
      .orderBy(asc(rentalTariffs.sortOrder), asc(rentalTariffs.startMin), asc(rentalTariffs.id)),
    database
      .select({
        id: extraServices.id,
        name: extraServices.name,
        price: extraServices.price,
        priceUnit: extraServices.priceUnit,
      })
      .from(extraServices)
      .where(eq(extraServices.isActive, true))
      .orderBy(asc(extraServices.sortOrder), asc(extraServices.name), asc(extraServices.id)),
    database
      .select({
        code: banquetSets.code,
        title: banquetSets.title,
        pricingMode: banquetSets.pricingMode,
        price: banquetSets.price,
        minGuests: banquetSets.minGuests,
        maxGuests: banquetSets.maxGuests,
      })
      .from(banquetSets)
      .where(eq(banquetSets.isActive, true))
      .orderBy(asc(banquetSets.sortOrder), asc(banquetSets.title), asc(banquetSets.code)),
    database
      .select({
        id: promotions.id,
        title: promotions.title,
        discountPercent: promotions.discountPercent,
        daysOfWeek: promotions.daysOfWeek,
        startMin: promotions.startMin,
        endMin: promotions.endMin,
        validFrom: promotions.validFrom,
        validTo: promotions.validTo,
      })
      .from(promotions)
      .where(eq(promotions.isActive, true))
      .orderBy(asc(promotions.sortOrder), asc(promotions.title), asc(promotions.id)),
    // buildMenuVariants сортирует стабильно только по sortOrder — равные значения упорядочиваем здесь
    database
      .select({
        id: menuCategories.id,
        slug: menuCategories.slug,
        title: menuCategories.title,
        priceGroupId: menuCategories.priceGroupId,
        sortOrder: menuCategories.sortOrder,
      })
      .from(menuCategories)
      .where(eq(menuCategories.isActive, true))
      .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.id)),
    database
      .select({
        id: menuItems.id,
        code: menuItems.code,
        name: menuItems.name,
        categoryId: menuItems.categoryId,
        priceGroupId: menuItems.priceGroupId,
        sortOrder: menuItems.sortOrder,
      })
      .from(menuItems)
      .where(eq(menuItems.isActive, true))
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.code)),
    database
      .select({
        code: menuItemVariants.code,
        itemId: menuItemVariants.itemId,
        label: menuItemVariants.label,
        price: menuItemVariants.price,
        sortOrder: menuItemVariants.sortOrder,
      })
      .from(menuItemVariants)
      .where(eq(menuItemVariants.isActive, true))
      .orderBy(asc(menuItemVariants.sortOrder), asc(menuItemVariants.code)),
    database
      .select({
        code: priceGroupTiers.code,
        groupId: priceGroupTiers.groupId,
        label: priceGroupTiers.label,
        price: priceGroupTiers.price,
        sortOrder: priceGroupTiers.sortOrder,
      })
      .from(priceGroupTiers)
      .orderBy(asc(priceGroupTiers.sortOrder), asc(priceGroupTiers.code)),
  ]);

  return {
    halls: hallRows,
    tariffs: tariffRows,
    // В схеме enum общий (`price_unit`), но `fixed` для доп. услуг запрещён zod-валидацией админки;
    // на случай ручной правки БД такую строку трактуем как разовую оплату
    extraServices: extraRows.map(
      (e): CalcExtraService => ({
        ...e,
        priceUnit: e.priceUnit === "per_hour" ? "per_hour" : "per_session",
      })
    ),
    menuVariants: buildMenuVariants({ categories, items, variants, tiers }),
    sets: setRows,
    promotions: promotionRows,
  };
}
