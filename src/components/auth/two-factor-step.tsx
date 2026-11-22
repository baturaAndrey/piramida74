"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { twoFactor } from "@/lib/auth-client"

const TOTP_LENGTH = 6
const TOO_MANY_REQUESTS = 429

interface TwoFactorStepProps {
  /** Вызывается после успешной проверки второго фактора. */
  onSuccess: () => void
  /** Возврат к форме email/пароль. */
  onBack: () => void
}

export function TwoFactorStep({ onSuccess, onBack }: TwoFactorStepProps) {
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [code, setCode] = useState("")
  const [trustDevice, setTrustDevice] = useState(false)
  const [error, setError] = useState("")
  const [isPending, setIsPending] = useState(false)

  const toggleMode = () => {
    setUseBackupCode((v) => !v)
    setCode("")
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const trimmed = code.trim()
    if (!useBackupCode && !new RegExp(`^\\d{${TOTP_LENGTH}}$`).test(trimmed)) {
      setError(`Введите ${TOTP_LENGTH} цифр из приложения`)
      return
    }
    if (useBackupCode && trimmed.length === 0) {
      setError("Введите резервный код")
      return
    }

    setIsPending(true)
    try {
      const result = useBackupCode
        ? await twoFactor.verifyBackupCode({ code: trimmed, trustDevice })
        : await twoFactor.verifyTotp({ code: trimmed, trustDevice })

      if (result.error) {
        setError(
          result.error.status === TOO_MANY_REQUESTS
            ? "Слишком много попыток. Подождите минуту"
            : "Неверный код"
        )
        return
      }
      onSuccess()
    } catch {
      setError("Не удалось проверить код. Попробуйте ещё раз")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        {useBackupCode
          ? "Введите один из резервных кодов, сохранённых при включении двухфакторной защиты."
          : "Введите 6-значный код из приложения-аутентификатора."}
      </p>
      <div className="space-y-2">
        <Label htmlFor="two-factor-code">{useBackupCode ? "Резервный код" : "Код"}</Label>
        {useBackupCode ? (
          <Input
            id="two-factor-code"
            autoComplete="off"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={isPending}
            aria-invalid={error ? true : undefined}
          />
        ) : (
          <Input
            id="two-factor-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={TOTP_LENGTH}
            autoFocus
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            disabled={isPending}
            aria-invalid={error ? true : undefined}
            className="tracking-widest"
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="trust-device"
          checked={trustDevice}
          onCheckedChange={(checked) => setTrustDevice(checked === true)}
          disabled={isPending}
        />
        <Label htmlFor="trust-device" className="font-normal">
          Доверять этому устройству 30 дней
        </Label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Проверка…" : "Подтвердить"}
      </Button>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={isPending}>
          Назад
        </Button>
        <Button type="button" variant="link" size="sm" onClick={toggleMode} disabled={isPending}>
          {useBackupCode ? "Использовать код из приложения" : "Использовать резервный код"}
        </Button>
      </div>
    </form>
  )
}
