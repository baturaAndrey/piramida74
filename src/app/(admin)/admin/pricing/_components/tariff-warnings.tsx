import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { Hall, RentalTariff } from "@/lib/schema";
import { formatHole, formatOverlap } from "../_lib/labels";
import type { Hole, Overlap } from "../_lib/tariff-analysis";

/** Сколько строк о «дырах» показывать в toast — полный список есть над таблицей */
const TOAST_MAX_HOLES = 3;

/** `toast.warning` после сохранения, если у зала осталось время без тарифа */
export function showHoleWarnings(warnings: string[]) {
  if (warnings.length === 0) return;
  const shown = warnings.slice(0, TOAST_MAX_HOLES);
  const rest = warnings.length - shown.length;
  toast.warning("Есть время без тарифа", {
    description: (
      <ul className="space-y-1">
        {shown.map((w) => (
          <li key={w}>{w}</li>
        ))}
        {rest > 0 ? <li>…и ещё {rest}</li> : null}
      </ul>
    ),
  });
}

type TariffWarningsProps = {
  halls: Pick<Hall, "id" | "name">[];
  overlaps: Overlap<RentalTariff>[];
  holes: Hole[];
};

// В src/components/ui нет компонента Alert — используется та же разметка (role + иконка + текст)
const ALERT_BASE = "flex gap-3 rounded-lg border p-4 text-sm";

/** Предупреждения над таблицей тарифов: пересечения (ошибка) и «дыры» (предупреждение). */
export function TariffWarnings({ halls, overlaps, holes }: TariffWarningsProps) {
  const hallName = new Map(halls.map((h) => [h.id, h.name]));

  if (overlaps.length === 0 && holes.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-green-600" role="status">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        Тарифы покрывают сутки без дыр и пересечений
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {overlaps.length > 0 ? (
        <div
          role="alert"
          className={`${ALERT_BASE} border-destructive/50 bg-destructive/5 text-destructive`}
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold">Найдены пересечения тарифов</p>
            <p>
              Калькулятор не сможет однозначно выбрать цену. Отключите или измените один из тарифов.
            </p>
            <ul className="list-disc space-y-1 pl-4">
              {overlaps.map((o, i) => (
                <li key={`${o.a.id}-${o.b.id}-${i}`}>
                  {hallName.get(o.a.hallId) ?? "Зал"} · Пересечение: {formatOverlap(o)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {holes.length > 0 ? (
        <div role="status" className={`${ALERT_BASE} border-amber-300 bg-amber-50 text-amber-900`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold">Есть время без тарифа</p>
            <ul className="list-disc space-y-1 pl-4">
              {holes.map((h) => (
                <li key={`${h.hallId}-${h.days.join("")}-${h.fromMin}`}>
                  {formatHole(h, hallName.get(h.hallId) ?? "Зал")} — калькулятор покажет
                  предупреждение «уточните у администратора»
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
