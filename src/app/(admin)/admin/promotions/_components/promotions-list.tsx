"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { SortableList } from "@/components/admin/sortable-list";
import { Picture } from "@/components/media/picture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { deletePromotion, reorderPromotions, togglePromotion } from "../_actions";
import { describeConditions } from "../_lib/labels";
import type { PromotionRow } from "../_queries";

type PromotionsListProps = {
  items: PromotionRow[];
  /** «Сегодня» (YYYY-MM-DD, Екатеринбург) с сервера — для бейджа «Истекла» без расхождения гидрации */
  today: string;
};

/** Включение/выключение с оптимистичным состоянием и откатом при ошибке. */
function ActiveSwitch({ item }: { item: PromotionRow }) {
  const [checked, setChecked] = useState(item.isActive);
  const [synced, setSynced] = useState(item.isActive);
  const [pending, setPending] = useState(false);

  // Данные с сервера изменились (после revalidate) — принимаем их
  if (item.isActive !== synced) {
    setSynced(item.isActive);
    setChecked(item.isActive);
  }

  async function toggle(value: boolean) {
    setChecked(value);
    setPending(true);
    const res = await togglePromotion({ id: item.id, value });
    setPending(false);
    if (!res.ok) {
      setChecked(!value);
      toast.error(res.error);
      return;
    }
    toast.success(value ? "Акция включена" : "Акция выключена");
  }

  return (
    <Switch
      checked={checked}
      disabled={pending}
      aria-label={checked ? `Выключить акцию «${item.title}»` : `Включить акцию «${item.title}»`}
      onCheckedChange={(value) => void toggle(value)}
    />
  );
}

export function PromotionsList({ items, today }: PromotionsListProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-6 text-center text-sm">
          Акций пока нет. Создайте первую.
        </CardContent>
      </Card>
    );
  }

  return (
    <SortableList
      items={items}
      onReorder={(ids) => reorderPromotions({ ids })}
      renderItem={(item, ctx) => {
        const expired = item.validTo !== null && item.validTo < today;
        return (
          <div className="bg-card flex flex-wrap items-center gap-3 rounded-lg border p-3 shadow-sm sm:flex-nowrap">
            {ctx.dragHandle}
            <div className="bg-muted flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border">
              {item.cover ? (
                <Picture
                  asset={item.cover}
                  sizes="64px"
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="text-muted-foreground h-4 w-4" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1 basis-40 space-y-1">
              <Link
                href={`/admin/promotions/${item.id}`}
                className="block font-medium break-words hover:underline"
              >
                {item.title}
              </Link>
              <p className="text-muted-foreground text-sm">{describeConditions(item)}</p>
              <div className="flex flex-wrap gap-1">
                {item.showInCarousel ? <Badge variant="secondary">В карусели</Badge> : null}
                {item.isActive ? null : <Badge variant="outline">Выключена</Badge>}
                {expired ? <Badge variant="destructive">Истекла</Badge> : null}
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <ActiveSwitch item={item} />
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
              <Button asChild variant="ghost" size="icon">
                <Link
                  href={`/admin/promotions/${item.id}`}
                  aria-label={`Изменить акцию «${item.title}»`}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <ConfirmDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label={`Удалить акцию «${item.title}»`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                }
                title={`Удалить акцию «${item.title}»?`}
                description="Действие необратимо."
                onConfirm={async () => {
                  const res = await deletePromotion({ id: item.id });
                  if (res.ok) toast.success("Акция удалена");
                  return res;
                }}
              />
            </div>
          </div>
        );
      }}
    />
  );
}
