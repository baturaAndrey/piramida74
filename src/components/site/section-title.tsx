import { cn } from "@/lib/utils";

type SectionTitleProps = {
  /** `h1` — крупнее (24 → 65px), остальные — размер H2 секции (20 → 60px) */
  as?: "h1" | "h2" | "h3";
  align?: "left" | "center";
  className?: string;
  children: React.ReactNode;
};

/** Токены типографики из globals.css (размер и line-height) */
const SIZE_CLASS = {
  h1: "text-h1",
  h2: "text-h2",
} as const;

/** Заголовок секции сайта (`.md-main-title` старого сайта). */
export function SectionTitle({
  as: Tag = "h2",
  align = "left",
  className,
  children,
}: SectionTitleProps) {
  return (
    <Tag
      className={cn(
        "text-foreground font-semibold",
        Tag === "h1" ? SIZE_CLASS.h1 : SIZE_CLASS.h2,
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </Tag>
  );
}
