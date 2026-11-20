import { Suspense } from "react"
import { AuthCard } from "@/components/auth/auth-card"
import { AuthedRedirect } from "@/components/auth/authed-redirect"
import { LoginForm } from "@/components/auth/login-form"
import { Skeleton } from "@/components/ui/skeleton"
import type { Metadata } from "next"

// robots задаётся в (auth)/layout.tsx
export const metadata: Metadata = { title: "Вход" }

export default function LoginPage() {
  return (
    <AuthCard title="Вход в админку" description="Бильярдный клуб «Пирамида»">
      <Suspense>
        <AuthedRedirect />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  )
}
