import { connection } from "next/server";
import { Skeleton } from "@/components/ui/skeleton";
import { getServices, type PublicService } from "@/lib/queries/galleries";
import { getPriceFrom } from "@/lib/queries/pricing";
import { Container } from "../container";
import { Reveal } from "../reveal";
import { SectionTitle } from "../section-title";
import { ServicesTabsClient, type ServiceTab } from "./services-tabs-client";

const SECTION_CLASS = "scroll-mt-24 py-[clamp(32px,4vw,77px)]";
const TITLE = "Услуги бильярдной";

const CTA_LABELS: Record<PublicService["ctaType"], string> = {
  booking: "Забронировать",
  callback: "Оставить заявку",
};

/** «От 580₽/час» — без пробела перед ₽, как на старом сайте. */
function formatPriceFrom(price: number): string {
  return `От ${price.toLocaleString("ru-RU")}₽/час`;
}

/** Цена «от»: явная из услуги, иначе минимальный почасовой тариф залов указанного вида. */
async function resolvePrice(service: PublicService): Promise<string | null> {
  if (service.priceFrom != null) return formatPriceFrom(service.priceFrom);
  if (!service.priceFromHallKind) return null;
  const auto = await getPriceFrom(service.priceFromHallKind);
  return auto == null ? null : formatPriceFrom(auto);
}

async function toTab(service: PublicService): Promise<ServiceTab> {
  return {
    id: service.id,
    title: service.title,
    subtitle: service.subtitle,
    bullets: service.bullets,
    price: await resolvePrice(service),
    priceNote: service.priceNote,
    ctaKind: service.ctaType,
    ctaLabel: CTA_LABELS[service.ctaType],
    ctaBlock: service.ctaBlock || service.title,
    // Фото галереи `galleryKey` уже присоединены запросом `getServices()` (один запрос на все вкладки)
    images: service.gallery.map((item) => ({
      asset: item.media,
      alt: item.media.alt || item.caption || service.title,
    })),
  };
}

/** «Услуги бильярдной»: вкладки услуг с галереей, описанием, ценой «от» и кнопкой заявки. */
export async function ServicesTabs() {
  await connection();
  const services = await getServices();
  if (services.length === 0) return null;
  const tabs = await Promise.all(services.map(toTab));

  return (
    <section id="service" className={SECTION_CLASS}>
      <Container>
        <Reveal>
          <SectionTitle className="mb-[clamp(16px,2.6vw,50px)]">{TITLE}</SectionTitle>
        </Reveal>
        <ServicesTabsClient tabs={tabs} />
      </Container>
    </section>
  );
}

/** Заглушка: ряд вкладок + блок содержимого той же высоты. */
export function ServicesTabsSkeleton() {
  return (
    <section aria-hidden="true" className={SECTION_CLASS}>
      <Container>
        <SectionTitle className="mb-[clamp(16px,2.6vw,50px)]">{TITLE}</SectionTitle>
        <div className="mb-[clamp(20px,3.4vw,65px)] flex gap-2 overflow-hidden lg:gap-5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-[160px] shrink-0 rounded-[12px] lg:w-[300px]" />
          ))}
        </div>
        <Skeleton className="h-[280px] rounded-[12px] lg:h-[572px]" />
      </Container>
    </section>
  );
}
