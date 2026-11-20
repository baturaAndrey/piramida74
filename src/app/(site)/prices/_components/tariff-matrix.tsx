import { Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTariffPrice } from "../_lib/format";
import type { Matrix } from "../_lib/matrix";

type TariffMatrixProps = {
  matrix: Matrix;
  /** Подпись таблицы для скринридеров */
  caption: string;
};

/** Таблица «интервалы времени × группы дней» (стиль прайса главной) */
export function TariffMatrix({ matrix, caption }: TariffMatrixProps) {
  const hasNight = matrix.rows.some((r) => r.night);

  return (
    <div>
      <div className="overflow-x-auto rounded-[12px]">
        <table className="w-full min-w-[420px] border-collapse text-sm md:text-base">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-table-head text-white">
              <th
                scope="col"
                className="bg-table-head sticky left-0 px-4 py-3 text-left font-semibold md:px-6"
              >
                Время
              </th>
              {matrix.columns.map((col) => (
                <th key={col.key} scope="col" className="px-4 py-3 text-center font-semibold">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row, index) => (
              <tr key={row.key} className={index % 2 === 1 ? "bg-row-alt" : "bg-card"}>
                <th
                  scope="row"
                  className="sticky left-0 bg-inherit px-4 py-3 text-left font-medium whitespace-nowrap tabular-nums md:px-6"
                >
                  <span className="inline-flex items-center gap-2">
                    {row.label}
                    {row.night ? (
                      <Moon className="text-muted-foreground size-4" aria-label="ночные часы" />
                    ) : null}
                  </span>
                </th>
                {matrix.columns.map((col) => {
                  const cell = matrix.cells[row.key]?.[col.key] ?? null;
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-center whitespace-nowrap",
                        cell ? "font-bold tabular-nums" : "text-muted-foreground"
                      )}
                    >
                      {cell ? (
                        <>
                          {formatTariffPrice(cell.price, cell.unit)}
                          {cell.note ? (
                            <span className="text-subtle block text-xs font-normal">
                              {cell.note}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasNight ? (
        <p className="text-subtle mt-3 flex items-center gap-2 text-xs md:text-sm">
          <Moon className="size-3.5 shrink-0" aria-hidden="true" />
          Ночные часы относятся к предыдущему дню
        </p>
      ) : null}
    </div>
  );
}
