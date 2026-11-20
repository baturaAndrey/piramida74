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
/** Внутренний блок шире основного контейнера и прижат вправо (как на старом сайте) */
const INNER_CLASS =
  "mx-auto w-[86vw] lg:mr-0 lg:ml-auto lg:flex lg:w-[91vw] lg:max-w-[1745px] lg:items-start lg:justify-between";
const ASIDE_CLASS =
  "w-full text-center lg:sticky lg:top-[88px] lg:w-[clamp(360px,35.7vw,686px)] lg:text-left";
const LIST_CLASS = "mt-6 w-full lg:mt-0 lg:max-w-[1040px] lg:flex-1";
const UPCOMING_LIMIT = 5;

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

const ROW_CLASS =
  "mb-[clamp(10px,2.6vw,50px)] flex flex-col lg:relative lg:h-[clamp(200px,15.625vw,300px)] lg:flex-row lg:items-start lg:justify-between";
const DATE_CLASS =
  "text-date mb-1.5 shrink-0 text-[13px] font-semibold whitespace-nowrap lg:mt-[clamp(80px,7.7vw,148px)] lg:mb-0 lg:pr-[38px] lg:text-[clamp(15px,1vw,19px)]";
/** Обёртка обложки: на мобильном — на всю ширину под датой, на десктопе — справа */
const MEDIA_CLASS =
  "bg-muted relative h-[144px] w-full overflow-hidden rounded-[2px] lg:static lg:h-full lg:w-[clamp(480px,40.6vw,780px)] lg:overflow-visible";
const PLATE_CLASS =
  "absolute bottom-[clamp(10px,1.72vw,33px)] left-2 w-[90%] rounded-[10px] bg-white/80 px-[clamp(10px,2vw,38px)] py-[clamp(10px,1vw,19px)] text-[#1C1C1C] lg:left-[-1vw] lg:w-[clamp(360px,30.2vw,580px)]";

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
            sizes="(min-width:1024px) 780px, 86vw"
            alt={tournament.cover.alt || tournament.title}
            pictureClassName="block h-full"
            className="h-full w-full rounded-[2px] object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Trophy aria-hidden="true" className="text-muted-foreground size-10" />
          </div>
        )}
        <div className={PLATE_CLASS}>
          <h3 className="text-xs font-medium lg:text-[clamp(14px,1vw,19px)]">{tournament.title}</h3>
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

/** Заглушка: заголовок/кнопка слева, три строки турниров справа. */
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
            <Skeleton
              key={i}
              className="mb-[clamp(10px,2.6vw,50px)] h-[144px] rounded-[2px] lg:h-[clamp(200px,15.625vw,300px)]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
