"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeadStatus } from "@/lib/schema/enums";
import { setLeadStatus } from "../_actions";
import { isLeadStatus, LEAD_STATUS_LABELS, LEAD_STATUSES } from "../_lib/labels";

type LeadStatusSelectProps = { id: string; status: LeadStatus };

export function LeadStatusSelect({ id, status }: LeadStatusSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Оптимистичное значение: при ошибке возвращаем серверное
  const [value, setValue] = useState<LeadStatus>(status);

  function handleChange(next: string) {
    if (!isLeadStatus(next) || next === value) return;
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await setLeadStatus({ id, status: next });
      if (!result.ok) {
        setValue(previous);
        toast.error(result.error);
        return;
      }
      toast.success(`Статус: ${LEAD_STATUS_LABELS[next]}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="lead-status">Статус заявки</Label>
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={handleChange} disabled={isPending}>
          <SelectTrigger id="lead-status" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {LEAD_STATUS_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isPending ? (
          <Loader2
            className="text-muted-foreground h-4 w-4 shrink-0 animate-spin"
            aria-label="Сохранение"
          />
        ) : null}
      </div>
    </div>
  );
}
