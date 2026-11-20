import { connection } from "next/server";
import { Skeleton } from "@/components/ui/skeleton";
import { getOpDate } from "@/lib/dates";
import { getCarouselPromotions } from "@/lib/queries/promotions";
import { Container } from "../container";
import { Reveal } from "../reveal";
import { SectionTitle } from "../section-title";
import { PromotionsCarouselClient, type PromotionSlide } from "./promotions-carousel-client";

const SECTION_CLASS = "scroll-mt-24 pt-[clamp(24px,2.6vw,50px)] pb-[clamp(32px,5vw,96px)]";
const TITLE = "Специальные предложения";

/** «Специальные предложения»: карусель акций с `showInCarousel`, действующих на операционную дату. */
export async function PromotionsCarousel() {
  await connection();
  const opDate = getOpDate();
  const promotions = await getCarouselPromotions(opDate);
  if (promotions.length === 0) return null;

  // В клиент уходят только поля карточки
  const items: PromotionSlide[] = promotions.map((p) => ({
    id: p.id,
    title: p.title,
    shortText: p.shortText,
    cover: p.cover,
  }));

  return (
    <section id="discount" className={SECTION_CLASS}>
      <Container>
        <Reveal>
          <SectionTitle className="mb-[clamp(16px,2.6vw,50px)] text-center lg:text-left">
            {TITLE}
          </SectionTitle>
        </Reveal>
        <PromotionsCarouselClient items={items} />
      </Container>
    </section>
  );
}

/** Заглушка: заголовок + две карточки (одна на мобильном). */
export function PromotionsCarouselSkeleton() {
  return (
    <section aria-hidden="true" className={SECTION_CLASS}>
      <Container>
        <SectionTitle className="mb-[clamp(16px,2.6vw,50px)] text-center lg:text-left">
          {TITLE}
        </SectionTitle>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Skeleton className="h-[300px] rounded-[12px] lg:h-[350px]" />
          <Skeleton className="hidden h-[350px] rounded-[12px] lg:block" />
        </div>
      </Container>
    </section>
  );
}
