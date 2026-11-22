"use client";

import { ru } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";

/**
 * Календарь выбора даты визита: react-day-picker вместе с русской локалью — отдельный чанк.
 * Календарь виден только в открытом поповере, поэтому `DateTimeStep` грузит этот модуль лениво
 * (`React.lazy`), а не в начальном JS /calculator. Default export — для `React.lazy`.
 */
export type VisitDateCalendarProps = {
  selected: Date;
  /** Раньше этой даты (операционное «сегодня») выбрать нельзя */
  minDate: Date;
  onSelect: (date: Date | undefined) => void;
};

export default function VisitDateCalendar({ selected, minDate, onSelect }: VisitDateCalendarProps) {
  return (
    <Calendar
      mode="single"
      locale={ru}
      weekStartsOn={1}
      selected={selected}
      defaultMonth={selected}
      onSelect={onSelect}
      disabled={{ before: minDate }}
      autoFocus
    />
  );
}
