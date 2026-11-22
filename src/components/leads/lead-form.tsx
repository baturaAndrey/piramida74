"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { PhoneInput } from "@/components/leads/phone-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitLead } from "@/lib/actions/leads";
import {
  type CallbackWindow,
  type LeadFormFields,
  type LeadFormFieldsInput,
  leadFormFieldsSchema,
  type LeadType,
} from "@/lib/actions/leads-schema";
import { reachGoal } from "@/lib/metrika";
import { isPhoneComplete } from "@/lib/phone";
import { cn } from "@/lib/utils";

export type LeadFormProps = {
  type: LeadType;
  /** → leads.sourceBlock («Шапка сайта», «Первый экран»…) */
  block: string;
  formTitle: string;
  promotionId?: string;
  tournamentId?: string;
  /** Скрытые поля, уходят в payload как есть (калькулятор: { quote: JSON.stringify(quoteInput) }) */
  hidden?: Record<string, string>;
  submitLabel?: string;
  onSuccess?: (number: number) => void;
  className?: string;
};

const DEFAULT_SUBMIT_LABELS: Record<LeadType, string> = {
  callback: "Заказать звонок",
  booking: "Забронировать",
  promo: "Отправить заявку",
  calculator: "Отправить расчёт в клуб",
  tournament: "Записаться",
};

const CALLBACK_WINDOW_OPTIONS: { value: CallbackWindow; label: string }[] = [
  { value: "now", label: "Сейчас" },
  { value: "hour", label: "В течение часа" },
  { value: "day", label: "В течение дня" },
  { value: "week", label: "На этой неделе" },
];

const VISIBLE_FIELDS = ["name", "phone", "callbackWindow", "consent"] as const;
type VisibleField = (typeof VISIBLE_FIELDS)[number];
const PAGE_PATH_MAX = 300;

/** Поля по старому сайту: крупные, скругление ≈12px, белый фон, Onest 500 */
const FIELD_CLASS =
  "h-[clamp(48px,3.6vw,100px)] rounded-xl bg-white px-5 text-base font-medium md:text-base";

function isVisibleField(key: string): key is VisibleField {
  return (VISIBLE_FIELDS as readonly string[]).includes(key);
}

