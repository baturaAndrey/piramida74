import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { count, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import { leads } from "@/lib/schema";
import { requireAdmin } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Админка", template: "%s · Админка" },
  robots: { index: false, follow: false },
};

/** Защита «в глубину»: страницы всё равно обязаны сами вызывать `requireAdmin()` первой строкой. */
async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

/** Число новых заявок (без кэша); 0 — бейдж не показывается. */
async function NewLeadsBadge() {
  await connection();
  await requireAdmin();
  const [row] = await db.select({ value: count() }).from(leads).where(eq(leads.status, "new"));
  const total = row?.value ?? 0;
  if (total === 0) return null;
  return (
    <Badge className="px-1.5 py-0 tabular-nums" aria-label={`Новых заявок: ${total}`}>
      {total > 99 ? "99+" : total}
    </Badge>
  );
}

async function SidebarUser() {
  const session = await requireAdmin();
  return <AdminUserMenu name={session.user.name} email={session.user.email} />;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AdminSidebar
        leadsBadge={
          <Suspense fallback={null}>
            <NewLeadsBadge />
          </Suspense>
        }
        userMenu={
          <Suspense fallback={<Skeleton className="h-10 w-full" />}>
            <SidebarUser />
          </Suspense>
        }
      />
      <SidebarInset>
        <header className="bg-background/95 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur md:px-6">
          <SidebarTrigger className="-ml-1" aria-label="Показать или скрыть меню" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 ml-auto inline-flex items-center gap-1.5 rounded-md text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
          >
            Открыть сайт
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </header>
        <div className="flex-1 p-4 md:p-6">
          <Suspense fallback={<AdminPageSkeleton />}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
