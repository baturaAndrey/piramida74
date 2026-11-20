"use client";

import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clockToMin, minToClock } from "@/lib/dates";
import { MIDNIGHT_MIN, OP_DAY_START_CLOCK, toWindow } from "../_lib/labels";

type TimeWindowFieldProps = {
  /** Минуты от 09:00 операционных суток; null — без ограничения по времени */
  startMin: number | null;
  endMin: number | null;
  /** NaN — поле включено, но время не указано (zod покажет «Укажите время») */
  onChange: (startMin: number | null, endMin: number | null) => void;
  startError?: string | undefined;
  endError?: string | undefined;
  disabled?: boolean;
};

const CLOCK_RE = /^\d{2}:\d{2}/;
/** Шаг 30 минут, как у тарифов */
const TIME_STEP_SECONDS = 1800;

function initialClock(min: number | null): string {
  return min === null || Number.isNaN(min) ? "" : minToClock(min);
}

/** «HH:MM» или «HH:MM:SS» → «HH:MM»; пустое/битое значение → "" */
function normalizeClock(value: string): string {
  const match = CLOCK_RE.exec(value);
  return match ? match[0] : "";
}

/** Пояснение окна в обычных часах: «16:00–02:00 — до 02:00 следующей ночи» */
function describeWindow(startClock: string, endClock: string): string | null {
  if (!startClock || !endClock) return null;
  const { startMin, endMin } = toWindow(startClock, endClock);
  if (endMin <= startMin) return null;
  const range = `${startClock}–${endClock}`;
  if (endClock === OP_DAY_START_CLOCK) return `${range}: до 09:00 следующего утра`;
  if (endMin > MIDNIGHT_MIN) return `${range}: до ${endClock} следующей ночи`;
  return `${range}: в течение дня`;
}

/** Окно действия акции в часах; хранится в минутах от 09:00 операционных суток. */
export function TimeWindowField({
  startMin,
  endMin,
  onChange,
  startError,
  endError,
  disabled = false,
}: TimeWindowFieldProps) {
  const checkboxId = useId();
  const startId = useId();
  const endId = useId();
  const [enabled, setEnabled] = useState(startMin !== null || endMin !== null);
  const [startClock, setStartClock] = useState(() => initialClock(startMin));
  const [endClock, setEndClock] = useState(() => initialClock(endMin));

  function emit(nextEnabled: boolean, nextStart: string, nextEnd: string) {
    if (!nextEnabled) {
      onChange(null, null);
      return;
    }
    const start = nextStart ? clockToMin(nextStart) : Number.NaN;
    // «До 09:00» — конец операционных суток (1440), а не их начало (0)
    const end = nextEnd ? toWindow(OP_DAY_START_CLOCK, nextEnd).endMin : Number.NaN;
    onChange(start, end);
  }

  const hint = enabled ? describeWindow(startClock, endClock) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id={checkboxId}
          checked={enabled}
          disabled={disabled}
          onCheckedChange={(checked) => {
            const next = checked === true;
            setEnabled(next);
            emit(next, startClock, endClock);
          }}
        />
        <Label htmlFor={checkboxId} className="font-normal">
          Только в определённые часы
        </Label>
      </div>
      {enabled ? (
        <div className="space-y-2">
          <div className="grid max-w-sm grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={startId} className="text-muted-foreground text-xs">
                С
              </Label>
              <Input
                id={startId}
                type="time"
                step={TIME_STEP_SECONDS}
                value={startClock}
                disabled={disabled}
                aria-invalid={startError ? true : undefined}
                onChange={(event) => {
                  const next = normalizeClock(event.target.value);
                  setStartClock(next);
                  emit(true, next, endClock);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={endId} className="text-muted-foreground text-xs">
                До
              </Label>
              <Input
                id={endId}
                type="time"
                step={TIME_STEP_SECONDS}
                value={endClock}
                disabled={disabled}
                aria-invalid={endError ? true : undefined}
                onChange={(event) => {
                  const next = normalizeClock(event.target.value);
                  setEndClock(next);
                  emit(true, startClock, next);
                }}
              />
            </div>
          </div>
          {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
          <p className="text-muted-foreground text-xs">
            Сутки клуба — с 09:00 до 09:00: «16:00–02:00» означает ночные часы после полуночи.
          </p>
          {startError ? <p className="text-destructive text-sm">{startError}</p> : null}
          {endError && endError !== startError ? (
            <p className="text-destructive text-sm">{endError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
