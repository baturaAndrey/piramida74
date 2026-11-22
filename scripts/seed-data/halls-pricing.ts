/**
 * Залы, тарифы аренды, доп. услуги и штрафы.
 *
 * Цены аренды — из секции `#price` старого сайта (legacy-notes, раздел 6), а не из JPG.
 * Время тарифов — минуты от 09:00 операционных суток: 09:00–16:00 = 0–420,
 * 16:00–02:00 = 420–1020, 02:00–09:00 = 1020–1440, 09:00–12:00 = 0–180.
 * Штрафы — раздел 5 res-transcription.md, названия и порядок как в источнике.
 */
import type { SeedExtraService, SeedHall, SeedPenalty, SeedTariff } from "./types";

/** Число столов (12) и мест на стол (4) — временные данные, клуб подтвердит */
export const SEED_HALLS: SeedHall[] = [
  { name: "Общий зал", slug: "obshchiy-zal", kind: "common", tablesCount: 12, seatsPerTable: 4 },
  { name: "VIP 1", slug: "vip-1", kind: "vip", tablesCount: 1, seatsPerTable: 4 },
  { name: "VIP 2", slug: "vip-2", kind: "vip", tablesCount: 1, seatsPerTable: 4 },
  { name: "VIP 3", slug: "vip-3", kind: "vip", tablesCount: 1, seatsPerTable: 4 },
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const SUN_THU = [0, 1, 2, 3, 4];
const FRI_SAT = [5, 6];

const COMMON_HALL_TARIFFS: SeedTariff[] = [
  {
    hallSlug: "obshchiy-zal",
    daysOfWeek: SUN_THU,
    startMin: 0,
    endMin: 420,
    price: 580,
    priceUnit: "per_hour",
    audience: "all",
    label: "Вс–Чт, день (09:00–16:00)",
  },
  {
    hallSlug: "obshchiy-zal",
    daysOfWeek: SUN_THU,
    startMin: 420,
    endMin: 1020,
    price: 640,
    priceUnit: "per_hour",
    audience: "all",
    label: "Вс–Чт, вечер (16:00–02:00)",
  },
  {
    hallSlug: "obshchiy-zal",
    daysOfWeek: FRI_SAT,
    startMin: 0,
    endMin: 420,
    price: 680,
    priceUnit: "per_hour",
    audience: "all",
    label: "Пт–Сб, день (09:00–16:00)",
  },
  {
    hallSlug: "obshchiy-zal",
    daysOfWeek: FRI_SAT,
    startMin: 420,
    endMin: 1020,
    price: 760,
    priceUnit: "per_hour",
    audience: "all",
    label: "Пт–Сб, вечер (16:00–02:00)",
  },
  {
    // Ночной тариф почасовой — допущение из requirements (клуб подтвердит)
    hallSlug: "obshchiy-zal",
    daysOfWeek: ALL_DAYS,
    startMin: 1020,
    endMin: 1440,
    price: 3500,
    priceUnit: "per_hour",
    audience: "all",
    label: "Ночь (02:00–09:00)",
  },
  {
    hallSlug: "obshchiy-zal",
    daysOfWeek: ALL_DAYS,
    startMin: 0,
    endMin: 180,
    price: 200,
    priceUnit: "per_hour",
    audience: "pensioner",
    label: "Пенсионерам (09:00–12:00)",
  },
];

/** Каждой VIP-комнате — по 2 тарифа */
const VIP_TARIFFS: SeedTariff[] = ["vip-1", "vip-2", "vip-3"].flatMap((hallSlug) => [
  {
    hallSlug,
    daysOfWeek: ALL_DAYS,
    startMin: 0,
    endMin: 1020,
    price: 1400,
    priceUnit: "per_hour" as const,
    audience: "all" as const,
    label: "VIP, день и вечер (09:00–02:00)",
  },
  {
    hallSlug,
    daysOfWeek: ALL_DAYS,
    startMin: 1020,
    endMin: 1440,
    price: 4800,
    priceUnit: "per_hour" as const,
    audience: "all" as const,
    label: "VIP, ночь (02:00–09:00)",
  },
]);

export const SEED_TARIFFS: SeedTariff[] = [...COMMON_HALL_TARIFFS, ...VIP_TARIFFS];

export const SEED_EXTRA_SERVICES: SeedExtraService[] = [
  // Единица в источнике не указана — per_session допущение
  { name: "Нарды / шахматы", price: 250, priceUnit: "per_session" },
  // На сайте «250 руб/час» (на JPG 300 — берём цену сайта)
  { name: "Прокат кия ручной работы", price: 250, priceUnit: "per_hour" },
];

const dishware = (name: string, price: number): SeedPenalty => ({ kind: "dishware", name, price });
const property = (name: string, price: number, priceIsMinimum = false): SeedPenalty =>
  priceIsMinimum
    ? { kind: "property", name, price, priceIsMinimum }
    : { kind: "property", name, price };

/** «ПРАЙС БОЯ ПОСУДЫ» — 33 позиции */
const DISHWARE_PENALTIES: SeedPenalty[] = [
  dishware("Чайник стеклянный", 1750),
  dishware("Нож, ложка, вилка", 550),
  dishware("Рокс", 500),
  dishware("Хайбол", 500),
  dishware("Стопка", 400),
  dishware("Чашка капучино", 500),
  dishware("Блюдце капучино", 300),
  dishware("Графин под водку 300 мл", 950),
  dishware("Графин под водку 500 мл", 1150),
  dishware("Чайник фарфор", 850),
  dishware("Мерник", 1550),
  dishware("Айриш", 550),
  dishware("Коньячница", 600),
  dishware("Чашка эспрессо", 450),
  dishware("Блюдце эспрессо", 250),
  dishware("Кружка пивная 0,5", 600),
  dishware("Кружка пивная 0,33", 450),
  dishware("Креманка", 500),
  dishware("Шот", 350),
  dishware("Графин 1 л", 850),
  dishware("Харикейн", 600),
  dishware("Бокал под вино", 600),
  dishware("Бокал под мартини", 550),
  dishware("Флюте", 550),
  dishware("Тарелка десертная", 500),
  dishware("Тарелка сервировочная малая", 450),
  dishware("Тарелка сервировочная большая", 550),
  dishware("Фуршетное блюдо", 1100),
  dishware("Тарелка сервировочная под сыр", 1100),
  dishware("Тарелка сервировочная под рыбу", 500),
  dishware("Супница", 500),
  dishware("Тарелка паста / пельмени", 1500),
  dishware("Доска сервировочная разносолы / сэт", 1500),
];

/** «ПРАЙС ПОРЧИ ИМУЩЕСТВА» — 23 позиции; «от …» только у шаров */
const PROPERTY_PENALTIES: SeedPenalty[] = [
  property("Сукно (русский бильярд)", 45000),
  property("Сукно (пул)", 35000),
  property("Кий русский", 20000),
  property("Кий для пула", 15000),
  property("Тёща", 5000),
  property("Треугольник", 3000),
  property("Лампа", 3000),
  property("Решётка на лампу", 1500),
  property("Шары русский", 5000, true),
  property("Шары пул", 4000, true),
  property("Луза", 10000),
  property("Кресло", 35000),
  property("Витрина", 15000),
  property("Киевница", 35000),
  property("Шаровница", 25000),
  property("Телевизор", 50000),
  property("Саун-бар", 20000),
  property("Стерео система вертикальная", 80000),
  property("Sony PS5", 100000),
  property("Джойстик PS5", 12000),
  property("Столик журнальный", 35000),
  property("Зеркало тренировочное", 20000),
  property("Таймер", 5000),
];

export const SEED_PENALTIES: SeedPenalty[] = [...DISHWARE_PENALTIES, ...PROPERTY_PENALTIES];
