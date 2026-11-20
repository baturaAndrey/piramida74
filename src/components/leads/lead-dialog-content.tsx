"use client";

import { LeadForm } from "@/components/leads/lead-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { restoreFocusOnClose } from "@/hooks/use-lazy-dialog";
import type { LeadType } from "@/lib/actions/leads-schema";
import { cn } from "@/lib/utils";
import type { LeadDialogKind } from "./lead-dialog";

/**
 * Тяжёлая часть попапа заявки: Radix Dialog, форма (react-hook-form, zod, маска телефона).
 * Отдельный чанк — грузится лениво из `LeadDialogTrigger` (lead-dialog.tsx) при первом
 * наведении/фокусе/клике, а не в начальном бандле каждой страницы.
 */
export type LeadDialogContentProps = {
  kind: LeadDialogKind;
  block: string;
  formTitle?: string | undefined;
  promotionId?: string | undefined;
  tournamentId?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** id контента — на него ссылается `aria-controls` триггера */
  contentId: string;
  /** Триггер вне Radix (`DialogTrigger` не используется): вернуть на него фокус при закрытии */
  triggerRef: React.RefObject<HTMLElement | null>;
};

type DialogPreset = {
  title: string;
  description: string;
  /** Описание видно только для `promo` (как на старом сайте); у остальных — для скринридеров */
  showDescription: boolean;
  formType: LeadType;
  submitLabel: string;
  defaultFormTitle: string;
};

/** Тексты четырёх попапов старого сайта */
const PRESETS: Record<LeadDialogKind, DialogPreset> = {
  callback: {
    title: "Перезвоните мне",
    description: "Оставьте номер телефона — мы перезвоним в удобное время",
    showDescription: false,
    formType: "callback",
    submitLabel: "Заказать звонок",
    defaultFormTitle: "Перезвоните мне",
  },
  booking: {
    title: "Забронировать",
    description: "Оставьте имя и телефон — администратор перезвонит для подтверждения брони",
    showDescription: false,
    formType: "booking",
    submitLabel: "Забронировать",
    defaultFormTitle: "Забронировать",
  },
  promo: {
    title: "Узнайте подробнее",
    description: "Перезвоним через пару минут для уточнения деталей",
    showDescription: true,
    formType: "promo",
    submitLabel: "Отправить заявку",
    defaultFormTitle: "Участвовать в акции",
  },
  tournament: {
    title: "Записаться на турнир",
    description: "Оставьте имя и телефон — мы свяжемся с вами для подтверждения участия",
    showDescription: false,
    formType: "tournament",
    submitLabel: "Записаться",
    defaultFormTitle: "Запись на турнир",
  },
};

/** Попап с формой заявки (замена попапов старого сайта); default export — для `React.lazy`. */
export default function LeadDialogContent({
  kind,
  block,
  formTitle,
  promotionId,
  tournamentId,
  open,
  onOpenChange,
  contentId,
  triggerRef,
}: LeadDialogContentProps) {
  const preset = PRESETS[kind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id={contentId}
        // Без DialogTrigger Radix не знает, куда вернуть фокус: возвращаем на наш триггер
        onCloseAutoFocus={restoreFocusOnClose(triggerRef)}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border-0 bg-white bg-[url('/images/popup-bg.webp')] bg-cover bg-center p-6 sm:max-w-md md:p-8"
      >
        <DialogHeader className="gap-3 text-center sm:text-center">
          <DialogTitle className="text-popup-title leading-tight font-bold">
            {preset.title}
          </DialogTitle>
          <DialogDescription className={cn(preset.showDescription ? "text-sm" : "sr-only")}>
            {preset.description}
          </DialogDescription>
        </DialogHeader>
        {/* Форма монтируется только в открытом диалоге — её состояние сбрасывается при каждом открытии */}
        {open ? (
          <LeadForm
            type={preset.formType}
            block={block}
            formTitle={formTitle ?? preset.defaultFormTitle}
            submitLabel={preset.submitLabel}
            onSuccess={() => onOpenChange(false)}
            {...(promotionId && kind === "promo" ? { promotionId } : {})}
            {...(tournamentId && kind === "tournament" ? { tournamentId } : {})}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
