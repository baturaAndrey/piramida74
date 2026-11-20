import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getOpDate } from "@/lib/dates";
import { getExtraServices, getHalls, getTariffs } from "@/lib/queries/pricing";
import { cn } from "@/lib/utils";
import { Container } from "../container";
import { Reveal } from "../reveal";
import { SectionTitle } from "../section-title";
import { buildPriceGroups, isTariffActiveOn, type PriceGroup, type PriceRow } from "./price-groups";

const SECTION_CLASS = "scroll-mt-24 py-[clamp(32px,4vw,77px)]";

/** Колонки «Услуги | Время | Стоимость»: пропорции до `xl`, точные ширины старого сайта с `xl` */
const COLUMNS = "md:grid md:grid-cols-[2.5fr_1fr_1.1fr] xl:grid-cols-[640px_250px_280px]";
/** Горизонтальные поля шапки и групп (69/80px при 1920) */
const ROW_PADDING = "md:pr-[clamp(48px,4.17vw,80px)] md:pl-[clamp(32px,3.6vw,69px)]";

/** «Прайс-лист»: аккордеон групп тарифов (нативный `<details>`), сноска и ссылка на полный прайс. */
export async function PriceAccordion() {
  await connection();
  const opDate = getOpDate();
  const [halls, tariffs, extras] = await Promise.all([
    getHalls(),
    getTariffs(),
    getExtraServices(),
  ]);
  const groups = buildPriceGroups(
    halls,
    tariffs.filter((t) => isTariffActiveOn(t, opDate)),
    extras
  );

  return (
    <section id="price" className={SECTION_CLASS}>
      <Container>
        <Reveal>
          <SectionTitle className="mb-[clamp(16px,2.86vw,55px)] font-bold">Прайс-лист</SectionTitle>
        </Reveal>

        {groups.length > 0 ? (
          <div className="mb-[clamp(24px,3.1vw,60px)] overflow-hidden rounded-[12px]">
            <div
              aria-hidden="true"
              className={cn(
                "bg-table-head hidden items-center py-[clamp(24px,2.08vw,40px)] text-center text-[clamp(16px,1.25vw,24px)] leading-8 font-semibold text-white",
                COLUMNS,
                ROW_PADDING
              )}
            >
              <div className="text-left">Услуги</div>
              <div>Время</div>
              <div>Стоимость</div>
            </div>
            <div>
              {groups.map((group, index) => (
                <PriceGroupItem key={group.title} group={group} defaultOpen={index === 0} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground mb-6">Прайс-лист скоро появится.</p>
        )}

        <div className="text-muted-foreground flex flex-col items-center gap-2 text-center text-[13px] md:text-[clamp(14px,0.9375vw,18px)]">
          <p>
            *Стоимость может отличаться от указанной на сайте.{" "}
            <b className="text-foreground font-semibold">Точную стоимость уточняйте</b>
          </p>
          <Link
            href="/prices"
            className="text-primary font-semibold underline-offset-4 hover:underline"
          >
            Полный прайс и штрафы
          </Link>
        </div>
      </Container>
    </section>
  );
}

function PriceGroupItem({ group, defaultOpen }: { group: PriceGroup; defaultOpen: boolean }) {
  return (
    <details
      open={defaultOpen}
      className="group bg-row-alt md:odd:bg-row-alt mb-2.5 rounded-[12px] md:mb-0 md:rounded-none md:even:bg-white"
    >
      <summary
        className={cn(
          "relative cursor-pointer list-none py-[23px] pr-14 pl-5 text-base leading-8 font-bold md:py-8 md:text-[clamp(18px,1.25vw,24px)] [&::-webkit-details-marker]:hidden",
          ROW_PADDING
        )}
      >
        {group.title}
        <span
          aria-hidden="true"
          className="bg-primary after:bg-primary absolute top-[18px] right-[21px] isolate flex size-[26px] items-center justify-center rounded-full text-white transition-transform duration-300 group-open:scale-[1.3] group-open:rotate-45 group-open:bg-white group-open:text-[#D5DEE3] group-open:shadow-[0_0_50px_rgba(0,0,0,.05)] after:absolute after:inset-0 after:-z-10 after:animate-ping after:rounded-full after:[animation-duration:2s] group-open:after:hidden md:top-8 md:right-[33px] md:size-8"
        >
          <Plus className="size-3.5" strokeWidth={3} />
        </span>
      </summary>
      <div
        className={cn("px-5 pt-0 pb-[23px] md:pt-[clamp(16px,1.98vw,38px)] md:pb-8", ROW_PADDING)}
      >
        {group.rows.map((row, index) => (
          <PriceRowView key={index} row={row} />
        ))}
      </div>
    </details>
  );
}

function PriceRowView({ row }: { row: PriceRow }) {
  return (
    <div
      className={cn(
        "mb-1 grid grid-cols-[1fr_auto] gap-x-3 text-sm leading-8 font-medium last:mb-0 md:mb-2.5 md:text-center md:text-[clamp(14px,0.9375vw,18px)]",
        COLUMNS
      )}
    >
      {/* На мобильном пустая подпись дней не занимает строку; у «Проката» нет времени */}
      <div
        className={cn(
          "md:pl-[clamp(16px,1.93vw,37px)] md:text-left",
          row.days ? (row.time ? "col-span-2 md:col-span-1" : "") : "hidden md:block"
        )}
      >
        {row.days}
      </div>
      <div className={cn("tabular-nums", row.time ? "" : "hidden md:block")}>{row.time}</div>
      <div className="text-right tabular-nums md:text-center">{row.price}</div>
    </div>
  );
}

/** Заглушка: заголовок и 4 строки групп. */
export function PriceAccordionSkeleton() {
  return (
    <section aria-hidden="true" className={SECTION_CLASS}>
      <Container>
        <SectionTitle className="mb-[clamp(16px,2.86vw,55px)] font-bold">Прайс-лист</SectionTitle>
        <div className="mb-[clamp(24px,3.1vw,60px)] space-y-2.5 md:space-y-0.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[96px] rounded-[12px]" />
          ))}
        </div>
      </Container>
    </section>
  );
}
