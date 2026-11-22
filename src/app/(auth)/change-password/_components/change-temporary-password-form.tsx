"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { changeTemporaryPassword } from "../_actions";
import { changeTemporaryPasswordSchema, type ChangeTemporaryPasswordValues } from "../_schema";

const EMPTY_VALUES: ChangeTemporaryPasswordValues = {
  currentPassword: "",
  newPassword: "",
  repeatPassword: "",
};

export function ChangeTemporaryPasswordForm({ email }: { email: string }) {
  const form = useForm<ChangeTemporaryPasswordValues>({
    resolver: zodResolver(changeTemporaryPasswordSchema),
    defaultValues: EMPTY_VALUES,
  });

  async function onSubmit(values: ChangeTemporaryPasswordValues) {
    try {
      // Успех — redirect в /admin из Server Action (сюда управление не возвращается)
      const result = await changeTemporaryPassword(values);
      if (result.ok) return;
      for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages[0];
        if (message) form.setError(key as keyof ChangeTemporaryPasswordValues, { message });
      }
      toast.error(result.error);
    } catch {
      toast.error("Нет связи с сервером. Попробуйте ещё раз");
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Скрытое имя пользователя — чтобы менеджер паролей сохранил пароль к нужной учётке */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Временный пароль</FormLabel>
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
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Сменить пароль и войти
        </Button>
      </form>
    </Form>
  );
}
