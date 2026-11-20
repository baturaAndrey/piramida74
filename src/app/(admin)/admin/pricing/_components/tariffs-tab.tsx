"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Hall, RentalTariff } from "@/lib/schema";
import { deleteTariff, duplicateTariff, toggleTariff } from "../_actions";
import { TariffFormDialog } from "./tariff-form-dialog";
import { showHoleWarnings, TariffWarnings } from "./tariff-warnings";
import {
  describeRange,
  formatDays,
  formatTariffPrice,
  formatTimeRange,
  formatValidity,
  HALL_KIND_LABELS,
} from "../_lib/labels";
import type { TariffAnalysis } from "../_lib/tariff-analysis";

type TariffsTabProps = {
  halls: Hall[];
  tariffs: RentalTariff[];
  warnings: TariffAnalysis<RentalTariff>;
};

/** Позиция первого дня тарифа в порядке Пн … Вс — для сортировки строк */
function firstDayPosition(days: number[]): number {
  return Math.min(...days.map((d) => (d + 6) % 7));
}

function compareTariffs(a: RentalTariff, b: RentalTariff): number {
  return (
    firstDayPosition(a.daysOfWeek) - firstDayPosition(b.daysOfWeek) ||
    a.startMin - b.startMin ||
    a.audience.localeCompare(b.audience)
  );
}

type DialogState = { open: boolean; tariff: RentalTariff | null; hallId?: string | undefined };

export function TariffsTab({ halls, tariffs, warnings }: TariffsTabProps) {
  const [dialog, setDialog] = useState<DialogState>({ open: false, tariff: null });

  const openCreate = (hallId?: string) => setDialog({ open: true, tariff: null, hallId });
  const openEdit = (tariff: RentalTariff) => setDialog({ open: true, tariff });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <TariffWarnings halls={halls} overlaps={warnings.overlaps} holes={warnings.holes} />
        </div>
        <Button onClick={() => openCreate()} disabled={halls.length === 0} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          Добавить тариф
        </Button>
      </div>

      {halls.length === 0 ? (
        <p className="text-muted-foreground text-sm">Сначала добавьте зал на вкладке «Залы».</p>
      ) : null}

      {halls.map((hall) => (
        <HallTariffsCard
          key={hall.id}
          hall={hall}
          tariffs={tariffs.filter((t) => t.hallId === hall.id).sort(compareTariffs)}
          onAdd={() => openCreate(hall.id)}
          onEdit={openEdit}
        />
      ))}

      <TariffFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        halls={halls}
        tariff={dialog.tariff}
        defaultHallId={dialog.hallId}
      />
    </div>
  );
}

function HallTariffsCard({
  hall,
  tariffs,
  onAdd,
  onEdit,
}: {
  hall: Hall;
  tariffs: RentalTariff[];
  onAdd: () => void;
  onEdit: (tariff: RentalTariff) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          {hall.name}
          <Badge variant="outline">{HALL_KIND_LABELS[hall.kind]}</Badge>
          {hall.isActive ? null : <Badge variant="secondary">Скрыт</Badge>}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Добавить</span>
        </Button>
      </CardHeader>
      <CardContent>
        {tariffs.length === 0 ? (
          <p className="text-muted-foreground text-sm">Тарифов нет</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Дни</TableHead>
                  <TableHead>Время</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead>Аудитория</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead>Активен</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Действия</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tariffs.map((t) => (
                  <TariffRow key={t.id} tariff={t} onEdit={() => onEdit(t)} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TariffRow({ tariff, onEdit }: { tariff: RentalTariff; onEdit: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const night = describeRange(tariff.startMin, tariff.endMin, tariff.daysOfWeek);

  function toggle(isActive: boolean) {
    startTransition(async () => {
      const result = await toggleTariff({ id: tariff.id, isActive });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isActive ? "Тариф включён" : "Тариф отключён");
      showHoleWarnings(result.data.warnings);
      router.refresh();
    });
  }

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateTariff({ id: tariff.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Создана неактивная копия тарифа");
      router.refresh();
    });
  }

  async function remove() {
    const result = await deleteTariff({ id: tariff.id });
    if (result.ok) {
      toast.success("Тариф удалён");
      showHoleWarnings(result.data.warnings);
      router.refresh();
    }
    return result;
  }

  return (
    <TableRow className={tariff.isActive ? undefined : "text-muted-foreground"}>
      <TableCell className="font-medium">
        {formatDays(tariff.daysOfWeek)}
        {tariff.label ? (
          <span className="text-muted-foreground block text-xs font-normal">{tariff.label}</span>
        ) : null}
      </TableCell>
      <TableCell>
        <span className="tabular-nums">{formatTimeRange(tariff.startMin, tariff.endMin)}</span>
        {night ? <span className="text-muted-foreground block text-xs">{night}</span> : null}
      </TableCell>
      <TableCell className="tabular-nums">
        {formatTariffPrice(tariff.price, tariff.priceUnit)}
      </TableCell>
      <TableCell>
        {tariff.audience === "pensioner" ? <Badge variant="secondary">Пенсионный</Badge> : "Все"}
      </TableCell>
      <TableCell>{formatValidity(tariff.validFrom, tariff.validTo)}</TableCell>
      <TableCell>
        <Switch
          checked={tariff.isActive}
          onCheckedChange={toggle}
          disabled={isPending}
          aria-label={tariff.isActive ? "Отключить тариф" : "Включить тариф"}
        />
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Действия с тарифом"
              disabled={isPending}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="h-4 w-4" aria-hidden />
              Изменить
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={duplicate}>
              <Copy className="h-4 w-4" aria-hidden />
              Дублировать
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <ConfirmDialog
              trigger={
                // preventDefault оставляет меню смонтированным, иначе диалог закроется вместе с ним
                <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Удалить
                </DropdownMenuItem>
              }
              title="Удалить тариф?"
              description={`${formatDays(tariff.daysOfWeek)}, ${formatTimeRange(tariff.startMin, tariff.endMin)} — ${formatTariffPrice(tariff.price, tariff.priceUnit)}. Действие нельзя отменить.`}
              onConfirm={remove}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
