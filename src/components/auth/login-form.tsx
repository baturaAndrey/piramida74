"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { TwoFactorStep } from "@/components/auth/two-factor-step"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { signIn } from "@/lib/auth-client"

const DEFAULT_REDIRECT = "/admin"
const TOO_MANY_REQUESTS = 429

/** Защита от open redirect: только пути внутри /admin, без `//` и `\`. */
function getSafeNext(next: string | null): string {
  if (!next || !next.startsWith("/admin") || next.includes("//") || next.includes("\\")) {
    return DEFAULT_REDIRECT
  }
  return next
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const safeNext = getSafeNext(searchParams.get("next"))
  const resetSuccess = searchParams.get("reset") === "success"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isPending, setIsPending] = useState(false)
  const [twoFactorRequired, setTwoFactorRequired] = useState(false)

  const goToAdmin = () => {
    router.replace(safeNext)
    router.refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsPending(true)

    try {
      const result = await signIn.email({ email: email.trim(), password })

      if (result.error) {
        // Не раскрываем, что именно неверно: email или пароль
        setError(
          result.error.status === TOO_MANY_REQUESTS
            ? "Слишком много попыток. Подождите минуту"
            : "Неверный email или пароль"
        )
        return
      }

      if ((result.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
        setPassword("")
        setTwoFactorRequired(true)
        return
      }

      goToAdmin()
    } catch {
      setError("Не удалось выполнить вход. Попробуйте ещё раз")
    } finally {
      setIsPending(false)
    }
  }

  if (twoFactorRequired) {
    return <TwoFactorStep onSuccess={goToAdmin} onBack={() => setTwoFactorRequired(false)} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {resetSuccess ? (
        <p role="status" className="text-sm text-green-600">
          Пароль изменён, войдите с новым паролем
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="admin@example.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isPending}
          aria-invalid={error ? true : undefined}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">Пароль</Label>
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            Забыли пароль?
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {isPending ? "Вход…" : "Войти"}
      </Button>
    </form>
  )
}
