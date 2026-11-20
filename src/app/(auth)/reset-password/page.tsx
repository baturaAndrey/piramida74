import { Suspense } from "react"
import { AuthCard } from "@/components/auth/auth-card"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { Skeleton } from "@/components/ui/skeleton"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Новый пароль" }

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Новый пароль" description="Придумайте новый пароль для входа в админку">
      {/* useSearchParams в форме требует Suspense */}
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  )
}
