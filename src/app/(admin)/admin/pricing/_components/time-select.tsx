"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { timeOptionLabel } from "../_lib/labels";
import { OP_DAY_MINUTES } from "../_lib/tariff-analysis";

/** Шаг выбора времени: калькулятор работает с получасовыми интервалами */
const STEP_MIN = 30;
const LAST_START_MIN = OP_DAY_MINUTES - STEP_MIN;

type TimeSelectProps = {
  /** `start` — значения 0..1410, `end` — 30..1440 */
  kind: "start" | "end";
  value: number;
  onChange: (value: number) => void;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/** Опции в порядке операционных суток: 09:00 → … → 08:30 (→ 09:00 конец суток) */
function buildOptions(kind: "start" | "end"): number[] {
  const count = OP_DAY_MINUTES / STEP_MIN + 1;
  return Array.from({ length: count }, (_, i) => i * STEP_MIN).filter((m) =>
    kind === "start" ? m <= LAST_START_MIN : m >= STEP_MIN
  );
}

const START_OPTIONS = buildOptions("start");
const END_OPTIONS = buildOptions("end");

/**
 * Выбор времени в «операционных» минутах (от 09:00 до 09:00 следующего дня).
 * Select вместо `<input type="time">` снимает неоднозначность «09:00 — начало или конец суток».
 */
export function TimeSelect({ kind, value, onChange, id, disabled, ...aria }: TimeSelectProps) {
  const options = kind === "start" ? START_OPTIONS : END_OPTIONS;
  return (
    <Select
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      {...(disabled !== undefined ? { disabled } : {})}
    >
      <SelectTrigger
        className="w-full"
        {...(id ? { id } : {})}
        {...(aria["aria-invalid"] !== undefined ? { "aria-invalid": aria["aria-invalid"] } : {})}
        {...(aria["aria-describedby"] ? { "aria-describedby": aria["aria-describedby"] } : {})}
      >
        <SelectValue placeholder="Время" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((m) => (
          <SelectItem key={m} value={String(m)}>
            {timeOptionLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
