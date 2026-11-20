import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import styles from "./primary-button.module.css";

type PrimaryButtonSize = "default" | "sm";
/** `primary` — зелёная с бликом; `outline` — на светлом фоне; `outline-light` — на тёмном (hero) */
type PrimaryButtonVariant = "primary" | "outline" | "outline-light";

type CommonProps = {
  size?: PrimaryButtonSize | undefined;
  variant?: PrimaryButtonVariant | undefined;
  className?: string | undefined;
  children: React.ReactNode;
};

type AsButtonProps = CommonProps &
  Omit<React.ComponentProps<"button">, keyof CommonProps> & {
    href?: undefined;
    /** Отрисовать стили на дочернем элементе (Radix Slot) */
    asChild?: boolean;
  };

type AsLinkProps = CommonProps &
  Omit<React.ComponentProps<typeof Link>, keyof CommonProps | "href"> & {
    href: string;
    asChild?: never;
  };

export type PrimaryButtonProps = AsButtonProps | AsLinkProps;

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 text-center font-bold whitespace-nowrap transition-colors duration-300 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0";

const SIZES: Record<PrimaryButtonSize, string> = {
  // .md-main-color-btn: высота 4.688vw (90px при 1920), шрифт — токен text-btn (12 → 29px), отступы 2.6vw (50px)
  default:
    "h-[clamp(60px,4.69vw,90px)] rounded-[clamp(8px,0.6vw,12px)] px-[clamp(24px,2.6vw,50px)] text-btn",
  // .call-back в шапке: высота 3.385vw (65px), шрифт 1vw (19px)
  sm: "h-[clamp(40px,3.385vw,65px)] rounded-[clamp(8px,0.6vw,12px)] px-6 text-[clamp(13px,1vw,19px)] leading-tight",
};

const VARIANTS: Record<PrimaryButtonVariant, string> = {
  primary: cn(
    "bg-primary text-primary-foreground hover:bg-primary-dark after:animate-blick",
    styles.shine
  ),
  outline:
    "border border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground",
  "outline-light":
    "border border-white/70 bg-white/5 text-white backdrop-blur-sm hover:border-white hover:bg-white hover:text-primary-dark",
};

/** Классы основной кнопки — для элементов, которые нельзя обернуть компонентом */
export function primaryButtonClassName({
  size = "default",
  variant = "primary",
  className,
}: Pick<CommonProps, "size" | "variant" | "className"> = {}) {
  return cn(BASE, SIZES[size], VARIANTS[variant], className);
}

function isExternalHref(href: string) {
  return /^(https?:|tel:|mailto:)/i.test(href);
}

/**
 * Крупная кнопка сайта с «бликом» (`.md-main-color-btn`).
 * `href` → ссылка (`next/link` для внутренних путей, `<a>` для внешних/tel:), иначе `<button>`;
 * `asChild` — стили на дочернем элементе (например, триггер диалога).
 */
export function PrimaryButton(props: PrimaryButtonProps) {
  if (props.href !== undefined) {
    const { href, size, variant, className, children, ...rest } = props;
    const classes = primaryButtonClassName({ size, variant, className });
    if (isExternalHref(href)) {
      // Опции навигации next/link не нужны (и недопустимы в DOM) у обычной ссылки
      const {
        prefetch: _prefetch,
        replace: _replace,
        scroll: _scroll,
        shallow: _shallow,
        passHref: _passHref,
        legacyBehavior: _legacyBehavior,
        locale: _locale,
        onNavigate: _onNavigate,
        ...anchorProps
      } = rest;
      return (
        <a href={href} className={classes} {...anchorProps}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { asChild = false, size, variant, className, children, type, ...rest } = props;
  const classes = primaryButtonClassName({ size, variant, className });
  if (asChild) {
    return (
      <Slot className={classes} {...rest}>
        {children}
      </Slot>
    );
  }
  return (
    <button type={type ?? "button"} className={classes} {...rest}>
      {children}
    </button>
  );
}
