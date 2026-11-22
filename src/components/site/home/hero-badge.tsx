"use client";

import { cn } from "@/lib/utils";
import { useTypingPhrases } from "./use-typing-phrases";

type HeroBadgeProps = {
  phrases: string[];
  className?: string;
};

/**
 * Жёлтый бейдж первого экрана с «печатающимися» фразами и мигающим курсором.
 * Скринридеры получают все фразы сразу через `aria-label`, анимированный текст скрыт от них.
 */
export function HeroBadge({ phrases, className }: HeroBadgeProps) {
  const text = useTypingPhrases(phrases);
  if (phrases.length === 0) return null;

  return (
    <p
      className={cn(
        "bg-badge text-badge-foreground text-badge-size inline-flex min-h-[calc(1.3em+2rem)] items-center rounded-[8px] p-4 font-medium",
        className
      )}
    >
      {/* aria-label на <p> скринридеры игнорируют — полный список фраз отдаём скрытым текстом */}
      <span className="sr-only">{phrases.join(", ")}</span>
      <span aria-hidden="true">{text}</span>
      <span aria-hidden="true" className="animate-pulse">
        |
      </span>
    </p>
  );
}
