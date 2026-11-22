"use client";

import { type FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { generateTemporaryPassword } from "@/lib/password-policy";
import { resetTemporaryPassword } from "../_actions";
import { CredentialsSummary, TempPasswordInput } from "./temp-password-field";
import { temporaryPasswordSchema } from "../_lib/schema";

type ResetPasswordDialogProps = { userId: string; name: string; email: string };

/** «Сбросить временный пароль» сотрудника: новый пароль, выход со всех устройств, смена при входе. */
export function ResetPasswordDialog({ userId, name, email }: ResetPasswordDialogProps) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  function handleOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) {
      // Сразу предлагаем случайный пароль — его можно заменить своим
      setPassword(generateTemporaryPassword());
      setError(null);
      setDone(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = temporaryPasswordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Проверьте пароль");
      return;
    }
    setPending(true);
    const result = await resetTemporaryPassword({ userId, password: parsed.data });
    setPending(false);
    if (!result.ok) {
      setError(result.fieldErrors?.password?.[0] ?? null);
      toast.error(result.error);
      return;
    }
    toast.success("Временный пароль задан, сеансы пользователя завершены");
    setDone(true);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={`Сбросить пароль: ${email}`}>
          <KeyRound className="h-4 w-4" aria-hidden />
          <span className="hidden lg:inline">Сбросить пароль</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{done ? "Временный пароль задан" : "Сбросить временный пароль"}</DialogTitle>
          <DialogDescription>
            {name || email}: все сеансы пользователя будут завершены, при входе нужно будет сменить
            пароль.
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <>
            <CredentialsSummary email={email} password={password} />
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Готово
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form noValidate onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={inputId}>Новый временный пароль</Label>
              <TempPasswordInput
                id={inputId}
                value={password}
                onValueChange={(value) => {
                  setPassword(value);
                  setError(null);
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                disabled={pending}
              />
              {error ? (
                <p id={errorId} className="text-destructive text-sm">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Задать пароль
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
