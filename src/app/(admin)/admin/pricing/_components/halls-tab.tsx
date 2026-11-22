"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { SortableList } from "@/components/admin/sortable-list";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import type { Hall } from "@/lib/schema";
import { deleteHall, reorderHalls, saveHall, toggleHall } from "../_actions";
import { HALL_KIND_LABELS, pluralRu } from "../_lib/labels";
import { hallSchema, type HallInput, type HallValues } from "../_schema";

const DEFAULT_SEATS_PER_TABLE = 4;
const DEFAULT_COMMON_TABLES = 10;

type HallsTabProps = { halls: Hall[] };

type DialogState = { open: boolean; hall: Hall | null };

export function HallsTab({ halls }: HallsTabProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ open: false, hall: null });

  async function reorder(ids: string[]) {
    const result = await reorderHalls({ ids });
    if (result.ok) router.refresh();
    return result;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Порядок залов — порядок в прайсе на сайте и в калькуляторе. Перетащите строку, чтобы
          изменить его.
        </p>
        <Button onClick={() => setDialog({ open: true, hall: null })} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          Добавить зал
        </Button>
      </div>

      {halls.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Залов пока нет
        </p>
      ) : (
        <SortableList
          items={halls}
          onReorder={reorder}
          renderItem={(hall, { dragHandle }) => (
            <HallRow
              hall={hall}
              dragHandle={dragHandle}
              onEdit={() => setDialog({ open: true, hall })}
            />
          )}
        />
      )}

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog.hall ? "Изменить зал" : "Новый зал"}</DialogTitle>
            <DialogDescription>
              У VIP-комнаты один стол: цена тарифа указывается за комнату.
            </DialogDescription>
          </DialogHeader>
          {dialog.open ? (
            <HallForm hall={dialog.hall} onDone={() => setDialog((d) => ({ ...d, open: false }))} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HallRow({
  hall,
  dragHandle,
  onEdit,
}: {
  hall: Hall;
  dragHandle: ReactNode;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle(isActive: boolean) {
    startTransition(async () => {
      const result = await toggleHall({ id: hall.id, isActive });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isActive ? "Зал показан на сайте" : "Зал скрыт с сайта");
      router.refresh();
    });
  }

  async function remove() {
    const result = await deleteHall({ id: hall.id });
    if (result.ok) {
      toast.success("Зал удалён");
      router.refresh();
    }
    return result;
  }

  return (
    <div className="bg-card flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3 sm:flex-nowrap">
      {dragHandle}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={hall.isActive ? "font-medium" : "text-muted-foreground font-medium"}>
            {hall.name}
          </span>
          <Badge variant={hall.kind === "vip" ? "default" : "secondary"}>
            {HALL_KIND_LABELS[hall.kind]}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {hall.tablesCount} {pluralRu(hall.tablesCount, ["стол", "стола", "столов"])} ×{" "}
          {hall.seatsPerTable} {pluralRu(hall.seatsPerTable, ["место", "места", "мест"])}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Switch
          checked={hall.isActive}
          onCheckedChange={toggle}
          disabled={isPending}
          aria-label={hall.isActive ? `Скрыть зал ${hall.name}` : `Показать зал ${hall.name}`}
          className="mr-2"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          aria-label={`Изменить зал ${hall.name}`}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label={`Удалить зал ${hall.name}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          }
          title={`Удалить зал «${hall.name}»?`}
          description="Зал с тарифами удалить нельзя — сначала удалите или перенесите тарифы."
          onConfirm={remove}
        />
      </div>
    </div>
  );
}

function toDefaults(hall: Hall | null): HallInput {
  if (!hall) {
    return {
      name: "",
      kind: "common",
      tablesCount: DEFAULT_COMMON_TABLES,
      seatsPerTable: DEFAULT_SEATS_PER_TABLE,
      description: "",
      isActive: true,
    };
  }
  return {
    id: hall.id,
    name: hall.name,
    kind: hall.kind,
    tablesCount: hall.tablesCount,
    seatsPerTable: hall.seatsPerTable,
    description: hall.description ?? "",
    isActive: hall.isActive,
  };
}

function HallForm({ hall, onDone }: { hall: Hall | null; onDone: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<HallInput, unknown, HallValues>({
    resolver: zodResolver(hallSchema),
    defaultValues: toDefaults(hall),
  });

  function onSubmit(values: HallValues) {
    startTransition(async () => {
      const result = await saveHall(values);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<HallInput>, { message: messages[0] ?? "" });
        }
        toast.error(result.error);
        return;
      }
      toast.success(hall ? "Зал сохранён" : "Зал добавлен");
      onDone();
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название</FormLabel>
              <FormControl>
                <Input placeholder="Общий зал" maxLength={120} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Тип</FormLabel>
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  // VIP-комната — один стол, цена за комнату
                  if (v === "vip") form.setValue("tablesCount", 1, { shouldDirty: true });
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(["common", "vip"] as const).map((k) => (
                    <SelectItem key={k} value={k}>
                      {HALL_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="tablesCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Столов</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
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
            name="seatsPerTable"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Мест за столом</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={12}
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
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Описание</FormLabel>
              <FormControl>
                <Textarea rows={3} maxLength={1000} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormDescription>Необязательно</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel>Показывать на сайте</FormLabel>
            </FormItem>
          )}
        />
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
