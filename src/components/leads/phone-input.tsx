"use client";

import type * as React from "react";
import { Input } from "@/components/ui/input";
import { applyPhoneInput, nationalDigits, PHONE_MASK_PREFIX } from "@/lib/phone";
import { cn } from "@/lib/utils";

type PhoneInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "inputMode" | "autoComplete"
> & {
  value: string;
  onChange: (formatted: string) => void;
};

/** Поле телефона с маской `+7(999)999-99-99`. Класс `ym-disable-keys` скрывает ввод от Вебвизора. */
export function PhoneInput({
  value,
  onChange,
  onFocus,
  onBlur,
  className,
  ...props
}: PhoneInputProps) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder={props.placeholder ?? "+7(___)___-__-__"}
      className={cn("ym-disable-keys", className)}
      value={value}
      onChange={(e) => onChange(applyPhoneInput(value, e.target.value))}
      onFocus={(e) => {
        if (value === "") onChange(PHONE_MASK_PREFIX);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        // Пустой префикс «+7(» без цифр не оставляем в поле
        if (nationalDigits(value) === "") onChange("");
        onBlur?.(e);
      }}
    />
  );
}
