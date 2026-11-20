/**
 * Значения site_settings: ровно 20 ключей = тип SiteSettings из contracts.md
 * (канонически типизирует задача 12 в src/lib/settings-defaults.ts).
 * Каждый ключ — отдельная строка (key = имя поля, value = jsonb).
 * Яндекс Метрика здесь не хранится (только env NEXT_PUBLIC_YM_ID); секретов старого сайта нет.
 */
import type { SiteSettings } from "../../src/lib/settings-defaults";

const CLUB_EMAIL = "biliyard174@yandex.ru";

export const SEED_SETTINGS: SiteSettings = {
  phone: "+7 (900) 068-50-00",
  phoneHref: "tel:+79000685000",
  email: CLUB_EMAIL,
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
    { title: "VIP зал", text: "— где каждая игра становится событием, каждый момент эксклюзивен" },
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
  // Реквизиты оператора ПДн даст клуб (action-required)
  operator: { name: "", inn: "", ogrn: "", address: "", email: CLUB_EMAIL },
  telegramIncludePii: false,
  leadRetentionMonths: 12,
};
