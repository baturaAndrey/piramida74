export type NavItem = {
  label: string;
  href: string;
};

/**
 * Пункты меню сайта. Якоря — абсолютные (`/#...`), чтобы с внутренних страниц
 * вести на главную с прокруткой к секции.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Акции", href: "/#discount" },
  { label: "Услуги клуба", href: "/#service" },
  { label: "Турниры", href: "/#reasons" },
  { label: "Бар и кухня", href: "/#portfolio" },
  { label: "Прайс-лист", href: "/#price" },
  { label: "Меню", href: "/menu" },
  { label: "Калькулятор", href: "/calculator" },
  { label: "Блог", href: "/blog" },
  { label: "Контакты", href: "/#contacts" },
];

/** Активен только пункт-страница (`/menu`, `/calculator`, `/blog/*`), якоря — никогда */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
