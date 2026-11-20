import type { LocalBusinessInput } from "@/lib/seo/jsonld";
import type { SiteSettings } from "@/lib/settings-defaults";

const BUSINESS_NAME = "Бильярдный клуб «Пирамида»";
const DEFAULT_CITY = "Челябинск";
const REGION = "Челябинская область";
const DEFAULT_HOURS = { opens: "09:00", closes: "02:00" } as const;

/**
 * "Ежедневно 09:00–02:00" → { opens: "09:00", closes: "02:00" }; разделитель – — или -.
 * Не распознано → 09:00–02:00 (фактический режим клуба).
 */
export function parseHours(hours: string): { opens: string; closes: string } {
  const m = hours.match(/(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/);
  const pad = (t: string) => t.padStart(5, "0");
  const [, opens, closes] = m ?? [];
  return opens && closes ? { opens: pad(opens), closes: pad(closes) } : { ...DEFAULT_HOURS };
}

/** "г. Челябинск, Орджоникидзе 58а к3" → { city: "Челябинск", street: "Орджоникидзе 58а к3" } */
function splitAddress(address: string): { city: string; street: string } {
  const [first = "", ...rest] = address.split(",");
  if (!rest.length) return { city: DEFAULT_CITY, street: address.trim() };
  return { city: first.replace(/^г\.\s*/, "").trim(), street: rest.join(",").trim() };
}

/** Маппинг настроек сайта во вход `localBusinessJsonLd`. `siteUrl` — без завершающего слэша. */
export function settingsToLocalBusinessInput(s: SiteSettings, siteUrl: string): LocalBusinessInput {
  const telephone = s.phoneHref.replace(/^tel:/, "") || s.phone;
  return {
    name: BUSINESS_NAME,
    url: siteUrl,
    logo: `${siteUrl}/images/logo.png`,
    telephone,
    ...(s.email ? { email: s.email } : {}),
    address: { ...splitAddress(s.address), region: REGION },
    geo: { lat: s.geo.lat, lon: s.geo.lon },
    hours: parseHours(s.hours),
    sameAs: [s.vkUrl, s.telegramUrl].filter(Boolean),
  };
}
