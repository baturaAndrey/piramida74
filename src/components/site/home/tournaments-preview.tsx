import Link from "next/link";
import { connection } from "next/server";
import { Trophy } from "lucide-react";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import { Picture } from "@/components/media/picture";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEventDate, getOpDate } from "@/lib/dates";
import { getUpcomingTournaments, type PublicTournament } from "@/lib/queries/tournaments";
import { PrimaryButton } from "../primary-button";
import { Reveal } from "../reveal";

const SECTION_CLASS = "scroll-mt-24 py-[clamp(24px,4vw,77px)]";
/**
 * Общая сетка сайта (рамка 1920 + поле --gutter). С `lg` — две колонки, как `.reasons` старого
 * сайта: sticky-блок слева (35.7vw, ≤686px) и список турниров на всю оставшуюся ширину.
 */
const INNER_CLASS =
  "container-site lg:grid lg:grid-cols-[minmax(0,min(35.7vw,686px))_minmax(0,1fr)] lg:items-start lg:gap-x-[clamp(32px,4vw,77px)]";
const ASIDE_CLASS = "text-center lg:sticky lg:top-[88px] lg:text-left";
const LIST_CLASS = "mt-6 lg:mt-0";
const UPCOMING_LIMIT = 5;

/** Высота строки/обложки: на мобильном — от ширины экрана, с `lg` — 15.625vw (300px при 1920) */
const MEDIA_HEIGHT = "h-[clamp(160px,45vw,340px)] lg:h-[clamp(200px,15.625vw,300px)]";
/** Колонка даты с `lg`: фиксированная ширина — обложки всех строк начинаются с одной вертикали */
const DATE_COLUMN = "lg:w-[clamp(120px,10vw,190px)]";

/** «Календарный план»: до 5 ближайших турниров и sticky-блок с кнопкой заявки. */
export async function TournamentsPreview() {
  await connection();
  const opDate = getOpDate();
  const tournaments = await getUpcomingTournaments(opDate, UPCOMING_LIMIT);
  const year = opDate.slice(0, 4);

  return (
    <section id="reasons" className={SECTION_CLASS}>
      <div className={INNER_CLASS}>
        <div className={ASIDE_CLASS}>
          <Reveal>
            <h2 className="mb-[clamp(6px,1.3vw,25px)] text-[clamp(20px,2.865vw,55px)] leading-[1.45] font-semibold">
              Календарный план
            </h2>
          </Reveal>
          <p className="text-muted-foreground mx-auto mb-[clamp(13px,2.6vw,50px)] max-w-[518px] text-[clamp(16px,1.25vw,24px)] leading-[1.4] font-medium lg:mx-0">
            Спортивных соревнований и турниров по бильярдному спорту в {year} году
          </p>
          <LeadDialogTrigger
            kind="callback"
            block="Календарный план"
            formTitle="Календарный план турниров"
            asChild
          >
            <PrimaryButton className="w-full lg:w-auto">Оставить заявку</PrimaryButton>
          </LeadDialogTrigger>
          <div>
            <Link
              href="/tournaments"
              className="text-primary mt-6 inline-block font-semibold underline-offset-4 hover:underline"
            >
              Весь календарь →
            </Link>
          </div>
        </div>

        <ul className={LIST_CLASS}>
          {tournaments.length > 0 ? (
            tournaments.map((tournament) => (
              <li key={tournament.id}>
                <TournamentRow tournament={tournament} />
              </li>
            ))
          ) : (
            <li>
              <EmptyRow />
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

/** Мобильный: дата над обложкой; с `lg`: колонка даты (по центру по высоте) + обложка справа */
const ROW_CLASS = "mb-[clamp(16px,2.6vw,50px)] flex flex-col lg:flex-row lg:items-center";
const DATE_CLASS = `text-date mb-1.5 shrink-0 text-[13px] font-semibold sm:text-[15px] lg:mb-0 lg:pr-[clamp(12px,1.5vw,28px)] lg:text-right lg:text-[clamp(15px,1vw,19px)] lg:text-balance ${DATE_COLUMN}`;
const MEDIA_CLASS = `bg-muted relative w-full min-w-0 overflow-hidden rounded-[2px] lg:flex-1 ${MEDIA_HEIGHT}`;
/** Плашка внутри обложки, у её нижнего левого угла — не выходит за пределы фото */
const PLATE_CLASS =
  "absolute inset-x-[clamp(8px,1vw,19px)] bottom-[clamp(8px,1.72vw,33px)] rounded-[10px] bg-white/80 px-[clamp(10px,2vw,38px)] py-[clamp(8px,1vw,19px)] text-[#1C1C1C] sm:right-auto sm:max-w-[min(580px,80%)]";

function TournamentRow({ tournament }: { tournament: PublicTournament }) {
  return (
    <article className={ROW_CLASS}>
      <p className={DATE_CLASS}>
        <time dateTime={tournament.startDate}>
          {formatEventDate(tournament.startDate, tournament.endDate)}
        </time>
      </p>
      <div className={MEDIA_CLASS}>
        {tournament.cover ? (
          <Picture
            asset={tournament.cover}
            sizes="(min-width:1920px) 900px, (min-width:1024px) 47vw, 100vw"
            alt={tournament.cover.alt || tournament.title}
            pictureClassName="block h-full"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Trophy aria-hidden="true" className="text-muted-foreground size-10" />
          </div>
        )}
        <div className={PLATE_CLASS}>
          <h3 className="text-xs font-medium sm:text-sm lg:text-[clamp(14px,1vw,19px)]">
            {tournament.title}
          </h3>
          {tournament.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-[1.5] lg:text-[clamp(13px,0.94vw,18px)]">
              {tournament.description}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EmptyRow() {
  return (
    <div className="flex items-center gap-[38px] rounded-[12px] bg-white p-5 lg:p-8">
      <span aria-hidden="true" className="text-date font-semibold">
        —
      </span>
      <p className="font-medium">В ближайшее время мероприятий не запланировано</p>
    </div>
  );
}

/** Заглушка в той же сетке: заголовок/кнопка слева, три строки «дата + обложка» справа. */
export function TournamentsPreviewSkeleton() {
  return (
    <section aria-hidden="true" className={SECTION_CLASS}>
      <div className={INNER_CLASS}>
        <div className={ASIDE_CLASS}>
          <Skeleton className="mx-auto mb-4 h-[clamp(28px,4vw,80px)] w-3/4 lg:mx-0" />
          <Skeleton className="mx-auto mb-[clamp(13px,2.6vw,50px)] h-16 w-2/3 lg:mx-0" />
          <Skeleton className="mx-auto h-[clamp(60px,4.69vw,90px)] w-full rounded-[12px] lg:mx-0 lg:w-[360px]" />
        </div>
        <div className={LIST_CLASS}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={ROW_CLASS}>
              <div
                className={`mb-1.5 shrink-0 lg:mb-0 lg:flex lg:justify-end lg:pr-[clamp(12px,1.5vw,28px)] ${DATE_COLUMN}`}
              >
                <Skeleton className="h-4 w-24 lg:w-3/4" />
              </div>
              <Skeleton className={`w-full rounded-[2px] lg:flex-1 ${MEDIA_HEIGHT}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
