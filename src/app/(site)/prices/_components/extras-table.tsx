import type { PublicExtraService } from "@/lib/queries/pricing";
import { formatServicePrice } from "../_lib/format";

/** Таблица «Услуга / Стоимость» дополнительных услуг */
export function ExtrasTable({ services }: { services: PublicExtraService[] }) {
  return (
    <div className="overflow-x-auto rounded-[12px]">
      <table className="w-full border-collapse text-sm md:text-base">
        <caption className="sr-only">Дополнительные услуги</caption>
        <thead>
          <tr className="bg-table-head text-white">
            <th scope="col" className="px-4 py-3 text-left font-semibold md:px-6">
              Услуга
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold md:px-6">
              Стоимость
            </th>
          </tr>
        </thead>
        <tbody>
          {services.map((service, index) => (
            <tr key={service.id} className={index % 2 === 1 ? "bg-row-alt" : "bg-card"}>
              <th scope="row" className="px-4 py-3 text-left font-medium md:px-6">
                {service.name}
                {service.description ? (
                  <span className="text-subtle block text-xs font-normal md:text-sm">
                    {service.description}
                  </span>
                ) : null}
              </th>
              <td className="px-4 py-3 text-right font-bold whitespace-nowrap tabular-nums md:px-6">
                {formatServicePrice(service.price, service.priceUnit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
