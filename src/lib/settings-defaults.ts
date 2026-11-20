/**
 * Типизированные настройки сайта (таблица `site_settings`: одна строка на ключ).
 * Канонический список ключей — `data/contracts.md`; seed (задача 10) и форма настроек (задача 19)
 * используют ровно эти имена. Модуль без серверных импортов — безопасен для клиентских компонентов.
 */

export type SiteSettings = {
  /** Текст для показа: "+7 (900) 068-50-00" */
  phone: string;
  /** Готовый href с префиксом `tel:` */
  phoneHref: string;
  email: string;
  address: string;
  addressNote: string;
  hours: string;
  telegramUrl: string;
  vkUrl: string;
  /** Значение `um=` конструктора Яндекс Карт, с префиксом "constructor:" */
  mapConstructorId: string;
  /** oid организации в Яндекс Картах */
  mapOrgId: string;
  geo: { lat: number; lon: number };
  heroTitle: string;
  heroSubtitle: string;
  heroBadgePhrases: string[];
  aboutTitle: string;
  aboutPoints: { title: string; text: string }[];
  seoDefaults: { title: string; description: string; ogImageMediaId: string | null };
  operator: { name: string; inn: string; ogrn: string; address: string; email: string };
  telegramIncludePii: boolean;
  leadRetentionMonths: number;
};

export const SETTINGS_DEFAULTS: SiteSettings = {
  phone: "+7 (900) 068-50-00",
  phoneHref: "tel:+79000685000",
  email: "biliyard174@yandex.ru",
  address: "г. Челябинск, Орджоникидзе 58а к3",
  addressNote: "Горсад им. А.С. Пушкина",
  hours: "Ежедневно 09:00–02:00",
  telegramUrl: "https://t.me/bkpiramida",
  vkUrl: "https://vk.ru/piramida.billiard",
  mapConstructorId: "constructor:9864a7dc77c89400f104990d2234df6daf899d2ffdbc50a6fd4ed2057ebe15e3",
  mapOrgId: "47911977113",
  geo: { lat: 55.153739, lon: 61.404441 },
  heroTitle: "Бильярдный клуб «Пирамида» в Челябинске — игра, уют и драйв до позднего вечера",
  heroSubtitle:
    "Профессиональные столы, VIP-комнаты для компаний, бар и регулярные турниры. Забронируйте стол онлайн — за 30 секунд.",
  heroBadgePhrases: [
    "Русский бильярд",
    "Американский бильярд",
    "VIP-комнаты",
    "Авторское меню",
    "Обучение бильярду",
    "Кубок Чемпионат Турниры",
  ],
  aboutTitle:
    "Пирамида — премиальный клуб бильярда в самом центре Челябинска. У нас вы получите комфортный драйв от игры и безупречный сервис.",
  aboutPoints: [
    { title: "Русская пирамида", text: "— игра мастеров, где каждый удар определяет судьбу" },
    { title: "Американский пул", text: "— быстро освоить, легко играть, невозможно забыть" },
    {
      title: "VIP зал",
      text: "— где каждая игра становится событием, каждый момент эксклюзивен",
    },
    {
      title: "Авторская кухня",
      text: "— гастрономическое искусство от шеф-повара клуба «Пирамида»",
    },
  ],
  seoDefaults: {
    title: "Бильярдный клуб «Пирамида» — забронировать бильярд в Челябинске",
    description:
      "Ищете уютное место для игры в бильярд в Челябинске? В бильярдной клуба «Пирамида» вас ждут профессиональные столы, турниры, авторская кухня, свежий разливной напиток и уютная атмосфера. Арендуйте вип-зал или забронируйте стол для идеального вечера!",
    ogImageMediaId: null,
  },
  operator: { name: "", inn: "", ogrn: "", address: "", email: "biliyard174@yandex.ru" },
  telegramIncludePii: false,
  leadRetentionMonths: 12,
};

export const SETTING_KEYS = Object.keys(SETTINGS_DEFAULTS) as (keyof SiteSettings)[];

const KNOWN_KEYS: ReadonlySet<string> = new Set(SETTING_KEYS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Структурная проверка значения по форме дефолта (без zod):
 * примитивы — по `typeof`, массивы — каждый элемент по первому элементу дефолта,
 * объекты — каждое поле дефолта. `null` в дефолте допускает `null` или строку
 * (единственный такой случай — `seoDefaults.ogImageMediaId: string | null`).
 */
function matchesShape(value: unknown, shape: unknown): boolean {
  if (shape === null) return value === null || typeof value === "string";
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) return false;
    // Пустой массив-образец не задаёт тип элемента — принимаем любой массив
    if (shape.length === 0) return true;
    return value.every((el) => matchesShape(el, shape[0]));
  }
  if (isPlainObject(shape)) {
    if (!isPlainObject(value)) return false;
    return Object.keys(shape).every((k) => matchesShape(value[k], shape[k]));
  }
  if (typeof shape === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === typeof shape;
}

/**
 * Строки `site_settings` → полный `SiteSettings`.
 * Известные ключи перекрывают дефолты; неизвестные игнорируются; значение неверной формы → дефолт.
 */
export function mergeSettings(rows: { key: string; value: unknown }[]): SiteSettings {
  const result: Record<string, unknown> = { ...SETTINGS_DEFAULTS };
  for (const { key, value } of rows) {
    if (!KNOWN_KEYS.has(key)) continue;
    if (matchesShape(value, SETTINGS_DEFAULTS[key as keyof SiteSettings])) {
      result[key] = value;
    }
  }
  return result as SiteSettings;
}
