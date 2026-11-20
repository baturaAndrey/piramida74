"use client";

import { useId, useMemo, useState } from "react";
import { CalendarDays, Moon } from "lucide-react";
import { ru } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CalculatorUrlState } from "@/lib/calculator/url-state";
import { clockToMin, minToClock } from "@/lib/dates";
import {
  formatHours,
  formatLongDate,
  HOURS_STEP,
  isoToLocalDate,
  localDateToIso,
  MAX_GUESTS,
  MAX_HOURS,
  MIN_GUESTS,
  MIN_HOURS,
  type CalculatorPatch,
} from "./calculator-helpers";
import { Stepper } from "./stepper";
import { buildTimeSlots, isNightOpMin, MIDNIGHT_OP_MIN } from "./time-slots";

interface DateTimeStepProps {
  state: CalculatorUrlState;
  onChange: (patch: CalculatorPatch) => void;
  /** Операционная дата «сегодня» с сервера (Asia/Yekaterinburg) */
  defaultDate: string;
}

/** Шаг 1: дата визита, время начала, длительность, гости */
export function DateTimeStep({ state, onChange, defaultDate }: DateTimeStepProps) {
  const uid = useId();
  const ids = {
    date: `${uid}-date`,
    time: `${uid}-time`,
    timeHint: `${uid}-time-hint`,
    hours: `${uid}-hours`,
    guests: `${uid}-guests`,
  };
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Дата из URL раньше «сегодня» не ломает расчёт, но в календаре прошлое недоступно
  const visitDate = state.d ?? defaultDate;
  const slots = useMemo(() => buildTimeSlots(visitDate), [visitDate]);

  const startMin = clockToMin(state.t);
  const endMin = startMin + Math.round(state.h * 60);
  const startsAtNight = isNightOpMin(startMin);
  // Конец после полуночи — календарно уже следующий день
  const endsNextDay = endMin > MIDNIGHT_OP_MIN;

  const selectDate = (date: Date | undefined) => {
    if (!date) return;
    const iso = localDateToIso(date);
    // Дефолт в URL не пишем
    onChange({ d: iso === defaultDate ? null : iso });
    setCalendarOpen(false);
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={ids.date}>Дата визита</Label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              id={ids.date}
              type="button"
              variant="outline"
              className="h-10 w-full justify-start font-normal"
            >
              <CalendarDays className="text-muted-foreground size-4" aria-hidden="true" />
              {formatLongDate(visitDate)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              locale={ru}
              weekStartsOn={1}
              selected={isoToLocalDate(visitDate)}
              defaultMonth={isoToLocalDate(visitDate)}
              onSelect={selectDate}
              disabled={{ before: isoToLocalDate(defaultDate) }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label htmlFor={ids.time}>Время начала</Label>
        <Select value={state.t} onValueChange={(t) => onChange({ t })}>
          <SelectTrigger
            id={ids.time}
            className="w-full data-[size=default]:h-10"
            aria-describedby={startsAtNight ? ids.timeHint : undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {slots.map((slot) => (
              <SelectItem key={slot.value} value={slot.value}>
                {slot.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {startsAtNight ? (
          <p id={ids.timeHint} className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Moon className="size-3.5" aria-hidden="true" />
            Это ночь после выбранной даты
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={ids.hours}>Длительность</Label>
        <div>
          <Stepper
            id={ids.hours}
            value={state.h}
            min={MIN_HOURS}
            max={MAX_HOURS}
            step={HOURS_STEP}
            format={formatHours}
            onChange={(h) => onChange({ h })}
          />
        </div>
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Окончание: <span className="text-foreground font-medium">{minToClock(endMin)}</span>
          {endsNextDay ? " на следующий день" : null}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={ids.guests}>Гости</Label>
        <div>
          <Stepper
            id={ids.guests}
            value={state.g}
            min={MIN_GUESTS}
            max={MAX_GUESTS}
            onChange={(g) => onChange({ g })}
          />
        </div>
      </div>
    </div>
  );
}
