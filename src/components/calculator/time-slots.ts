import { minToClock } from "@/lib/dates";
import { addDays, formatShortDate } from "./calculator-helpers";

const SLOT_MIN = 30;
const SLOTS_PER_DAY = 48;
/** 00:00 наступает через 15 часов после начала операционных суток (09:00) */
export const MIDNIGHT_OP_MIN = 15 * 60;

export interface TimeSlot {
  /** «HH:MM» — значение параметра `t` */
  value: string;
  label: string;
  /** Слот приходится на ночь после даты визита (00:00–08:30) */
  night: boolean;
}

/** Ночной ли слот: минуты операционных суток ≥ 15 ч (с 00:00) */
export function isNightOpMin(min: number): boolean {
  return min >= MIDNIGHT_OP_MIN;
}

/** 48 слотов по 30 минут от 09:00 до 08:30 следующих суток (минуты от 09:00: 0..1410). */
export function buildTimeSlots(visitDate: string): TimeSlot[] {
  const nightLabel = formatShortDate(addDays(visitDate, 1));
  return Array.from({ length: SLOTS_PER_DAY }, (_, i) => {
    const min = i * SLOT_MIN;
    const value = minToClock(min); // «09:00» … «08:30»
    const night = isNightOpMin(min);
    return { value, night, label: night ? `${value} — ночь на ${nightLabel}` : value };
  });
}
