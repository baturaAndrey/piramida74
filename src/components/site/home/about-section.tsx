import { connection } from "next/server";
import { MoveHorizontal } from "lucide-react";
import { Picture } from "@/components/media/picture";
import { Reveal } from "@/components/site/reveal";
import { SectionTitle } from "@/components/site/section-title";
import { Skeleton } from "@/components/ui/skeleton";
import { getGallery } from "@/lib/queries/galleries";
import { getSettings } from "@/lib/queries/settings";
import { cn } from "@/lib/utils";

type AboutPoint = { title: string; text: string };

const FALLBACK_TITLE =
  "Пирамида — премиальный клуб бильярда в самом центре Челябинска. У нас вы получите комфортный драйв от игры и безупречный сервис.";

/** Пункты старого сайта — на случай пустых настроек */
const FALLBACK_POINTS: AboutPoint[] = [
  { title: "Русская пирамида", text: "игра мастеров, где каждый удар определяет судьбу" },
  { title: "Американский пул", text: "быстро освоить, легко играть, невозможно забыть" },
  { title: "VIP ЗАЛ", text: "где каждая игра становится событием, каждый момент эксклюзивен" },
  {
    title: "Авторская кухня",
    text: "гастрономическое искусство от шеф-повара клуба «Пирамида»",
  },
];

/** Высота секции: ≈560px на 320, ≈1500px на 1920 (фото на всю высоту) */
const SECTION_HEIGHT = "min-h-[clamp(560px,78vw,1500px)]";

function pointNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

/** Круг с номером пункта и пульсирующим кольцом позади */
function PointNumber({ index }: { index: number }) {
  return (
    <span
      aria-hidden="true"
      className="bg-primary before:bg-primary relative isolate mb-5 flex size-10 items-center justify-center rounded-full text-base font-medium text-white before:absolute before:inset-0 before:-z-10 before:animate-ping before:rounded-full before:[animation-duration:2s]"
    >
      {pointNumber(index)}
    </span>
  );
}

/** «О клубе»: фото на всю секцию, заголовок сверху, 4 пункта внизу (`#clientsc`) */
export async function AboutSection() {
  await connection();
  const [settings, gallery] = await Promise.all([getSettings(), getGallery("about")]);

  const title = settings.aboutTitle.trim() || FALLBACK_TITLE;
  const points = settings.aboutPoints.length > 0 ? settings.aboutPoints : FALLBACK_POINTS;
  const background = gallery?.items[0]?.media ?? null;

  return (
    <section
      id="clientsc"
      className={cn(
        "bg-footer container-frame relative scroll-mt-24 overflow-hidden rounded-[12px]",
        SECTION_HEIGHT
      )}
    >
      {background ? (
        <Picture
          asset={background}
          sizes="(min-width:1920px) 1882px, 100vw"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-bottom"
        />
      ) : null}

      {/* Градиенты: светлый сверху (тёмный заголовок), тёмный снизу (белые пункты) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[35%] bg-gradient-to-b from-white/70 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 via-black/20 to-transparent md:h-[45%]" />
      </div>

      <div className="px-gutter-framed">
        <Reveal>
          <SectionTitle
            as="h2"
            className="relative z-10 max-w-[1167px] px-2.5 pt-[clamp(24px,4vw,77px)] text-center text-[#1C1C1C] md:px-0 md:text-left"
          >
            {title}
          </SectionTitle>
        </Reveal>
      </div>

      {/* Десктоп: 4 колонки внизу, текст «выезжает» при hover/focus */}
      <div className="absolute inset-x-0 bottom-0 z-10 hidden text-white md:block">
        <ul className="px-gutter-framed flex">
          {points.map((point, index) => (
            <li
              key={`${point.title}-${index}`}
              tabIndex={0}
              className={cn(
                "group max-w-1/4 flex-1 translate-y-1/4 px-[clamp(20px,2.6vw,50px)] pb-[clamp(24px,3.1vw,60px)] transition-[transform,opacity] duration-300 hover:translate-y-0 focus-visible:translate-y-0 focus-visible:outline-white [@media(hover:none)]:translate-y-0",
                "focus-within:translate-y-0",
                index > 0 && "border-l border-white/25"
              )}
            >
              <PointNumber index={index} />
              <h3 className="text-[clamp(18px,1.25vw,24px)] leading-[1.42] font-semibold">
                {point.title}
              </h3>
              <p className="pt-[15px] text-[clamp(14px,1.04vw,20px)] leading-[1.35] font-light opacity-0 transition-opacity duration-300 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                {point.text}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Мобильный: горизонтальная scroll-snap лента, текст виден всегда */}
      <div className="absolute inset-x-0 bottom-0 z-10 pb-6 text-white md:hidden">
        <div className="px-gutter-framed">
          <p className="mb-3 flex items-center gap-2 text-xs">
            <MoveHorizontal className="size-4" aria-hidden="true" />
            Листайте влево/вправо
          </p>
          <ul className="bleed-gutter flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto">
            {points.map((point, index) => (
              <li key={`${point.title}-${index}`} className="w-[78%] shrink-0 snap-center">
                <PointNumber index={index} />
                <h3 className="text-base leading-snug font-semibold">{point.title}</h3>
                <p className="pt-2 text-[13px] leading-[1.35] font-light">{point.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function AboutSectionSkeleton() {
  return (
    <div className="container-frame">
      <Skeleton className={cn("w-full rounded-[12px]", SECTION_HEIGHT)} />
    </div>
  );
}
