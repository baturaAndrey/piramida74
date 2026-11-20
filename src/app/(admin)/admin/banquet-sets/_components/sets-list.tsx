"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ActionOutcome } from "@/components/admin/action-outcome";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { MediaThumb } from "@/components/admin/media-thumb";
import { SortableList } from "@/components/admin/sortable-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ActiveToggle } from "../../menu/_components/items-list";
import { formatRub, plural } from "../../menu/_lib/labels";
import { deleteSet, reorderSets, toggleSet } from "../_actions";
import type { AdminSetRow } from "../_queries";

function guestsText(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `от ${min} до ${max} гостей`;
  if (min != null) return `от ${min} ${plural(min, ["гостя", "гостей", "гостей"])}`;
  if (max != null) return `до ${max} ${plural(max, ["гостя", "гостей", "гостей"])}`;
  return null;
}

export function SetsList({ sets }: { sets: AdminSetRow[] }) {
  const router = useRouter();

  async function handleDelete(id: string): Promise<ActionOutcome> {
    const result = await deleteSet({ id });
    if (result.ok) {
      toast.success("Сет удалён");
      router.refresh();
    }
    return result;
  }

  if (sets.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        Банкетных сетов пока нет
      </p>
    );
  }

  return (
    <SortableList
      items={sets}
      onReorder={(ids) => reorderSets({ ids })}
      renderItem={(set, ctx) => {
        const guests = guestsText(set.minGuests, set.maxGuests);
        return (
          <div
            className={cn(
              "bg-card flex flex-col gap-3 rounded-lg border p-3 shadow-xs sm:flex-row sm:items-center",
              !set.isActive && "bg-muted/50"
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {ctx.dragHandle}
              {set.cover ? (
                <MediaThumb asset={set.cover} sizes="64px" className="size-14 shrink-0" />
              ) : (
                <div className="bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-md">
                  <ImageIcon className="h-5 w-5" aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/banquet-sets/${set.id}`}
                  className={cn(
                    "font-medium break-words hover:underline",
                    !set.isActive && "text-muted-foreground"
                  )}
                >
                  {set.title}
                </Link>
                <p className="text-muted-foreground text-sm">
                  {formatRub(set.price)}{" "}
                  {set.pricingMode === "per_person" ? "/ человека" : "фиксированно"}
                  {guests ? ` · ${guests}` : ""}
                  {` · ${set.itemCount} ${plural(set.itemCount, ["позиция", "позиции", "позиций"])}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-9 sm:pl-0">
              <ActiveToggle
                checked={set.isActive}
                onToggle={(isActive) => toggleSet({ id: set.id, isActive })}
                label={`Показывать «${set.title}»`}
              />
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={ctx.moveUp}
                  disabled={!ctx.canMoveUp}
                  aria-label="Выше"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={ctx.moveDown}
                  disabled={!ctx.canMoveDown}
                  aria-label="Ниже"
                >
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </Button>
                <Button asChild variant="ghost" size="icon" className="size-8">
                  <Link href={`/admin/banquet-sets/${set.id}`} aria-label="Изменить">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive size-8"
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  }
                  title={`Удалить сет «${set.title}»?`}
                  description="Сет и его состав будут удалены. Старые ссылки калькулятора с этим сетом перестанут его учитывать."
                  onConfirm={() => handleDelete(set.id)}
                />
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
