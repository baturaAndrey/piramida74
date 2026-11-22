import type { PublicPenalty } from "@/lib/queries/pricing";
import type { PenaltyKind } from "@/lib/schema/enums";
import { formatPenaltyPrice } from "../_lib/format";

const GROUPS: { kind: PenaltyKind; title: string }[] = [
  { kind: "dishware", title: "Штрафы за бой посуды" },
  { kind: "property", title: "Штрафы за порчу имущества" },
];

/** Два списка штрафов (посуда / имущество); порядок внутри — как отдаёт запрос (`sortOrder`) */
export function PenaltiesList({ penalties }: { penalties: PublicPenalty[] }) {
  const groups = GROUPS.map((g) => ({
    ...g,
    items: penalties.filter((p) => p.kind === g.kind),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {groups.map((group) => (
        <div key={group.kind} className="rounded-[12px] bg-white p-4 md:p-6">
          <h3 id={`penalties-${group.kind}`} className="mb-3 text-lg font-semibold md:text-xl">
            {group.title}
          </h3>
          <ul
            aria-labelledby={`penalties-${group.kind}`}
            className="overflow-hidden rounded-[10px]"
          >
            {group.items.map((item, index) => (
              <li
                key={item.id}
                className={`flex items-baseline justify-between gap-4 px-3 py-2.5 text-sm md:text-base ${
                  index % 2 === 0 ? "bg-row-alt" : "bg-card"
                }`}
              >
                <span>{item.name}</span>
                <span className="shrink-0 font-bold whitespace-nowrap tabular-nums">
                  {formatPenaltyPrice(item.price, item.priceIsMinimum)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
