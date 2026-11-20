import { cn } from "@/lib/utils";

type ContainerProps<T extends React.ElementType> = {
  /** Тег-обёртка, по умолчанию `div` */
  as?: T;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

/**
 * Основной контейнер сайта (`.wrapper` старого сайта): 86vw на мобильных, 81vw с `md`,
 * не шире 1552px. Значения — утилита `container-site` из `globals.css`.
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
