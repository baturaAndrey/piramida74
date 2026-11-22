"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/menu", label: "Позиции", exact: true },
  { href: "/admin/menu/price-groups", label: "Сетки цен" },
  { href: "/admin/menu/modifiers", label: "Добавки" },
  { href: "/admin/menu/bulk-price", label: "Массовое изменение цен" },
] as const;

/** Под-навигация раздела «Меню» */
export function MenuNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Разделы меню" className="-mx-1 mb-6 overflow-x-auto">
      <ul className="bg-muted inline-flex min-w-max gap-1 rounded-lg p-1">
        {LINKS.map((link) => {
          const active =
            "exact" in link && link.exact
              ? pathname === link.href || pathname.startsWith(`${link.href}/items`)
              : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
                  active
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
