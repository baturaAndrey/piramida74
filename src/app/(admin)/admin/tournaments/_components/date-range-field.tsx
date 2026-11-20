"use client";

import { useId, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatEventDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

type DateRangeFieldProps = {
  /** YYYY-MM-DD или пустая строка */
  startDate: string;
  /** YYYY-MM-DD или пустая строка */
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  invalid?: boolean;
  disabled?: boolean;
};

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD → локальная полночь (без UTC-сдвига, в отличие от `new Date(iso)`) */
function isoToLocalDate(iso: string): Date | undefined {
  const match = ISO_DATE_RE.exec(iso);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Локальная дата → YYYY-MM-DD (никогда через toISOString — она сдвигает дату по поясу) */
function localDateToIso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function triggerLabel(startDate: string, endDate: string): string | null {
  if (!ISO_DATE_RE.test(startDate)) return null;
  const end = ISO_DATE_RE.test(endDate) ? endDate : startDate;
  return `${formatEventDate(startDate, end)} ${startDate.slice(0, 4)}`;
}

/** Диапазон дат турнира: календарь в Popover + два поля для ручного ввода. */
export function DateRangeField({
  startDate,
  endDate,
  onChange,
  invalid = false,
  disabled = false,
}: DateRangeFieldProps) {
  const startId = useId();
  const endId = useId();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const from = isoToLocalDate(startDate);
  const to = isoToLocalDate(endDate);
  const selected: DateRange | undefined = from ? { from, to } : undefined;
  const label = triggerLabel(startDate, endDate);

  function handleSelect(range: DateRange | undefined) {
    if (!range?.from) {
      onChange("", "");
      return;
    }
    const nextStart = localDateToIso(range.from);
    // Один клик без второго — однодневный турнир
    const nextEnd = range.to ? localDateToIso(range.to) : nextStart;
    onChange(nextStart, nextEnd);
  }

  function handleStartInput(value: string) {
    // Если конец пуст или раньше нового начала — подтягиваем его к началу
    const nextEnd = !endDate || (value && endDate < value) ? value : endDate;
    onChange(value, nextEnd);
  }

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            className={cn(
              "w-full justify-start font-normal sm:w-72",
              !label && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-4 w-4" aria-hidden />
            {label ?? "Выберите даты"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            locale={ru}
            weekStartsOn={1}
            numberOfMonths={isMobile ? 1 : 2}
            {...(from ? { defaultMonth: from } : {})}
            selected={selected}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>
      <div className="grid max-w-md grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={startId} className="text-muted-foreground text-xs">
            Начало
          </Label>
          <Input
            id={startId}
            type="date"
            value={startDate}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            onChange={(event) => handleStartInput(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={endId} className="text-muted-foreground text-xs">
            Конец
          </Label>
          <Input
            id={endId}
            type="date"
            value={endDate}
            min={startDate || undefined}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            onChange={(event) => onChange(startDate, event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
