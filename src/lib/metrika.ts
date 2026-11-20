declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void;
  }
}

/** Отправляет цель в Яндекс Метрику; без счётчика (dev, тесты, блокировщик) — ничего не делает. */
export function reachGoal(goal: string): void {
  const id = Number(process.env.NEXT_PUBLIC_YM_ID);
  if (typeof window !== "undefined" && id && typeof window.ym === "function") {
    window.ym(id, "reachGoal", goal);
  }
}
