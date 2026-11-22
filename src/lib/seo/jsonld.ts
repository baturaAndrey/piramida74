/**
 * JSON-LD object builders for the billiard club site.
 *
 * Pure functions only — each returns a plain serializable object shaped per
 * schema.org. They perform NO rendering; pages serialize the result with
 * {@link jsonLdScript} into a `<script type="application/ld+json">` tag.
 *
 * Builders accept their own simple input types (no schema/settings imports);
 * the calling code maps DB/settings data into them. Prices in this project are
 * integer rubles: `price: String(rub)`, `priceCurrency: "RUB"`.
 */

const SCHEMA_CONTEXT = "https://schema.org" as const;
const CURRENCY = "RUB" as const;

// ── Safe serialization for `<script type="application/ld+json">` ────────────

/**
 * Serialize a JSON-LD object for safe injection into a `<script>` element.
 *
 * `JSON.stringify` alone is NOT safe to drop into raw HTML: admin-authored
 * fields (titles, descriptions) can contain a literal `</script>` or the
 * line/paragraph separators U+2028 / U+2029, which break out of the script
 * context (stored-XSS / page breakage). We escape `<`, `>`, `&` and those
 * separators so the payload can never terminate the script or be misparsed,
 * while remaining valid JSON that crawlers read normally.
 *
 * Use this at EVERY `dangerouslySetInnerHTML` JSON-LD site.
 */
export function jsonLdScript(obj: unknown): string {
  // U+2028 / U+2029 are matched via RegExp constructors with `\u` escapes so the
  // source file stays ASCII (no raw separators, which would be a parse risk too).
  const lineSeparator = new RegExp("\\u2028", "g");
  const paragraphSeparator = new RegExp("\\u2029", "g");
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(lineSeparator, "\\u2028")
    .replace(paragraphSeparator, "\\u2029");
}

/** `@context` is emitted only for top-level entities, not for nested ones. */
function contextOf(withContext: boolean) {
  return withContext ? { "@context": SCHEMA_CONTEXT } : {};
}

// ── BreadcrumbList ──────────────────────────────────────────────────────────

export interface BreadcrumbItemInput {
  label: string;
  href?: string;
}

export interface BreadcrumbListJsonLd {
  "@context": typeof SCHEMA_CONTEXT;
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item?: string;
  }>;
}

export function breadcrumbJsonLd(items: BreadcrumbItemInput[]): BreadcrumbListJsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href !== undefined ? { item: item.href } : {}),
    })),
  };
}

// ── Organization ──────────────────────────────────────────────────────────

export interface OrganizationInput {
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
  telephone?: string;
}

export function organizationJsonLd(o: OrganizationInput, withContext = true) {
  return {
    ...contextOf(withContext),
    "@type": "Organization" as const,
    name: o.name,
    url: o.url,
    ...(o.logo ? { logo: { "@type": "ImageObject" as const, url: o.logo } } : {}),
    ...(o.telephone ? { telephone: o.telephone } : {}),
    ...(o.sameAs?.length ? { sameAs: o.sameAs } : {}),
  };
}

// ── Person ────────────────────────────────────────────────────────────────

export interface PersonInput {
  name: string;
  url?: string;
  image?: string;
  jobTitle?: string;
  description?: string;
  /** Social/profile URLs that disambiguate the person (E-E-A-T). */
  sameAs?: string[];
}

export function personJsonLd(p: PersonInput, withContext = true) {
  return {
    ...contextOf(withContext),
    "@type": "Person" as const,
    name: p.name,
    ...(p.url ? { url: p.url } : {}),
    ...(p.image ? { image: p.image } : {}),
    ...(p.jobTitle ? { jobTitle: p.jobTitle } : {}),
    ...(p.description ? { description: p.description } : {}),
    ...(p.sameAs?.length ? { sameAs: p.sameAs } : {}),
  };
}

// ── LocalBusiness (SportsActivityLocation) ─────────────────────────────────

export interface LocalBusinessInput {
  name: string;
  url: string;
  logo?: string;
  image?: string | string[];
  description?: string;
  /** "+7-900-068-50-00" */
  telephone: string;
  email?: string;
  /** "₽₽" */
  priceRange?: string;
  address: { street: string; city: string; region?: string; postalCode?: string };
  /** 55.153739, 61.404441 */
  geo: { lat: number; lon: number };
  /** Часы работы, например { opens: "09:00", closes: "02:00" } — ежедневно */
  hours: { opens: string; closes: string };
  /** VK, Telegram */
  sameAs?: string[];
}

const ALL_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

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
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [...ALL_WEEK],
        opens: s.hours.opens,
        closes: s.hours.closes,
      },
    ],
    ...(s.sameAs?.length ? { sameAs: s.sameAs } : {}),
  };
}

// ── SportsEvent (tournaments) ───────────────────────────────────────────────

export interface SportsEventInput {
  name: string;
  url: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  description?: string;
  image?: string | string[];
  /** «Свободная пирамида» */
  sport?: string;
  /** Взнос, целые ₽ */
  entryFee?: number | null;
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
      address: {
        "@type": "PostalAddress",
        streetAddress: t.location.street,
        addressLocality: t.location.city,
        addressCountry: "RU",
      },
    },
    ...(t.organizer
      ? {
          organizer: {
            "@type": "Organization",
            name: t.organizer.name,
            ...(t.organizer.url ? { url: t.organizer.url } : {}),
          },
        }
      : {}),
    // Free tournaments (no fee / 0) get no Offer at all.
    ...(t.entryFee && t.entryFee > 0
      ? {
          offers: {
            "@type": "Offer",
            price: String(t.entryFee),
            priceCurrency: CURRENCY,
            availability: "https://schema.org/InStock",
            url: t.url,
          },
        }
      : {}),
  };
}

// ── Article (blog) ──────────────────────────────────────────────────────────

export interface ArticleJsonLdInput {
  headline: string;
  url: string;
  description?: string;
  image?: string | string[];
  /** ISO */
  datePublished?: string;
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

// ── Menu (bar / kitchen) ────────────────────────────────────────────────────

export interface MenuItemInput {
  name: string;
  description?: string;
  /** Целые ₽ */
  price?: number;
}

export interface MenuJsonLdInput {
  name: string;
  url: string;
  sections: { name: string; items: MenuItemInput[] }[];
}

export function menuJsonLd(input: MenuJsonLdInput) {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Menu",
    name: input.name,
    url: input.url,
    hasMenuSection: input.sections.map((section) => ({
      "@type": "MenuSection",
      name: section.name,
      hasMenuItem: section.items.map((item) => ({
        "@type": "MenuItem",
        name: item.name,
        ...(item.description ? { description: item.description } : {}),
        // Items without a price omit `offers` entirely.
        ...(item.price !== undefined
          ? { offers: { "@type": "Offer", price: String(item.price), priceCurrency: CURRENCY } }
          : {}),
      })),
    })),
  };
}
