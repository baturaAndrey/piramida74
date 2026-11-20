"use client";

import { useState } from "react";
import { LeadForm } from "@/components/leads/lead-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { LeadType } from "@/lib/actions/leads-schema";
import { cn } from "@/lib/utils";

type LeadDialogKind = "callback" | "booking" | "promo" | "tournament";

type LeadDialogTriggerProps = {
  kind: LeadDialogKind;
  block: string;
  formTitle?: string;
  promotionId?: string;
  tournamentId?: string;
  asChild?: boolean;
  className?: string;
  children: React.ReactNode;
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

/** Кнопка-триггер + попап с формой заявки (замена попапов старого сайта). */
export function LeadDialogTrigger({
  kind,
  block,
  formTitle,
  promotionId,
  tournamentId,
  asChild = false,
  className,
  children,
}: LeadDialogTriggerProps) {
  const [open, setOpen] = useState(false);
  const preset = PRESETS[kind];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {asChild ? (
        <DialogTrigger asChild className={className}>
          {children}
        </DialogTrigger>
      ) : (
        <DialogTrigger className={className}>{children}</DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border-0 bg-white bg-[url('/images/popup-bg.webp')] bg-cover bg-center p-6 sm:max-w-md md:p-8">
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
            onSuccess={() => setOpen(false)}
            {...(promotionId && kind === "promo" ? { promotionId } : {})}
            {...(tournamentId && kind === "tournament" ? { tournamentId } : {})}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
