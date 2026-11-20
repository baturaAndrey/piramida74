"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  ConciergeBell,
  FileImage,
  FileText,
  Images,
  Inbox,
  LayoutDashboard,
  Newspaper,
  PartyPopper,
  Percent,
  Settings,
  Trophy,
  UserCog,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

type NavChild = {
  title: string;
  href: string;
  /** Точное совпадение — для подпункта, совпадающего с родительским разделом */
  exact?: boolean;
};
type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Точное совпадение пути (для «Сводки», иначе она активна на всех страницах) */
  exact?: boolean;
  badge?: "leads";
  children?: NavChild[];
};

const NAV_ITEMS: NavItem[] = [
  { title: "Сводка", href: "/admin", icon: LayoutDashboard, exact: true },
  { title: "Заявки", href: "/admin/leads", icon: Inbox, badge: "leads" },
  {
    title: "Турниры",
    href: "/admin/tournaments",
    icon: Trophy,
    children: [
      // exact: иначе «Турниры» подсвечивались бы и на /admin/tournaments/series
      { title: "Все турниры", href: "/admin/tournaments", exact: true },
      { title: "Серии", href: "/admin/tournaments/series" },
    ],
  },
  { title: "Акции", href: "/admin/promotions", icon: Percent },
  { title: "Цены", href: "/admin/pricing", icon: Banknote },
  { title: "Услуги", href: "/admin/services", icon: ConciergeBell },
  { title: "Меню", href: "/admin/menu", icon: UtensilsCrossed },
  { title: "Банкетные сеты", href: "/admin/banquet-sets", icon: PartyPopper },
  { title: "Галереи", href: "/admin/galleries", icon: Images },
  {
    title: "Блог",
    href: "/admin/blog",
    icon: Newspaper,
    children: [
      { title: "Статьи", href: "/admin/blog/articles" },
      { title: "Рубрики", href: "/admin/blog/rubrics" },
      { title: "Теги", href: "/admin/blog/tags" },
      { title: "Авторы", href: "/admin/blog/authors" },
    ],
  },
  { title: "Медиатека", href: "/admin/media", icon: FileImage },
  { title: "Настройки", href: "/admin/settings", icon: Settings },
  { title: "Юр. документы", href: "/admin/legal", icon: FileText },
  { title: "Аккаунт", href: "/admin/account", icon: UserCog },
];

/** `/admin/menu` активен на `/admin/menu/…`, но не на `/admin/menu-something` */
function isActivePath(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type AdminSidebarProps = {
  /** Бейдж числа новых заявок (серверный компонент в Suspense) */
  leadsBadge?: ReactNode;
  /** Пользователь и выход (серверный компонент в Suspense) */
  userMenu?: ReactNode;
};

export function AdminSidebar({ leadsBadge, userMenu }: AdminSidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  // На мобильных меню — выезжающая панель: закрываем её после перехода
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <Link
          href="/admin"
          onClick={closeMobile}
          className="focus-visible:ring-sidebar-ring rounded-md px-2 py-1.5 text-base font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          Пирамида · админка
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.href, item.exact);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link
                        href={item.href}
                        onClick={closeMobile}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon className="h-4 w-4" aria-hidden />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge === "leads" && leadsBadge ? (
                      <SidebarMenuBadge>{leadsBadge}</SidebarMenuBadge>
                    ) : null}
                    {item.children ? (
                      <SidebarMenuSub>
                        {item.children.map((child) => {
                          const childActive = isActivePath(pathname, child.href, child.exact);
                          return (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton asChild isActive={childActive}>
                                <Link
                                  href={child.href}
                                  onClick={closeMobile}
                                  aria-current={childActive ? "page" : undefined}
                                >
                                  <span>{child.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>{userMenu}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
