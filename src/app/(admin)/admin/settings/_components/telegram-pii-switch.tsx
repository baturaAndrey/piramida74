"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setTelegramPii } from "../_actions";

const WARNING =
  "Telegram хранит данные за пределами РФ. Включая этот флаг, вы осознанно соглашаетесь на трансграничную передачу персональных данных клиентов. По умолчанию выключено.";

/** Отдельный от основной формы переключатель ПДн в Telegram: включение — только через подтверждение. */
export function TelegramPiiSwitch({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(enabled);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();

  function apply(next: boolean, withConfirmation: boolean) {
    startTransition(async () => {
      const result = await setTelegramPii({ enabled: next, confirmed: withConfirmation });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setChecked(result.data.enabled);
      setDialogOpen(false);
      toast.success(
        result.data.enabled
          ? "Имя и телефон будут приходить в Telegram"
          : "Имя и телефон больше не отправляются в Telegram"
      );
      router.refresh();
    });
  }

  function handleToggle(next: boolean) {
    if (next) {
      setConfirmed(false);
      setDialogOpen(true);
      return;
    }
    // Выключение безопасно — без подтверждения
    apply(false, false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Уведомления в Telegram</CardTitle>
        <CardDescription>
          По умолчанию в Telegram приходят только номер заявки, тип и ссылка на админку.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <Switch
            id="telegram-pii"
            checked={checked}
            disabled={pending}
            onCheckedChange={handleToggle}
          />
          <Label htmlFor="telegram-pii" className="leading-snug">
            Включать имя и телефон в Telegram-уведомления
          </Label>
        </div>
        <p className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {WARNING}
        </p>
      </CardContent>

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!pending) setDialogOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Передавать имя и телефон в Telegram?</AlertDialogTitle>
            <AlertDialogDescription>{WARNING}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-2">
            <Checkbox
              id="telegram-pii-confirm"
              checked={confirmed}
              disabled={pending}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            <Label htmlFor="telegram-pii-confirm" className="leading-snug font-normal">
              Я понимаю и беру ответственность
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
            <Button
              type="button"
              disabled={!confirmed || pending}
              onClick={() => apply(true, true)}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Включить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
