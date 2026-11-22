import { AlertTriangle, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { minToClock } from "@/lib/dates";
import {
  formatIsoDate,
  formatRub,
  fullDateTimeFormat,
  QUOTE_LINE_KIND_LABELS,
  type QuoteSnapshot,
} from "../_lib/labels";

type QuoteSnapshotViewProps = { snapshot: QuoteSnapshot; hallName: string | null };

const MINUTES_PER_HOUR = 60;

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${rest} мин`;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

/** Количество может быть дробным (стол-часы с шагом 0.5) */
function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toLocaleString("ru-RU");
}

function InputFacts({ snapshot, hallName }: QuoteSnapshotViewProps) {
  const input = snapshot.input;
  if (!input) return null;
  const facts: { label: string; value: string }[] = [];
  if (input.opDate) facts.push({ label: "Дата визита", value: formatIsoDate(input.opDate) });
  if (input.startMin !== undefined)
    facts.push({ label: "Начало", value: minToClock(input.startMin) });
  if (input.durationMin !== undefined) {
    facts.push({ label: "Длительность", value: formatDuration(input.durationMin) });
  }
  if (input.guests !== undefined) facts.push({ label: "Гостей", value: String(input.guests) });
  if (hallName) facts.push({ label: "Зал", value: hallName });
  if (input.tables !== undefined) facts.push({ label: "Столов", value: String(input.tables) });
  if (input.pensioner) facts.push({ label: "Тариф", value: "пенсионный" });
  if (facts.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="space-y-0.5">
          <dt className="text-muted-foreground text-xs">{fact.label}</dt>
          <dd className="font-medium">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Снимок расчёта калькулятора: входные данные, строки, итоги, предупреждения и подсказки акций. */
export function QuoteSnapshotView({ snapshot, hallName }: QuoteSnapshotViewProps) {
  const quote = snapshot.quote;
  const calculatedAt = snapshot.calculatedAt ? new Date(snapshot.calculatedAt) : null;

  return (
    <div className="space-y-4">
      <InputFacts snapshot={snapshot} hallName={hallName} />

      {quote ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">Вид</TableHead>
                  <TableHead>Позиция</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Цена</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      Строк нет
                    </TableCell>
                  </TableRow>
                ) : (
                  quote.lines.map((line, index) => (
                    <TableRow key={`${line.kind}-${index}`}>
                      <TableCell className="text-muted-foreground hidden whitespace-nowrap sm:table-cell">
                        {QUOTE_LINE_KIND_LABELS[line.kind]}
                      </TableCell>
                      <TableCell className="whitespace-normal sm:min-w-40">
                        {line.label}
                        {/* На узком экране вид и цена — под названием, вместо отдельных колонок */}
                        <span className="text-muted-foreground block text-xs sm:hidden">
                          {QUOTE_LINE_KIND_LABELS[line.kind]} · {formatRub(line.unitPrice)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQty(line.qty)}
                      </TableCell>
                      <TableCell className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell">
                        {formatRub(line.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {formatRub(line.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <dl className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Аренда</dt>
              <dd className="tabular-nums">{formatRub(quote.rentalTotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Кухня и бар</dt>
              <dd className="tabular-nums">{formatRub(quote.foodTotal)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t pt-1 text-base font-semibold">
              <dt>Итого</dt>
              <dd className="tabular-nums">{formatRub(quote.total)}</dd>
            </div>
            <div className="text-muted-foreground flex justify-between gap-4">
              <dt>На гостя</dt>
              <dd className="tabular-nums">{formatRub(quote.perGuest)}</dd>
            </div>
          </dl>

          {quote.warnings.length > 0 ? (
            <div
              role="alert"
              className="border-badge bg-badge/15 text-badge-foreground flex gap-3 rounded-lg border p-4 text-sm"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <ul className="space-y-1">
                {quote.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {quote.promoHints.length > 0 ? (
            <div role="status" className="bg-muted/50 flex gap-3 rounded-lg border p-4 text-sm">
              <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <ul className="space-y-1">
                {quote.promoHints.map((hint, index) => (
                  <li key={index}>{hint}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">Строки расчёта не сохранились.</p>
      )}

      {calculatedAt && !Number.isNaN(calculatedAt.getTime()) ? (
        <p className="text-muted-foreground text-xs">
          Рассчитано на сервере {fullDateTimeFormat.format(calculatedAt)}. Расчёт предварительный,
          итог подтверждает администратор.
        </p>
      ) : null}
    </div>
  );
}
