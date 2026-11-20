"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Copy,
  Download,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { useForm } from "react-hook-form";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const QR_SIZE = 192;
const TOTP_DIGITS = 6;
const HTTP_TOO_MANY_REQUESTS = 429;
const BACKUP_CODES_FILENAME = "piramida-admin-2fa-backup-codes.txt";
/** Группы по 4 символа — секрет проще переписать вручную */
const SECRET_GROUP_RE = /(.{4})(?!$)/g;

type AuthError = { status?: number; code?: string | undefined; message?: string | undefined };

/** Ошибка better-auth → понятный русский текст. */
function describeAuthError(error: AuthError, fallback: string): string {
  if (error.status === HTTP_TOO_MANY_REQUESTS) {
    return "Слишком много попыток. Подождите минуту и попробуйте снова";
  }
  switch (error.code) {
    case "INVALID_PASSWORD":
      return "Неверный пароль";
    case "INVALID_CODE":
      return "Неверный код. Проверьте время на телефоне и введите новый код";
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
    case "ACCOUNT_TEMPORARILY_LOCKED":
      return "Слишком много неверных попыток. Попробуйте позже";
    case "UNAUTHORIZED":
      return "Сеанс истёк. Войдите заново";
    default:
      return fallback;
  }
}

/** Параметр `secret` из `otpauth://totp/…?secret=…` — для ручного ввода в приложение. */
function secretFromTotpUri(uri: string): string {
  const match = /[?&]secret=([^&#]+)/.exec(uri);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("Не удалось скопировать — выделите текст вручную");
  }
}

function downloadBackupCodes(codes: string[], email: string) {
  const content = [
    "Резервные коды 2FA — админка «Пирамида»",
    `Аккаунт: ${email}`,
    "Каждый код можно использовать один раз.",
    "",
    ...codes,
    "",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = BACKUP_CODES_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Диалог подтверждения паролем (включение, отключение, новые резервные коды)
// ---------------------------------------------------------------------------

const passwordSchema = z.object({ password: z.string().min(1, "Введите пароль") });
type PasswordValues = z.infer<typeof passwordSchema>;

type PasswordAction = "enable" | "disable" | "regenerate";

const PASSWORD_DIALOGS: Record<
  PasswordAction,
  { title: string; description: string; confirmLabel: string; destructive: boolean }
> = {
  enable: {
    title: "Включение 2FA",
    description: "Введите текущий пароль, чтобы получить QR-код для приложения-аутентификатора.",
    confirmLabel: "Продолжить",
    destructive: false,
  },
  disable: {
    title: "Отключить 2FA?",
    description: "Вход будет защищён только паролем. Резервные коды перестанут действовать.",
    confirmLabel: "Отключить",
    destructive: true,
  },
  regenerate: {
    title: "Новые резервные коды",
    description: "Старые резервные коды перестанут действовать. Введите текущий пароль.",
    confirmLabel: "Создать коды",
    destructive: false,
  },
};

type PasswordDialogProps = {
  action: PasswordAction | null;
  email: string;
  onClose: () => void;
  /** Возвращает текст ошибки или `null` при успехе (тогда диалог закрывается) */
  onSubmit: (action: PasswordAction, password: string) => Promise<string | null>;
};

function PasswordDialog({ action, email, onClose, onSubmit }: PasswordDialogProps) {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "" },
  });
  const submitting = form.formState.isSubmitting;
  const config = action ? PASSWORD_DIALOGS[action] : null;

  async function handleSubmit(values: PasswordValues) {
    if (!action) return;
    const error = await onSubmit(action, values.password);
    if (error) {
      form.setError("password", { message: error });
      return;
    }
    form.reset({ password: "" });
    onClose();
  }

  return (
    <Dialog
      open={action !== null}
      onOpenChange={(open) => {
        if (open || submitting) return;
        form.reset({ password: "" });
        onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        {config ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" noValidate>
              <DialogHeader>
                <DialogTitle>{config.title}</DialogTitle>
                <DialogDescription>{config.description}</DialogDescription>
              </DialogHeader>
              <input
                type="email"
                name="username"
                autoComplete="username"
                value={email}
                readOnly
                hidden
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пароль</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => {
                    form.reset({ password: "" });
                    onClose();
                  }}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  variant={config.destructive ? "destructive" : "default"}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {config.confirmLabel}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Шаг настройки: QR-код, секрет и проверка первого кода
// ---------------------------------------------------------------------------

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${TOTP_DIGITS}}$`), `Введите ${TOTP_DIGITS} цифр из приложения`),
});
type CodeValues = z.infer<typeof codeSchema>;

type SetupStepProps = {
  totpURI: string;
  onVerified: () => void;
  onCancel: () => void;
};

function SetupStep({ totpURI, onVerified, onCancel }: SetupStepProps) {
  const secret = secretFromTotpUri(totpURI);
  const form = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });
  const submitting = form.formState.isSubmitting;

  async function verify(values: CodeValues) {
    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code: values.code });
      if (error) {
        form.setError("code", { message: describeAuthError(error, "Не удалось проверить код") });
        return;
      }
      onVerified();
    } catch {
      form.setError("code", { message: "Нет связи с сервером. Попробуйте ещё раз" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Белый фон и в тёмной теме — иначе сканеры не читают код */}
        <div className="w-fit shrink-0 rounded-lg border bg-white p-4">
          <QRCode value={totpURI} size={QR_SIZE} title="QR-код для приложения-аутентификатора" />
        </div>
        <div className="min-w-0 space-y-3 text-sm">
          <p>
            Отсканируйте QR-код в приложении-аутентификаторе (Яндекс Ключ, Google Authenticator,
            1Password и т. п.).
          </p>
          <div className="space-y-2">
            <p className="text-muted-foreground">Или введите ключ вручную:</p>
            <div className="flex items-start gap-2">
              <code className="bg-muted min-w-0 flex-1 rounded-md p-2 font-mono text-xs leading-5 break-all">
                {secret.replace(SECRET_GROUP_RE, "$1 ")}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyText(secret, "Ключ скопирован")}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Скопировать
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(verify)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem className="max-w-xs">
                <FormLabel>Код из приложения</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={TOTP_DIGITS}
                    placeholder="123456"
                    className="font-mono tracking-widest"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Подтвердить и включить
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Резервные коды (показываются один раз)
// ---------------------------------------------------------------------------

function BackupCodes({
  codes,
  email,
  onDone,
}: {
  codes: string[];
  email: string;
  onDone: () => void;
}) {
  return (
    <div className="space-y-4">
      <div
        role="alert"
        className="border-badge bg-badge/15 text-badge-foreground flex items-start gap-2 rounded-lg border p-4 text-sm"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <span className="font-semibold">Сохраните — повторно не покажутся.</span> Каждый резервный
          код позволяет войти один раз, если телефон с приложением недоступен.
        </p>
      </div>
      <ul className="bg-muted grid grid-cols-2 gap-2 rounded-md p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code} className="break-all">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="outline"
          onClick={() => copyText(codes.join("\n"), "Резервные коды скопированы")}
        >
          <Copy className="h-4 w-4" aria-hidden />
          Скопировать
        </Button>
        <Button type="button" variant="outline" onClick={() => downloadBackupCodes(codes, email)}>
          <Download className="h-4 w-4" aria-hidden />
          Скачать .txt
        </Button>
        <Button type="button" onClick={onDone} className="sm:ml-auto">
          Я сохранил коды
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Карточка 2FA
// ---------------------------------------------------------------------------

type View =
  | { kind: "status" }
  | { kind: "setup"; totpURI: string; backupCodes: string[] }
  | { kind: "codes"; backupCodes: string[] };

export type TwoFactorCardProps = {
  /** `session.user.twoFactorEnabled` */
  enabled: boolean;
  email: string;
};

export function TwoFactorCard({ enabled, email }: TwoFactorCardProps) {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "status" });
  const [passwordAction, setPasswordAction] = useState<PasswordAction | null>(null);

  async function runPasswordAction(action: PasswordAction, password: string) {
    try {
      if (action === "enable") {
        const { data, error } = await authClient.twoFactor.enable({ password });
        if (error) return describeAuthError(error, "Не удалось начать настройку 2FA");
        setView({ kind: "setup", totpURI: data.totpURI, backupCodes: data.backupCodes });
        return null;
      }
      if (action === "disable") {
        const { error } = await authClient.twoFactor.disable({ password });
        if (error) return describeAuthError(error, "Не удалось отключить 2FA");
        setView({ kind: "status" });
        toast.success("2FA отключена");
        router.refresh();
        return null;
      }
      const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
      if (error) return describeAuthError(error, "Не удалось создать резервные коды");
      setView({ kind: "codes", backupCodes: data.backupCodes });
      toast.success("Новые резервные коды созданы");
      return null;
    } catch {
      return "Нет связи с сервером. Попробуйте ещё раз";
    }
  }

  function handleVerified(backupCodes: string[]) {
    setView({ kind: "codes", backupCodes });
    toast.success("2FA включена");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl">Двухфакторная аутентификация</CardTitle>
          {enabled ? (
            <Badge variant="outline" className="text-success">
              Включена
            </Badge>
          ) : (
            <Badge variant="secondary">Выключена</Badge>
          )}
        </div>
        <CardDescription>
          Кроме пароля при входе запрашивается одноразовый код из приложения на телефоне.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {view.kind === "setup" ? (
          <SetupStep
            totpURI={view.totpURI}
            onVerified={() => handleVerified(view.backupCodes)}
            onCancel={() => setView({ kind: "status" })}
          />
        ) : view.kind === "codes" ? (
          <BackupCodes
            codes={view.backupCodes}
            email={email}
            onDone={() => setView({ kind: "status" })}
          />
        ) : enabled ? (
          <p className="text-success flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            2FA включена
          </p>
        ) : (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <ShieldOff className="h-4 w-4" aria-hidden />
            Вход защищён только паролем. Рекомендуем включить 2FA.
          </p>
        )}
      </CardContent>

      {view.kind === "status" ? (
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          {enabled ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setPasswordAction("regenerate")}
              >
                <KeyRound className="h-4 w-4" aria-hidden />
                Новые резервные коды
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setPasswordAction("disable")}
              >
                Отключить
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => setPasswordAction("enable")}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Включить 2FA
            </Button>
          )}
        </CardFooter>
      ) : null}

      <PasswordDialog
        action={passwordAction}
        email={email}
        onClose={() => setPasswordAction(null)}
        onSubmit={runPasswordAction}
      />
    </Card>
  );
}
