import type { MenuPriceGroup } from "@/lib/queries/menu";
import { formatPortion, formatPrice } from "../_lib/format";

/** Шапка общей сетки цен раздела (Teatone, фирменные чаи, лимонады): «0,3 л — 250 ₽» в строку */
export function PriceGroupTable({ group }: { group: MenuPriceGroup }) {
  if (group.tiers.length === 0) return null;
  return (
    <div className="mb-4 rounded-[12px] bg-[#1C1C1C] p-4 text-white">
      {group.name ? <p className="mb-2 text-sm font-semibold text-white/70">{group.name}</p> : null}
      <ul className="flex flex-wrap gap-x-8 gap-y-2" aria-label="Общие цены раздела">
        {group.tiers.map((tier, index) => {
          const portion = formatPortion(tier);
          return (
            <li key={tier.code ?? `${index}-${tier.price}`} className="text-sm md:text-base">
              {portion ? <span className="text-white/80">{portion} — </span> : null}
              <span className="font-bold tabular-nums">{formatPrice(tier.price)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
