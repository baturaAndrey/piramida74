"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { generateTemporaryPassword } from "@/lib/password-policy";

type TempPasswordInputProps = Omit<ComponentProps<typeof PasswordInput>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * Поле временного пароля + «Сгенерировать». Пропсы (id, aria-* от FormControl) уходят
 * в сам input, поэтому поле работает с `<FormControl>` как обычный PasswordInput.
 */
export function TempPasswordInput({
  value,
  onValueChange,
  disabled,
  ...props
}: TempPasswordInputProps) {
  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <PasswordInput
          autoComplete="new-password"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          disabled={disabled}
          {...props}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        disabled={disabled}
        onClick={() => onValueChange(generateTemporaryPassword())}
      >
        <KeyRound className="h-4 w-4" aria-hidden />
        Сгенерировать
      </Button>
    </div>
  );
}

const COPIED_RESET_MS = 2000;

/** Итог после создания/сброса: email и временный пароль для передачи сотруднику. */
export function CredentialsSummary({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  // Сброс «Скопировано»: таймер снимается при размонтировании
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        `Вход: ${location.origin}/login\nEmail: ${email}\nВременный пароль: ${password}`
      );
      setCopied(true);
    } catch {
      toast.error("Не удалось скопировать — выделите и скопируйте вручную");
    }
  }

  return (
    <div className="space-y-4">
      <dl className="bg-muted space-y-3 rounded-lg border p-4 text-sm">
        <div className="space-y-0.5">
          <dt className="text-subtle text-xs">Email</dt>
          <dd className="font-medium break-all">{email}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-subtle text-xs">Временный пароль</dt>
          <dd className="font-mono font-medium break-all" data-testid="temp-password">
            {password}
          </dd>
        </div>
      </dl>
      <p className="text-subtle text-sm">
        Передайте данные сотруднику лично или в мессенджере. При первом входе админка попросит
        сменить временный пароль; после закрытия окна пароль больше не показывается.
      </p>
      <Button type="button" variant="outline" onClick={() => void handleCopy()}>
        {copied ? (
          <Check className="text-success h-4 w-4" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        {copied ? "Скопировано" : "Скопировать данные для входа"}
      </Button>
    </div>
  );
}
