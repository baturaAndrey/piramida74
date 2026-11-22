import { ChevronDown } from "lucide-react";
import { formatEventDate } from "@/lib/dates";
import type { PublicTournament } from "@/lib/queries/tournaments";
import { seriesLabel } from "./tournament-card";
import { DISCIPLINE_LABELS } from "../_lib/labels";

type PastTournamentsProps = {
  /** Уже в порядке убывания даты */
  tournaments: PublicTournament[];
  open: boolean;
};

/** Свёрнутый (`<details>`, без JS) список прошедших турниров года */
export function PastTournaments({ tournaments, open }: PastTournamentsProps) {
  if (tournaments.length === 0) return null;

  return (
    <details open={open} className="group rounded-[12px] bg-white">
      <summary className="focus-visible:ring-ring/50 flex cursor-pointer list-none items-center justify-between gap-4 rounded-[12px] p-4 text-lg font-semibold focus-visible:ring-[3px] md:p-6 md:text-xl [&::-webkit-details-marker]:hidden">
        Прошедшие турниры ({tournaments.length})
        <ChevronDown
          className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ul className="divide-y divide-[#EEF0F2] border-t border-[#EEF0F2]">
        {tournaments.map((t) => {
          const meta = [seriesLabel(t), t.discipline ? DISCIPLINE_LABELS[t.discipline] : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={t.id}
              className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-baseline md:gap-6 md:px-6"
            >
              <time
                dateTime={t.startDate}
                className="text-date shrink-0 text-sm font-semibold md:w-44"
              >
                {formatEventDate(t.startDate, t.endDate)}
              </time>
              <div className="min-w-0">
                <p className="font-medium">{t.title}</p>
                {meta ? <p className="text-subtle text-sm">{meta}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
