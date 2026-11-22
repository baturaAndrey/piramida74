"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordReset } from "@/lib/auth-client"

const TOO_MANY_REQUESTS = 429

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsPending(true)

    try {
      const result = await requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      })

      if (result.error) {
        setError(
          result.error.status === TOO_MANY_REQUESTS
            ? "Слишком много попыток. Подождите несколько минут"
            : "Не удалось отправить ссылку. Попробуйте ещё раз"
        )
      } else {
        setSuccess(true)
      }
    } catch {
      setError("Не удалось отправить ссылку. Попробуйте ещё раз")
    } finally {
      setIsPending(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <p role="status" className="text-sm text-muted-foreground">
          Если аккаунт с таким email существует, мы отправили письмо со ссылкой для сброса
          пароля. Ссылка действует 1 час.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Вернуться ко входу</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="admin@example.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isPending}
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Отправка…" : "Отправить ссылку"}
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
