import { cn } from "@/lib/utils";

/**
 * Выделенный блок в теле статьи: `:::info|success|warning|accent … :::`
 * (см. `remark-callout.ts`). Изоморфный компонент (без хуков и серверных импортов).
 */

export type CalloutVariant = "info" | "success" | "warning" | "accent";

const VARIANT_CLASSES: Record<CalloutVariant, string> = {
  info: "border-primary bg-primary/10",
  success: "border-success bg-success/10",
  warning: "border-badge bg-badge/20",
  accent: "border-accent-red bg-accent-red/10",
};

/** Неизвестное значение атрибута → `info`. */
function resolveVariant(value: unknown): CalloutVariant {
  return value === "success" || value === "warning" || value === "accent" ? value : "info";
}

export function Callout({ variant, children }: { variant: unknown; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        // Последний отступ обрезается; «Перейти к оглавлению» внутри блока не нужна
        "text-foreground my-6 rounded-lg border p-4 [&_a[href='#toc']]:hidden [&>*:last-child]:mb-0",
        VARIANT_CLASSES[resolveVariant(variant)]
      )}
    >
      {children}
    </div>
  );
}
