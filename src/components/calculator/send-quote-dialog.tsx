"use client";

import { LeadForm } from "@/components/leads/lead-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { restoreFocusOnClose } from "@/hooks/use-lazy-dialog";
import type { Quote, QuoteInput } from "@/lib/calculator/types";
import { minToClock } from "@/lib/dates";
import { formatLongDate, formatRub, GUEST_FORMS, plural } from "./calculator-helpers";

interface SendQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: QuoteInput;
  quote: Quote;
  /** Кнопка, открывшая диалог (не `DialogTrigger`): Radix сам не знает, куда вернуть фокус */
  triggerRef: React.RefObject<HTMLElement | null>;
}

/**
 * Отправка расчёта в клуб. В заявку уходит `QuoteInput` (скрытое поле `quote`), а не сумма:
 * сервер пересчитывает смету по актуальному каталогу. Цель Метрики `calculator_submit`
 * отправляет сам `LeadForm` до перехода на /spasibo; при ошибке диалог и значения формы остаются.
 *
 * Модуль (Radix Dialog + LeadForm с react-hook-form, zod и маской телефона) — отдельный чанк:
 * `CalculatorClient` грузит его лениво при первом открытии. Default export — для `React.lazy`.
 */
export default function SendQuoteDialog({
  open,
  onOpenChange,
  input,
  quote,
  triggerRef,
}: SendQuoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        // Без DialogTrigger фокус после закрытия ушёл бы на body: возвращаем на кнопку отправки
        onCloseAutoFocus={restoreFocusOnClose(triggerRef)}
      >
        <DialogHeader>
          <DialogTitle>Отправить расчёт в клуб</DialogTitle>
          <DialogDescription>
            {input.guests} {plural(input.guests, GUEST_FORMS)}, {formatLongDate(input.opDate)},{" "}
            {minToClock(input.startMin)}, итого ≈ {formatRub(quote.total)}. Администратор перезвонит
            и подтвердит бронь.
          </DialogDescription>
        </DialogHeader>
        <LeadForm
          type="calculator"
          block="Калькулятор"
          formTitle="Расчёт из калькулятора"
          submitLabel="Отправить расчёт в клуб"
          hidden={{ quote: JSON.stringify(input) }}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
