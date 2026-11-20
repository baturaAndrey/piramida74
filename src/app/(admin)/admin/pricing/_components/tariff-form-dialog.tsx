"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Hall, RentalTariff } from "@/lib/schema";
import { saveTariff } from "../_actions";
import {
  ALL_DAYS,
  AUDIENCE_LABELS,
  DAY_DISPLAY_ORDER,
  DAY_SHORT,
  describeInterval,
  FRI_SAT,
  SUN_THU,
  TARIFF_UNIT_LABELS,
} from "../_lib/labels";
import { tariffSchema, type TariffInput, type TariffValues } from "../_schema";
import { showHoleWarnings } from "./tariff-warnings";
import { TimeSelect } from "./time-select";

/** Значения по умолчанию для нового тарифа: Вс–Чт, 09:00–16:00 */
const DEFAULT_START_MIN = 0;
const DEFAULT_END_MIN = 420;

const QUICK_DAYS = [
  { label: "Вс–Чт", days: SUN_THU },
  { label: "Пт–Сб", days: FRI_SAT },
  { label: "Ежедневно", days: ALL_DAYS },
] as const;

type TariffFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  halls: Pick<Hall, "id" | "name">[];
  /** `null` — создание нового тарифа */
  tariff: RentalTariff | null;
  /** Зал по умолчанию для нового тарифа */
  defaultHallId?: string | undefined;
};

export function TariffFormDialog({
  open,
  onOpenChange,
  halls,
  tariff,
  defaultHallId,
}: TariffFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tariff ? "Изменить тариф" : "Новый тариф"}</DialogTitle>
          <DialogDescription>
            Время задаётся в операционных сутках: с 09:00 до 09:00 следующего дня.
          </DialogDescription>
        </DialogHeader>
        {/* Форма монтируется заново при каждом открытии — значения всегда свежие */}
        {open ? (
          <TariffForm
            halls={halls}
            tariff={tariff}
            defaultHallId={defaultHallId}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function toDefaults(tariff: RentalTariff | null, fallbackHallId: string): TariffInput {
  if (!tariff) {
    return {
      hallId: fallbackHallId,
      daysOfWeek: [...SUN_THU],
      startMin: DEFAULT_START_MIN,
      endMin: DEFAULT_END_MIN,
      price: 0,
      priceUnit: "per_hour",
      audience: "all",
      label: "",
      validFrom: "",
      validTo: "",
      isActive: true,
    };
  }
  return {
    id: tariff.id,
    hallId: tariff.hallId,
    daysOfWeek: [...tariff.daysOfWeek],
    startMin: tariff.startMin,
    endMin: tariff.endMin,
    price: tariff.price,
    // per_session в тарифах не используется; встретившийся в БД — показываем как fixed
    priceUnit: tariff.priceUnit === "per_hour" ? "per_hour" : "fixed",
    audience: tariff.audience,
    label: tariff.label,
    validFrom: tariff.validFrom ?? "",
    validTo: tariff.validTo ?? "",
    isActive: tariff.isActive,
  };
}

function TariffForm({
  halls,
  tariff,
  defaultHallId,
  onDone,
}: {
  halls: Pick<Hall, "id" | "name">[];
  tariff: RentalTariff | null;
  defaultHallId?: string | undefined;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<TariffInput, unknown, TariffValues>({
    resolver: zodResolver(tariffSchema),
    defaultValues: toDefaults(tariff, defaultHallId ?? halls[0]?.id ?? ""),
  });
  const [days, startMin, endMin] = useWatch({
    control: form.control,
    name: ["daysOfWeek", "startMin", "endMin"],
  });

  function onSubmit(values: TariffValues) {
    startTransition(async () => {
      const result = await saveTariff(values);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<TariffInput>, { message: messages[0] ?? "" });
        }
        toast.error(result.error);
        return;
      }
      toast.success(tariff ? "Тариф сохранён" : "Тариф добавлен");
      showHoleWarnings(result.data.warnings);
      onDone();
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="hallId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Зал</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Выберите зал" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {halls.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Подпись</FormLabel>
                <FormControl>
                  <Input placeholder="Будни, день" maxLength={120} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="daysOfWeek"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Дни</FormLabel>
              <FormControl>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={field.value.map(String)}
                  onValueChange={(v) => field.onChange(v.map(Number))}
                  className="flex-wrap"
                >
                  {DAY_DISPLAY_ORDER.map((d) => (
                    <ToggleGroupItem key={d} value={String(d)} aria-label={DAY_SHORT[d]}>
                      {DAY_SHORT[d]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormControl>
              <div className="flex flex-wrap gap-2">
                {QUICK_DAYS.map((q) => (
                  <Button
                    key={q.label}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      form.setValue("daysOfWeek", [...q.days], {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    {q.label}
                  </Button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Начало</FormLabel>
                <FormControl>
                  <TimeSelect kind="start" value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Конец</FormLabel>
                <FormControl>
                  <TimeSelect kind="end" value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Ночные часы (00:00–08:59) считаются частью предыдущего дня. 02:00–09:00 в «Пятнице» — это
          ночь на субботу.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Цена, ₽</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={10}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={Number.isNaN(field.value) ? "" : field.value}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priceUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Единица</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(["per_hour", "fixed"] as const).map((u) => (
                      <SelectItem key={u} value={u}>
                        {TARIFF_UNIT_LABELS[u]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="audience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Аудитория</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(["all", "pensioner"] as const).map((a) => (
                      <SelectItem key={a} value={a}>
                        {AUDIENCE_LABELS[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="validFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Действует с</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Необязательно</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="validTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Действует по</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Пусто — бессрочно</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel>Активен</FormLabel>
            </FormItem>
          )}
        />

        <p className="bg-muted rounded-md p-3 text-sm" aria-live="polite">
          Это интервал {describeInterval(days, startMin, endMin)}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
            Отмена
          </Button>
          <Button type="submit" disabled={isPending} aria-busy={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Сохранить
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
