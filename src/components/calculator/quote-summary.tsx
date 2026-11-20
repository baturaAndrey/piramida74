"use client";

import { useId, useRef, useState } from "react";
import { AlertCircle, Link2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { Quote, QuoteLine, QuoteLineKind } from "@/lib/calculator/types";
import { cn } from "@/lib/utils";
import { formatQty, formatRub, GUEST_FORMS, plural } from "./calculator-helpers";

/** Порядок и подписи групп строк сметы (значения `kind` — из `types.ts`) */
const KIND_GROUPS: { kind: QuoteLineKind; title: string }[] = [
  { kind: "rental", title: "Аренда" },
  { kind: "extra", title: "Доп. услуги" },
  { kind: "set", title: "Банкетные сеты" },
  { kind: "item", title: "Меню" },
];

interface QuoteSummaryProps {
  quote: Quote;
  guests: number;
  onSend: () => void;
  id?: string;
  className?: string;
}

/** Итоговая смета: строки по группам, итоги, предупреждения, акции, действия */
export function QuoteSummary({ quote, guests, onSend, id, className }: QuoteSummaryProps) {
  const uid = useId();
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const empty = quote.lines.length === 0;

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setFallbackUrl(null);
      toast.success("Ссылка скопирована");
    } catch {
      // Clipboard недоступен (нет HTTPS, запрет браузера) — даём скопировать вручную
      toast.error("Не удалось скопировать ссылку — скопируйте её из поля ниже");
      setFallbackUrl(url);
      requestAnimationFrame(() => fallbackRef.current?.select());
    }
  };

  return (
    <section
      id={id}
      aria-labelledby={`${uid}-title`}
      className={cn("bg-card text-card-foreground rounded-lg border p-6 shadow-sm", className)}
    >
      <h2 id={`${uid}-title`} className="text-xl font-semibold">
        Ваш расчёт
      </h2>

      {empty ? (
        <p className="text-muted-foreground mt-4 text-sm">
          Выберите зал, время и позиции — мы посчитаем
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {KIND_GROUPS.map(({ kind, title }) => {
            const lines = quote.lines.filter((l) => l.kind === kind);
            if (lines.length === 0) return null;
            return (
              <div key={kind} className="space-y-2">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {title}
                </h3>
                <ul className="space-y-2">
                  {lines.map((line, i) => (
                    <QuoteLineRow key={`${kind}-${i}`} line={line} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <Separator className="my-4" />

      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Аренда и услуги</dt>
          <dd className="tabular-nums">{formatRub(quote.rentalTotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Меню и сеты</dt>
          <dd className="tabular-nums">{formatRub(quote.foodTotal)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 pt-2">
          <dt className="text-base font-semibold">Итого</dt>
          <dd
            className="text-primary text-2xl font-bold tabular-nums"
            aria-live="polite"
            aria-atomic="true"
          >
            {formatRub(quote.total)}
          </dd>
        </div>
        {quote.total > 0 ? (
          <div className="text-muted-foreground flex justify-between gap-4">
            <dt>
              на {guests} {plural(guests, GUEST_FORMS)}
            </dt>
            <dd className="tabular-nums">≈ {formatRub(quote.perGuest)} на гостя</dd>
          </div>
        ) : null}
      </dl>

      {quote.warnings.length > 0 ? (
        <div
          role="status"
          className="bg-destructive/10 text-destructive mt-4 flex gap-2 rounded-md p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <ul className="space-y-1">
            {quote.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {quote.promoHints.length > 0 ? (
        <div className="bg-accent text-accent-foreground mt-4 flex gap-2 rounded-md p-3 text-sm">
          <Sparkles className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <ul className="space-y-1">
              {quote.promoHints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">Скидка не входит в расчёт</p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        <Button
          type="button"
          size="lg"
          className="hover:bg-primary-dark h-12 text-base font-semibold"
          disabled={quote.total === 0}
          onClick={onSend}
        >
          <Send className="size-4" aria-hidden="true" />
          Отправить расчёт в клуб
        </Button>
        <Button type="button" variant="outline" className="h-10" onClick={copyLink}>
          <Link2 className="size-4" aria-hidden="true" />
          Скопировать ссылку
        </Button>
        {fallbackUrl ? (
          <Input
            ref={fallbackRef}
            readOnly
            value={fallbackUrl}
            aria-label="Ссылка на расчёт"
            onFocus={(e) => e.currentTarget.select()}
            className="h-10 text-xs"
          />
        ) : null}
      </div>

      <div className="text-muted-foreground mt-4 space-y-1 text-xs">
        <p>Платные добавки к блюдам в расчёт не включены.</p>
        <p>Расчёт предварительный, итог подтверждает администратор</p>
      </div>
    </section>
  );
}

function QuoteLineRow({ line }: { line: QuoteLine }) {
  return (
    <li className="flex justify-between gap-3 text-sm">
      <div className="min-w-0">
        <p className="leading-snug">{line.label}</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {formatQty(line.qty)} × {formatRub(line.unitPrice)}
        </p>
      </div>
      <span className="shrink-0 font-medium tabular-nums">{formatRub(line.total)}</span>
    </li>
  );
}
