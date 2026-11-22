import { cn } from "@/lib/utils";

type ContainerProps<T extends React.ElementType> = {
  /** Тег-обёртка, по умолчанию `div` */
  as?: T;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

/**
 * Основной контейнер сайта: рамка до 1920px по центру с боковым полем `--gutter`
 * (70 / 40 / 24 / 16px на ≥1366 / 1101–1365 / 600–1100 / ≤599). Утилита `container-site` из `globals.css`.
 */
export function Container<T extends React.ElementType = "div">({
  as,
  className,
  children,
  ...props
}: ContainerProps<T>) {
  const Comp: React.ElementType = as ?? "div";
  return (
    <Comp className={cn("container-site", className)} {...props}>
      {children}
    </Comp>
  );
}
