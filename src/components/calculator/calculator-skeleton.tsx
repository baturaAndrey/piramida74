import { Skeleton } from "@/components/ui/skeleton";

/** Скелетон страницы калькулятора: слева 4 карточки шагов, справа смета */
export function CalculatorSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]"
      aria-busy="true"
      aria-label="Загрузка калькулятора"
    >
      <div className="min-w-0 space-y-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-card space-y-4 rounded-lg border p-4 shadow-sm sm:p-6">
            <Skeleton className="h-6 w-48" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-card space-y-4 self-start rounded-lg border p-6 shadow-sm">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
