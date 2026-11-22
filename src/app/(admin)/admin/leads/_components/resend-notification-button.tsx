"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { NotifyChannelStatus } from "@/lib/schema";
import { resendLeadNotification } from "../_actions";

type ResendNotificationButtonProps = { id: string; anonymized: boolean };

function describe(name: string, status: NotifyChannelStatus | undefined): string {
  if (!status) return `${name}: нет данных`;
  if (status.ok) return `${name}: отправлено`;
  return `${name}: ошибка${status.error ? ` (${status.error})` : ""}`;
}

export function ResendNotificationButton({ id, anonymized }: ResendNotificationButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await resendLeadNotification({ id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { email, telegram } = result.data;
      const summary = `${describe("Email", email)}; ${describe("Telegram", telegram)}`;
      if (email?.ok && telegram?.ok) toast.success("Уведомления отправлены");
      else if (email?.ok || telegram?.ok) toast.warning(summary);
      else toast.error(summary);
      router.refresh();
    });
  }

  if (anonymized) {
    return (
      <Button type="button" variant="outline" size="sm" disabled>
        <RefreshCw className="h-4 w-4" aria-hidden />
        Повторить уведомление — данные удалены
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="h-4 w-4" aria-hidden />
      )}
      Повторить уведомление
    </Button>
  );
}
