"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { SortableList } from "@/components/admin/sortable-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SERIES_DESCRIPTION_MAX, SERIES_NAME_MAX } from "../../_schema";
import { deleteSeries, reorderSeries, saveSeries } from "../_actions";
import type { SeriesRow } from "../../_queries";

type Editing = { id?: string; name: string; description: string };

const EMPTY: Editing = { name: "", description: "" };

/** «3 турнира», «5 турниров», «1 турнир» */
function tournamentsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "турнир";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "турнира";
  return "турниров";
}

function SeriesDialog({ editing, onClose }: { editing: Editing | null; onClose: () => void }) {
  const [values, setValues] = useState<Editing>(editing ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    const res = await saveSeries({
      id: values.id,
      name: values.name,
      description: values.description.trim() || null,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      const next: Record<string, string> = {};
      for (const [key, messages] of Object.entries(res.fieldErrors ?? {})) {
        if (messages[0]) next[key] = messages[0];
      }
      setErrors(next);
      return;
    }
    toast.success("Сохранено");
    onClose();
  }

  return (
    <Dialog
      open={editing !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{values.id ? "Изменить серию" : "Новая серия"}</DialogTitle>
            <DialogDescription>
              Например «Марафон-Промнефтегаз» или «Сеньоры Челябинска».
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="series-name">Название</Label>
            <Input
              id="series-name"
              value={values.name}
              maxLength={SERIES_NAME_MAX}
              required
              aria-invalid={errors.name ? true : undefined}
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            />
            {errors.name ? <p className="text-destructive text-sm">{errors.name}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="series-description">Описание</Label>
            <Textarea
              id="series-description"
              value={values.description}
              maxLength={SERIES_DESCRIPTION_MAX}
              rows={3}
              aria-invalid={errors.description ? true : undefined}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, description: event.target.value }))
              }
            />
            <p className="text-muted-foreground text-xs tabular-nums">
              {values.description.length}/{SERIES_DESCRIPTION_MAX}
            </p>
            {errors.description ? (
              <p className="text-destructive text-sm">{errors.description}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={pending || !values.name.trim()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SeriesManager({ series }: { series: SeriesRow[] }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  // Новый key при каждом открытии — диалог стартует с чистым состоянием
  const [dialogKey, setDialogKey] = useState(0);

  function open(next: Editing) {
    setDialogKey((key) => key + 1);
    setEditing(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => open(EMPTY)}>
          <Plus className="h-4 w-4" aria-hidden />
          Добавить серию
        </Button>
      </div>

      {series.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-center text-sm">
            Серий пока нет.
          </CardContent>
        </Card>
      ) : (
        <SortableList
          items={series}
          onReorder={(ids) => reorderSeries({ ids })}
          renderItem={(item, ctx) => (
            <div className="bg-card flex items-center gap-2 rounded-lg border p-3 shadow-sm sm:gap-3">
              {ctx.dragHandle}
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{item.name}</p>
                {item.description ? (
                  <p className="text-muted-foreground line-clamp-2 text-sm">{item.description}</p>
                ) : null}
                <p className="text-muted-foreground text-xs">
                  {item.tournamentsCount} {tournamentsWord(item.tournamentsCount)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Выше"
                  disabled={!ctx.canMoveUp}
                  onClick={ctx.moveUp}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Ниже"
                  disabled={!ctx.canMoveDown}
                  onClick={ctx.moveDown}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Изменить серию «${item.name}»`}
                  onClick={() =>
                    open({ id: item.id, name: item.name, description: item.description ?? "" })
                  }
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      aria-label={`Удалить серию «${item.name}»`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  }
                  title={`Удалить серию «${item.name}»?`}
                  description={
                    item.tournamentsCount > 0
                      ? `У серии ${item.tournamentsCount} ${tournamentsWord(item.tournamentsCount)}, они останутся без серии. Действие необратимо.`
                      : "Действие необратимо."
                  }
                  onConfirm={async () => {
                    const res = await deleteSeries({ id: item.id });
                    if (res.ok) toast.success("Серия удалена");
                    return res;
                  }}
                />
              </div>
            </div>
          )}
        />
      )}

      <SeriesDialog key={dialogKey} editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
