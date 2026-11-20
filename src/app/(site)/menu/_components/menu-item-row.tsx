import { ShoppingBag } from "lucide-react";
import { Picture } from "@/components/media/picture";
import type { MenuItemNode } from "@/lib/queries/menu";
import { formatPortion, formatPrice } from "../_lib/format";

type PriceLine = { key: string; portion: string; price: number };

type MenuItemRowProps = {
  item: MenuItemNode;
  /** Название общей сетки раздела: позиции по этой сетке цену не дублируют */
  categoryGroupName: string | null;
};

/**
 * Строки цен позиции: собственные варианты либо уровни своей сетки.
 * `null` — позиция идёт «по сетке» раздела (цены уже показаны в шапке раздела).
 */
function priceLinesOf(item: MenuItemNode, categoryGroupName: string | null): PriceLine[] | null {
  if (item.variants.length > 0) {
    return item.variants.map((v) => ({ key: v.code, portion: formatPortion(v), price: v.price }));
  }
  if (!item.priceGroup) return [];
  if (categoryGroupName != null && item.priceGroup.name === categoryGroupName) return null;
  return item.priceGroup.tiers.map((t, index) => ({
    key: t.code ?? `tier-${index}`,
    portion: formatPortion(t),
    price: t.price,
  }));
}

function Prices({ lines }: { lines: PriceLine[] | null }) {
  if (lines === null) {
    return <p className="text-muted-foreground text-xs">цена по сетке</p>;
  }
  const [single] = lines;
  if (lines.length === 1 && single) {
    return (
      <>
        <p className="text-lg font-bold tabular-nums">{formatPrice(single.price)}</p>
        {single.portion ? <p className="text-subtle text-sm">{single.portion}</p> : null}
      </>
    );
  }
  return (
    <ul className="space-y-0.5 text-sm md:text-base">
      {lines.map((line) => (
        <li key={line.key} className="whitespace-nowrap">
          {line.portion ? <span className="text-subtle">{line.portion} — </span> : null}
          <span className="font-bold tabular-nums">{formatPrice(line.price)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Строка позиции меню: название, состав, подача, страна, миниатюра и блок цен */
export function MenuItemRow({ item, categoryGroupName }: MenuItemRowProps) {
  const lines = priceLinesOf(item, categoryGroupName);

  return (
    <li className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:gap-5 md:p-5">
      {item.image ? (
        <Picture
          asset={item.image}
          sizes="80px"
          alt={item.name}
          pictureClassName="order-2 shrink-0 md:order-none"
          className="size-20 rounded-[10px] object-cover"
        />
      ) : null}

      <div className="order-1 min-w-0 flex-1 space-y-1.5 md:order-none">
        <p className="text-base font-semibold md:text-lg">{item.name}</p>
        {item.description ? (
          <p className="text-sm leading-relaxed text-[#8E8E8E]">{item.description}</p>
        ) : null}
        {item.choiceNote ? (
          <p className="text-muted-foreground text-xs italic">Подача на выбор: {item.choiceNote}</p>
        ) : null}
        {item.originCountry ? (
          <span className="bg-muted inline-block rounded-full px-2 py-0.5 text-xs">
            {item.originCountry}
          </span>
        ) : null}
      </div>

      <div className="order-3 flex shrink-0 items-start gap-2 md:order-none md:text-right">
        <div>
          <Prices lines={lines} />
        </div>
        {item.isTakeawayDiscount ? (
          <span title="Скидка 10% на вынос" className="mt-1.5 inline-flex">
            <ShoppingBag className="text-primary size-3.5" aria-hidden="true" />
            <span className="sr-only">Скидка 10% на вынос</span>
          </span>
        ) : null}
      </div>
    </li>
  );
}
