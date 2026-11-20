import Image from "next/image";
import { connection } from "next/server";
import { MoveHorizontal } from "lucide-react";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import { Container } from "@/components/site/container";
import { PrimaryButton } from "@/components/site/primary-button";
import { Reveal } from "@/components/site/reveal";
import { SectionTitle } from "@/components/site/section-title";
import { Skeleton } from "@/components/ui/skeleton";
import { getHalls, type PublicHall } from "@/lib/queries/pricing";
import { getSettings } from "@/lib/queries/settings";
import { cn } from "@/lib/utils";

const DARK_CARD_BG = "/images/home/work-steps-dark.webp";

/** Залы по умолчанию, если в БД нет активных */
const FALLBACK_HALLS = ["Русский", "Американский", "VIP"];

const EXTRA_SERVICES: { text: string; strong?: boolean }[] = [
  { text: "Проведение корпоративных и любительских турниров" },
  { text: "Обучение игре на бильярде" },
  { text: "Продажа бильярдного оборудования и аксессуаров", strong: true },
  { text: "Авторская кухня" },
  { text: "Бар" },
];

const CARD_CLASS =
  "relative isolate flex min-h-[500px] w-[86%] shrink-0 snap-center flex-col overflow-hidden rounded-[12px] p-[clamp(20px,2.1vw,40px)_clamp(20px,2.3vw,45px)] sm:w-[60%] lg:w-auto";
const STEP_BADGE_CLASS =
  "text-primary mb-[30px] inline-flex h-10 items-center self-start rounded-[12px] border border-[#EEEEEE] bg-white px-[19px] text-xl font-semibold";
const CARD_TITLE_CLASS = "mb-[19px] text-[clamp(22px,1.67vw,32px)] leading-[1.3] font-semibold";
const LIST_CLASS = "mt-[clamp(20px,4vw,77px)] list-disc space-y-0 pl-5 leading-[1.67]";

function StepBadge({ step }: { step: number }) {
  return <span className={STEP_BADGE_CLASS}>Шаг {step}</span>;
}

/** Тёмная карточка: фото-фон старого сайта поверх запасного градиента */
function DarkCard({ children }: { children: React.ReactNode }) {
  return (
    <li
      className={cn(
        CARD_CLASS,
        "bg-[radial-gradient(120%_120%_at_100%_0%,#2f6c4a_0%,#13442e_40%,#1a1a1a_100%)] text-white"
      )}
    >
      <Image
        src={DARK_CARD_BG}
        alt=""
        fill
        sizes="(min-width:1024px) 33vw, 86vw"
        className="-z-10 object-cover"
      />
      {children}
    </li>
  );
}

function hallLabel(hall: PublicHall) {
  return hall.kind === "common" ? (
    <>
      {hall.name} <span className="text-white/70">· {hall.tablesCount} столов</span>
    </>
  ) : (
    hall.name
  );
}

/** «Бронирование»: три карточки-шага (`#worksteps`) */
export async function BookingSteps() {
  await connection();
  const [halls, settings] = await Promise.all([getHalls(), getSettings()]);

  return (
    <section
      id="worksteps"
      className="scroll-mt-24 pt-[clamp(24px,2.9vw,55px)] pb-[clamp(32px,4vw,77px)]"
    >
      <Container>
        <Reveal>
          <SectionTitle as="h2" className="mb-[clamp(16px,2.6vw,50px)]">
            Бронирование
          </SectionTitle>
        </Reveal>

        <p className="text-muted-foreground mb-3 flex items-center gap-2 text-xs lg:hidden">
          <MoveHorizontal className="size-4" aria-hidden="true" />
          Листайте влево/вправо
        </p>
        <ol className="-mx-[7vw] flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-[7vw] md:-mx-[9.5vw] md:px-[9.5vw] lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-[clamp(16px,1.6vw,30px)] lg:overflow-visible lg:px-0">
          <li className={cn(CARD_CLASS, "text-foreground bg-white")}>
            <StepBadge step={1} />
            <h3 className={CARD_TITLE_CLASS}>Бронирование столов:</h3>
            <a
              href={settings.phoneHref}
              className="hover:text-primary self-start text-[19px] leading-[1.5] font-medium whitespace-nowrap underline decoration-1 underline-offset-4 transition-colors sm:text-[22px] lg:text-[clamp(22px,1.56vw,30px)]"
            >
              {settings.phone}
            </a>
            <p className="mt-4 grow text-[clamp(15px,0.94vw,18px)] leading-[1.45]">
              С учетом выбранных вами дат и времени, менеджер подберет свободный стол.
            </p>
            <LeadDialogTrigger
              kind="booking"
              block="Бронирование"
              formTitle="Бронирование стола"
              asChild
            >
              <PrimaryButton className="mt-6 h-[75px] w-full text-base font-semibold">
                Забронировать
              </PrimaryButton>
            </LeadDialogTrigger>
          </li>

          <DarkCard>
            <StepBadge step={2} />
            <h3 className={CARD_TITLE_CLASS}>Выберите стол:</h3>
            <ul className={cn(LIST_CLASS, "text-[clamp(17px,1.25vw,24px)]")}>
              {halls.length > 0
                ? halls.map((hall) => <li key={hall.id}>{hallLabel(hall)}</li>)
                : FALLBACK_HALLS.map((name) => <li key={name}>{name}</li>)}
            </ul>
          </DarkCard>

          <DarkCard>
            <StepBadge step={3} />
            <h3 className={CARD_TITLE_CLASS}>Дополнительно:</h3>
            <ul className={cn(LIST_CLASS, "text-[clamp(16px,1.15vw,22px)]")}>
              {EXTRA_SERVICES.map((item) => (
                <li key={item.text} className={cn(item.strong && "font-semibold")}>
                  {item.text}
                </li>
              ))}
            </ul>
          </DarkCard>
        </ol>
      </Container>
    </section>
  );
}

export function BookingStepsSkeleton() {
  return (
    <div className="pt-[clamp(24px,2.9vw,55px)] pb-[clamp(32px,4vw,77px)]">
      <Container>
        <Skeleton className="mb-[clamp(16px,2.6vw,50px)] h-[clamp(27px,4.2vw,81px)] w-64 max-w-full" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-[clamp(16px,1.6vw,30px)]">
          <Skeleton className="h-[500px] rounded-[12px]" />
          <Skeleton className="hidden h-[500px] rounded-[12px] lg:block" />
          <Skeleton className="hidden h-[500px] rounded-[12px] lg:block" />
        </div>
      </Container>
    </div>
  );
}