/** location.pathname + search, не длиннее лимита схемы (длинный query отбрасывается) */
function currentPagePath(): string {
  const full = window.location.pathname + window.location.search;
  return full.length <= PAGE_PATH_MAX ? full : window.location.pathname.slice(0, PAGE_PATH_MAX);
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

/** Единая форма заявки сайта. Набор видимых полей определяется `type`. */
export function LeadForm({
  type,
  block,
  formTitle,
  promotionId,
  tournamentId,
  hidden,
  submitLabel,
  onSuccess,
  className,
}: LeadFormProps) {
  const router = useRouter();
  const uid = useId();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isCallback = type === "callback";

  const form = useForm<LeadFormFieldsInput, unknown, LeadFormFields>({
    resolver: zodResolver(leadFormFieldsSchema),
    mode: "onTouched",
    defaultValues: isCallback
      ? { type, phone: "", callbackWindow: "now", consent: false, website: "" }
      : { type, name: "", phone: "", consent: false, website: "" },
  });
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;
  const [phone, consent] = useWatch({ control, name: ["phone", "consent"] });
  const canSubmit = consent === true && isPhoneComplete(phone) && !isPending;

  const ids = {
    name: `${uid}-name`,
    phone: `${uid}-phone`,
    callbackWindow: `${uid}-callback-window`,
    consent: `${uid}-consent`,
    serverError: `${uid}-server-error`,
  };

  const onValid = (values: LeadFormFields) => {
    setServerError(null);
    // exactOptionalPropertyTypes: пустые ключи в payload не передаём вовсе
    const payload: Record<string, unknown> = { pagePath: currentPagePath(), phone: values.phone };
    if (isCallback) {
      if (values.callbackWindow) payload.callbackWindow = values.callbackWindow;
    } else if (values.name) {
      payload.name = values.name;
    }
    if (values.website) payload.website = values.website;
    if (promotionId) payload.promotionId = promotionId;
    if (tournamentId) payload.tournamentId = tournamentId;
    Object.assign(payload, hidden);
    // Служебные поля — после hidden, чтобы их нельзя было перекрыть
    Object.assign(payload, { type, sourceBlock: block, formTitle, consent: true });

    startTransition(async () => {
      try {
        const result = await submitLead(payload);
        if (result.ok) {
          reachGoal(type === "calculator" ? "calculator_submit" : "lead_submit");
          onSuccess?.(result.number);
          router.push("/spasibo");
          return;
        }
        const extraMessages: string[] = [];
        for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
          const message = messages[0];
          if (!message) continue;
          if (isVisibleField(key)) setError(key, { type: "server", message });
          else extraMessages.push(message);
        }
        setServerError([result.error, ...extraMessages].join(". "));
      } catch {
        setServerError("Не удалось отправить заявку. Проверьте подключение к интернету.");
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onValid)}
      className={cn("relative flex flex-col gap-3", className)}
      aria-describedby={serverError ? ids.serverError : undefined}
    >
      {isCallback ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.callbackWindow} className="text-sm font-medium">
            В какое время вам позвонить?
          </Label>
          <Controller
            control={control}
            name="callbackWindow"
            render={({ field }) => (
              <Select
                {...(field.value ? { value: field.value } : {})}
                onValueChange={(v) => field.onChange(v as CallbackWindow)}
              >
                <SelectTrigger
                  id={ids.callbackWindow}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  className={cn(
                    FIELD_CLASS,
                    "w-full data-[size=default]:h-[clamp(48px,3.6vw,100px)]"
                  )}
                >
                  <SelectValue placeholder="Выберите время" />
                </SelectTrigger>
                <SelectContent>
                  {CALLBACK_WINDOW_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Label htmlFor={ids.name} className="sr-only">
            Ваше имя
          </Label>
          <Input
            id={ids.name}
            autoComplete="name"
            placeholder="Ваше имя"
            maxLength={100}
            className={cn(FIELD_CLASS, "ym-disable-keys")}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${ids.name}-error` : undefined}
            {...register("name")}
          />
          <FieldError id={`${ids.name}-error`} message={errors.name?.message} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor={ids.phone} className="sr-only">
          Ваш номер телефона
        </Label>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <PhoneInput
              id={ids.phone}
              ref={field.ref}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Ваш номер телефона"
              className={FIELD_CLASS}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? `${ids.phone}-error` : undefined}
            />
          )}
        />
        <FieldError id={`${ids.phone}-error`} message={errors.phone?.message} />
      </div>

      {/* Honeypot: невидим для людей, боты его заполняют */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${uid}-website`}>Сайт</label>
        <input
          id={`${uid}-website`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-3">
          <Controller
            control={control}
            name="consent"
            render={({ field }) => (
              <Checkbox
                id={ids.consent}
                ref={field.ref}
                checked={field.value === true}
                onCheckedChange={(v) => field.onChange(v === true)}
                onBlur={field.onBlur}
                className="mt-0.5 size-5 bg-white"
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? `${ids.consent}-error` : undefined}
              />
            )}
          />
          <Label
            htmlFor={ids.consent}
            className="block text-xs leading-snug font-normal md:text-sm"
          >
            Я даю{" "}
            <Link
              href="/soglasie"
              target="_blank"
              rel="noopener"
              className="text-primary underline"
            >
              согласие на обработку персональных данных
            </Link>{" "}
            и ознакомлен(а) с{" "}
            <Link
              href="/politika"
              target="_blank"
              rel="noopener"
              className="text-primary underline"
            >
              политикой конфиденциальности
            </Link>
          </Label>
        </div>
        <FieldError id={`${ids.consent}-error`} message={errors.consent?.message} />
      </div>

      {serverError ? (
        <p id={ids.serverError} role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={!canSubmit}
        aria-busy={isPending}
        className="bg-primary hover:bg-primary-dark h-12 rounded-xl text-base font-bold md:h-14 md:text-lg"
      >
        {isPending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
        {submitLabel ?? DEFAULT_SUBMIT_LABELS[type]}
      </Button>
    </form>
  );
}
