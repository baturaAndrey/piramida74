import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSession, isStaffSession, mustChangePassword } from "@/lib/session";
import { ChangeTemporaryPasswordForm } from "./_components/change-temporary-password-form";
import type { Metadata } from "next";

// robots задаётся в (auth)/layout.tsx
export const metadata: Metadata = { title: "Смена временного пароля" };

/**
 * Единственная страница, доступная с временным паролем: `requireStaff()` уводит сюда со всех
 * страниц админки, а Server Actions админки отказывают, пока флаг не снят.
 * Страница вне layout админки — иначе его guard зациклил бы редирект.
 */
export default function ChangePasswordPage() {
  return (
    <AuthCard
      title="Смените временный пароль"
      description="Пароль выдал администратор. Придумайте свой, чтобы продолжить работу"
    >
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ChangePasswordContent />
      </Suspense>
    </AuthCard>
  );
}

async function ChangePasswordContent() {
  const session = await getSession();
  if (!isStaffSession(session)) redirect("/login");
  if (!mustChangePassword(session)) redirect("/admin");

  return (
    <div className="space-y-4">
      <p className="text-subtle text-center text-sm break-all">{session.user.email}</p>
      <ChangeTemporaryPasswordForm email={session.user.email} />
      <SignOutButton className="w-full" />
    </div>
  );
}
