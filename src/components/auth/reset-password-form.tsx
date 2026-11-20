"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPassword } from "@/lib/auth-client"

/** Совпадает с emailAndPassword.minPasswordLength в src/lib/auth.ts и scripts/seed-admin.ts. */
const MIN_PASSWORD_LENGTH = 10

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const error = searchParams.get("error")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [formError, setFormError] = useState("")
  const [isPending, setIsPending] = useState(false)

  if (error === "invalid_token" || !token) {
    return (
      <div className="space-y-4 text-center">
        <p role="alert" className="text-sm text-destructive">
          {error === "invalid_token"
            ? "Ссылка для сброса пароля недействительна или устарела."
            : "В ссылке нет токена сброса пароля."}
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">Запросить новую ссылку</Link>
        </Button>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Минимум ${MIN_PASSWORD_LENGTH} символов`)
      return
    }

    if (password !== confirmPassword) {
      setFormError("Пароли не совпадают")
      return
    }

    setIsPending(true)

    try {
      const result = await resetPassword({ newPassword: password, token })

      if (result.error) {
        setFormError(
          result.error.code === "INVALID_TOKEN"
            ? "Ссылка для сброса пароля недействительна или устарела. Запросите новую"
            : "Не удалось сменить пароль. Попробуйте ещё раз"
        )
      } else {
        router.replace("/login?reset=success")
      }
    } catch {
      setFormError("Не удалось сменить пароль. Попробуйте ещё раз")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Новый пароль</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isPending}
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          Минимум {MIN_PASSWORD_LENGTH} символов
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Повторите пароль</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isPending}
        />
      </div>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Сохранение…" : "Сохранить пароль"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Вспомнили пароль?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Войти
        </Link>
      </p>
    </form>
  )
}
