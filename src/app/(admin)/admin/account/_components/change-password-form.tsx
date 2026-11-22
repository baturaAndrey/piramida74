"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";

/** = MIN_PASSWORD_LENGTH в src/lib/auth.ts (серверный модуль в клиент не импортируем) */
const MIN_PASSWORD_LENGTH = 10;
/** Ограничение better-auth по умолчанию (maxPasswordLength) */
const MAX_PASSWORD_LENGTH = 128;
const HTTP_TOO_MANY_REQUESTS = 429;

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Не короче ${MIN_PASSWORD_LENGTH} символов`)
      .max(MAX_PASSWORD_LENGTH, `Не длиннее ${MAX_PASSWORD_LENGTH} символов`),
    repeatPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.repeatPassword, {
    path: ["repeatPassword"],
    message: "Пароли не совпадают",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Новый пароль совпадает с текущим",
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

const EMPTY_VALUES: ChangePasswordValues = {
  currentPassword: "",
  newPassword: "",
  repeatPassword: "",
};

type AuthError = { status?: number; code?: string | undefined; message?: string | undefined };

/** Ошибка better-auth → русский текст и поле, к которому её привязать. */
function describeError(error: AuthError): {
  message: string;
  field?: keyof ChangePasswordValues;
} {
  if (error.status === HTTP_TOO_MANY_REQUESTS) {
    return { message: "Слишком много попыток. Подождите минуту и попробуйте снова" };
  }
  switch (error.code) {
    case "INVALID_PASSWORD":
      return { message: "Неверный текущий пароль", field: "currentPassword" };
    case "PASSWORD_TOO_SHORT":
      return { message: `Не короче ${MIN_PASSWORD_LENGTH} символов`, field: "newPassword" };
    case "PASSWORD_TOO_LONG":
      return { message: `Не длиннее ${MAX_PASSWORD_LENGTH} символов`, field: "newPassword" };
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return { message: "У аккаунта нет пароля для входа" };
    default:
      return { message: "Не удалось изменить пароль. Попробуйте ещё раз" };
  }
}

export function ChangePasswordForm({ email }: { email: string }) {
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY_VALUES,
  });

  async function onSubmit(values: ChangePasswordValues) {
    try {
      const { error } = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        const { message, field } = describeError(error);
        if (field) form.setError(field, { message });
        toast.error(message);
        return;
      }
      form.reset(EMPTY_VALUES);
      toast.success("Пароль изменён. Остальные сеансы завершены");
    } catch {
      toast.error("Нет связи с сервером. Попробуйте ещё раз");
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Скрытое имя пользователя — чтобы менеджер паролей обновил нужную запись */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Текущий пароль</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Новый пароль</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>Не короче {MIN_PASSWORD_LENGTH} символов.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="repeatPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Повторите новый пароль</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Сменить пароль
        </Button>
      </form>
    </Form>
  );
}
