/**
 * Два банкетных сета. Состав — по названиям позиций меню; цена считается в seed.ts
 * из цен первых вариантов позиций (не придумывается):
 * - fixed: сумма состава (1550 + 2200 = 3750);
 * - per_person: ceil(сумма / pricePerPersonDivisor / 10) * 10 (3500 / 6 → 590).
 * Сеты примерные — требуют проверки админом.
 */
import type { SeedBanquetSet } from "./types";

export const SEED_BANQUET_SETS: SeedBanquetSet[] = [
  {
    title: "Сет «Пивной и мясной»",
    description: "Пивной и мясной сеты на компанию из 4–6 гостей.",
    pricingMode: "fixed",
    minGuests: 4,
    maxGuests: 6,
    items: [
      { itemName: "Пивной сет", qty: 1 },
      { itemName: "Мясной сет", qty: 1 },
    ],
  },
  {
    title: "Фуршетный сет на 6 гостей",
    description: "Овощная и мясная нарезки, сырное ассорти и фруктовая тарелка для фуршета.",
    pricingMode: "per_person",
    minGuests: 6,
    maxGuests: 20,
    pricePerPersonDivisor: 6,
    items: [
      { itemName: "Овощная нарезка", qty: 1 },
      { itemName: "Сыры ассорти с мёдом и орешками", qty: 1 },
      { itemName: "Мясное ассорти", qty: 1 },
      { itemName: "Фруктовая тарелка", qty: 1 },
    ],
  },
];
