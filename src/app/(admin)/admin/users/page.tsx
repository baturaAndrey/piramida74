import { Suspense } from "react";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireOwner } from "@/lib/session";
import { CreateUserDialog } from "./_components/create-user-dialog";
import { UsersTable } from "./_components/users-table";
import { listPanelUsers } from "./_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Пользователи" };

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <UsersContent />
    </Suspense>
  );
}

async function UsersContent() {
  // Только главный админ; сотруднику — 404 (раздел для него не существует)
  const session = await requireOwner();
  const rows = await listPanelUsers();
  const ownerCount = rows.filter((row) => row.level === "owner").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Пользователи"
        description="Доступ в админку: главный админ управляет пользователями, сотрудники — всем остальным"
        actions={<CreateUserDialog />}
      />
      <UsersTable rows={rows} currentUserId={session.user.id} ownerCount={ownerCount} />
    </div>
  );
}
