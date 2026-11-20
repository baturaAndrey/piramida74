import Image from "next/image";
import { connection } from "next/server";
import { LeadForm } from "@/components/leads/lead-form";
import { Picture } from "@/components/media/picture";
import { Container } from "@/components/site/container";
import { Reveal } from "@/components/site/reveal";
import { SectionTitle } from "@/components/site/section-title";
import { Skeleton } from "@/components/ui/skeleton";
import { getGallery } from "@/lib/queries/galleries";
import type { PublicMedia } from "@/lib/queries/types";

/** Запасные фото на случай пустой галереи `cta` */
const STATIC_BG = "/images/home/cta-bg.webp";
const STATIC_PERSON = "/images/home/cta-person.webp";

/**
 * Поля LeadForm крупнее стандартных (как в старом сайте); внутренности компонента не меняем —
 * размер задаётся через селекторы потомков обёртки.
 */
const FORM_CLASS =
  "[&_input:not([type=checkbox]):not([tabindex='-1'])]:h-[clamp(48px,5.2vw,100px)] [&_input]:rounded-[12px] [&_input]:font-sans [&_button[type=submit]]:h-[clamp(52px,4.7vw,90px)] [&_button[type=submit]]:w-full [&_button[type=submit]]:rounded-[12px] lg:[&_button[type=submit]]:text-2xl lg:[&_button[type=submit]]:font-semibold";

/** Фото человека: из галереи (`items[1]`) или статика */
function PersonImage({ media }: { media: PublicMedia | null }) {
  if (media) {
    return (
      <Picture
        asset={media}
        sizes="511px"
        alt=""
        className="absolute inset-0 size-full object-contain object-bottom"
      />
    );
  }
  return (
    <Image src={STATIC_PERSON} alt="" fill sizes="511px" className="object-contain object-bottom" />
  );
}

/** «Хотите забронировать стол?»: фон, фото человека и форма заявки (`#getconsultation`) */
export async function CtaFormSection() {
  await connection();
  const gallery = await getGallery("cta");

  const items = gallery?.items ?? [];
  const background = items[0]?.media ?? null;
  const person = items[1]?.media ?? null;

  return (
    <section
      id="getconsultation"
      className="bg-primary-dark relative mx-2 mb-[clamp(24px,2.7vw,52px)] scroll-mt-24 overflow-hidden rounded-[12px] text-white md:mx-[1vw]"
    >
      {background ? (
        <Picture
          asset={background}
          sizes="100vw"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <Image
          src={STATIC_BG}
          alt=""
          fill
          sizes="100vw"
          placeholder="empty"
          className="object-cover"
        />
      )}

      {/* Мобильный: фото внизу, обрезано нижним краем секции */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-[362px] w-[323px] -translate-x-1/2 translate-y-[75px] lg:hidden"
      >
        <PersonImage media={person} />
      </div>

      <Container className="relative flex flex-col items-center pt-[clamp(20px,5vw,96px)] pb-[310px] text-center lg:min-h-[clamp(0px,36.5vw,700px)] lg:flex-row lg:items-stretch lg:justify-between lg:py-[clamp(20px,5vw,96px)] lg:text-left">
        <div className="lg:w-[579px] lg:shrink-0">
          <Reveal>
            <p className="mb-[19px] text-[clamp(16px,1.25vw,24px)] leading-[1.17] font-medium">
              Хотите забронировать стол?
            </p>
            <SectionTitle as="h2" className="text-white">
              Оставьте данные, мы свяжемся с Вами и предложим варианты, которые подойдут именно Вам
            </SectionTitle>
          </Reveal>
        </div>

        {/* Десктоп: фото между текстом и формой */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-[clamp(340px,29.8vw,572px)] hidden aspect-[511/700] w-[clamp(300px,26.6vw,511px)] lg:block"
        >
          <PersonImage media={person} />
        </div>

        <div className="relative z-10 mt-6 w-full max-w-[400px] text-left lg:mt-0 lg:w-[400px] lg:self-center">
          <div className="text-foreground rounded-[12px] bg-white/95 p-4 lg:p-5">
            <h3 className="mb-[15px] text-[clamp(20px,1.67vw,32px)] leading-[1.56] font-semibold">
              Заполните форму
            </h3>
            <LeadForm
              type="booking"
              block="Бильярдная забронировать стол"
              formTitle="Хотите забронировать стол"
              submitLabel="Оставить заявку"
              className={FORM_CLASS}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

export function CtaFormSectionSkeleton() {
  return (
    <div className="mx-2 mb-[clamp(24px,2.7vw,52px)] md:mx-[1vw]">
      <Skeleton className="h-[clamp(560px,36vw,700px)] w-full rounded-[12px]" />
    </div>
  );
}
