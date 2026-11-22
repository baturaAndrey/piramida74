import { Trophy } from "lucide-react";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import { Picture } from "@/components/media/picture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatEventDate } from "@/lib/dates";
import type { PublicTournament } from "@/lib/queries/tournaments";
import { DISCIPLINE_LABELS, LEVEL_LABELS } from "../_lib/labels";

const formatPrice = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

/** «Марафон-Промнефтегаз · 3 тур» */
export function seriesLabel(t: Pick<PublicTournament, "seriesName" | "stageNumber">) {
  if (!t.seriesName) return null;
  return t.stageNumber ? `${t.seriesName} · ${t.stageNumber} тур` : t.seriesName;
}

type TournamentCardProps = {
  tournament: PublicTournament;
  /** Кнопка «Подать заявку» — только у предстоящих */
  upcoming: boolean;
};

export function TournamentCard({ tournament: t, upcoming }: TournamentCardProps) {
  const series = seriesLabel(t);
  const money = [
    t.entryFee ? `Взнос: ${formatPrice(t.entryFee)}` : null,
    t.prizeFund ? `Призовой фонд: ${formatPrice(t.prizeFund)}` : null,
  ].filter(Boolean);

  return (
    <article className="card-interactive flex flex-col overflow-hidden rounded-[12px] bg-white shadow-sm">
      <div className="relative aspect-[16/6] overflow-hidden">
        {t.cover ? (
          <Picture
            asset={t.cover}
            sizes="(min-width:768px) 50vw, 100vw"
            alt={t.title}
            pictureClassName="block size-full"
            className="size-full object-cover"
          />
        ) : (
          <div className="from-primary to-primary-dark flex size-full items-center justify-center bg-gradient-to-br">
            <Trophy className="size-12 text-white/70" aria-hidden="true" />
          </div>
        )}
        <p className="text-date absolute bottom-3 left-3 rounded-[8px] bg-white/80 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm">
          <time dateTime={t.startDate}>{formatEventDate(t.startDate, t.endDate)}</time>
        </p>
      </div>

      <div className="flex flex-1 flex-col space-y-3 p-4 md:p-5">
        <h3 className="text-lg font-semibold">{t.title}</h3>

        <div className="flex flex-wrap gap-1.5">
          {series ? <Badge className="rounded-full text-xs">{series}</Badge> : null}
          {t.discipline ? (
            <Badge variant="secondary" className="rounded-full text-xs">
              {DISCIPLINE_LABELS[t.discipline]}
            </Badge>
          ) : null}
          <Badge variant="secondary" className="rounded-full text-xs">
            {LEVEL_LABELS[t.level]}
          </Badge>
          {t.categories.map((c) => (
            <Badge key={c} variant="outline" className="rounded-full text-xs">
              {c}
            </Badge>
          ))}
        </div>

        {t.description ? (
          <p className="text-muted-foreground line-clamp-3 text-sm">{t.description}</p>
        ) : null}

        {money.length > 0 ? <p className="text-sm font-medium">{money.join(" · ")}</p> : null}

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
          {t.registrationOpen ? (
            <Badge className="rounded-full border-transparent bg-green-500/10 text-xs text-green-600 hover:bg-green-500/10">
              Регистрация открыта
            </Badge>
          ) : null}
          {upcoming ? (
            <LeadDialogTrigger
              kind="tournament"
              tournamentId={t.id}
              block="Турниры"
              formTitle={`Запись на турнир: ${t.title}`}
              asChild
            >
              <Button variant="outline" className="ml-auto">
                Подать заявку
              </Button>
            </LeadDialogTrigger>
          ) : null}
        </div>
      </div>
    </article>
  );
}
