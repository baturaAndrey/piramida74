import { AuthCard } from "@/components/auth/auth-card"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Восстановление пароля" }

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Забыли пароль?"
      description="Укажите email администратора — мы отправим ссылку для сброса пароля"
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
