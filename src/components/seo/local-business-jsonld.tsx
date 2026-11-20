import { connection } from "next/server";
import { getPriceFrom } from "@/lib/queries/pricing";
import { getSettings } from "@/lib/queries/settings";
import { jsonLdScript, localBusinessJsonLd } from "@/lib/seo/jsonld";
import { settingsToLocalBusinessInput } from "@/lib/seo/local-business";
import { getSiteUrl } from "@/lib/seo/metadata";

/**
 * JSON-LD клуба (`SportsActivityLocation`) из настроек сайта + `priceRange` от минимального тарифа.
 * Рендерить внутри `<Suspense fallback={null}>`. Сам делает `connection()`, поэтому безопасен
 * для `next build` без БД.
 */
export async function LocalBusinessJsonLd() {
  await connection();
  const [settings, priceFrom] = await Promise.all([getSettings(), getPriceFrom("common")]);
  const input = settingsToLocalBusinessInput(settings, getSiteUrl());
  const data = localBusinessJsonLd({
    ...input,
    ...(priceFrom ? { priceRange: `от ${priceFrom} ₽/час` } : {}),
  });
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
  );
}
