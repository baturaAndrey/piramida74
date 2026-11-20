import { Suspense } from "react";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/session";
import { ChangePasswordForm } from "./_components/change-password-form";
import { TwoFactorCard } from "./_components/two-factor-card";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Аккаунт" };

async function AccountContent() {
  const session = await requireAdmin();
  const { email, twoFactorEnabled } = session.user;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Аккаунт" description={email} />
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Смена пароля</CardTitle>
          <CardDescription>
            После смены пароля все остальные сеансы входа будут завершены.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm email={email} />
        </CardContent>
      </Card>
      <TwoFactorCard enabled={twoFactorEnabled === true} email={email} />
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AccountContent />
    </Suspense>
  );
}
