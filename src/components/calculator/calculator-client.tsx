"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { Button } from "@/components/ui/button";
import { calculateQuote } from "@/lib/calculator/calculate";
import type { CalculatorCatalog } from "@/lib/calculator/types";
import { calculatorParsers, toQuoteInput } from "@/lib/calculator/url-state";
import { formatRub, setKeyQty, toQtyMap, type CalculatorPatch } from "./calculator-helpers";
import { DateTimeStep } from "./date-time-step";
import { HallStep } from "./hall-step";
import { MenuPicker } from "./menu-picker";
import { QuoteSummary } from "./quote-summary";
import { SendQuoteDialog } from "./send-quote-dialog";
import { SetsPicker } from "./sets-picker";

const SUMMARY_ID = "quote-summary";

interface CalculatorClientProps {
  catalog: CalculatorCatalog;
  /** Операционная дата «сегодня» (Asia/Yekaterinburg), вычислена на сервере */
  defaultDate: string;
}

/**
 * Клиентский корень калькулятора. Всё состояние — в URL (nuqs, `replace` + shallow),
 * поэтому ссылкой можно поделиться; значения по умолчанию в URL не пишутся (clearOnDefault).
 * Расчёт — чистая `calculateQuote` на каждом изменении.
 */
export function CalculatorClient({ catalog, defaultDate }: CalculatorClientProps) {
  const [state, setState] = useQueryStates(calculatorParsers, {
    history: "replace",
    shallow: true,
    scroll: false,
  });
  const [sendOpen, setSendOpen] = useState(false);

  const input = useMemo(
    () => toQuoteInput(state, catalog, defaultDate),
    [state, catalog, defaultDate]
  );
  const quote = useMemo(() => calculateQuote(input, catalog), [input, catalog]);
  const hall = catalog.halls.find((h) => h.id === input.hallId);
  const itemQty = useMemo(() => toQtyMap(state.i), [state.i]);

  const update = useCallback(
    (patch: CalculatorPatch) => {
      void setState(patch);
    },
    [setState]
  );

  const setItemQty = useCallback(
    (code: string, qty: number) => {
      void setState((prev) => {
        const next = setKeyQty(prev.i, code, qty);
        return { i: next.length ? next : null };
      });
    },
    [setState]
  );

  const scrollToSummary = () => {
    document.getElementById(SUMMARY_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid grid-cols-1 gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-0">
      <div className="min-w-0 space-y-6">
        <StepCard number={1} title="Дата, время и гости">
          <DateTimeStep state={state} onChange={update} defaultDate={defaultDate} />
        </StepCard>
        <StepCard number={2} title="Зал и услуги">
          <HallStep state={state} onChange={update} catalog={catalog} hall={hall} />
        </StepCard>
        <StepCard number={3} title="Банкетные сеты">
          <SetsPicker
            sets={catalog.sets}
            value={state.s}
            guests={state.g}
            onChange={(s) => update({ s: s.length ? s : null })}
          />
        </StepCard>
        <StepCard number={4} title="Меню">
          <MenuPicker menuVariants={catalog.menuVariants} items={itemQty} onChange={setItemQty} />
        </StepCard>
      </div>

      <div className="self-start lg:sticky lg:top-24">
        <QuoteSummary
          className="scroll-mt-24"
          quote={quote}
          guests={input.guests}
          onSend={() => setSendOpen(true)}
          id={SUMMARY_ID}
        />
      </div>

      {/* Мобильная панель итога: ведёт к смете */}
      <div className="bg-card fixed inset-x-0 bottom-0 z-40 border-t shadow-lg lg:hidden">
        {/* Справа место под кнопку «Наверх» (fixed right-6, size-12/16) */}
        <div className="container-site flex items-center justify-between gap-4 py-3 pr-14 md:pr-16">
          <div>
            <p className="text-muted-foreground text-xs">Итого</p>
            <p className="text-primary text-xl font-bold tabular-nums">{formatRub(quote.total)}</p>
          </div>
          <Button type="button" className="h-11 px-5" onClick={scrollToSummary}>
            К расчёту
          </Button>
        </div>
      </div>

      <SendQuoteDialog open={sendOpen} onOpenChange={setSendOpen} input={input} quote={quote} />
    </div>
  );
}

function StepCard({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm sm:p-6">
      <h2 className="mb-5 flex items-center gap-3 text-lg font-semibold">
        <span
          className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm"
          aria-hidden="true"
        >
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
