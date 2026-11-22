import { NuqsAdapter } from "nuqs/adapters/next/app";

/** NuqsAdapter только вокруг калькулятора: остальной сайт состояние в URL через nuqs не хранит */
export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return <NuqsAdapter>{children}</NuqsAdapter>;
}
