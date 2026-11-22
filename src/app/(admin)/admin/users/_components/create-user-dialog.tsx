"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { type FieldPath, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { createPanelUser } from "../_actions";
import { CredentialsSummary, TempPasswordInput } from "./temp-password-field";
import { type CreateUserInput, createUserSchema } from "../_lib/schema";
import type { z } from "zod";

type CreateUserOutput = z.output<typeof createUserSchema>;

const EMPTY_VALUES: CreateUserInput = { email: "", name: "", password: "" };

/** «Добавить пользователя»: новый сотрудник с временным паролем. */
export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  // После создания диалог показывает данные для входа вместо формы
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  // Пока запрос идёт, диалог не закрывается — иначе данные для входа показались бы позже
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (submitting) return;
    setOpen(next);
    if (!next) setCreated(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <UserPlus className="h-4 w-4" aria-hidden />
          Добавить пользователя
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Пользователь создан</DialogTitle>
              <DialogDescription>Уровень доступа — сотрудник.</DialogDescription>
            </DialogHeader>
            <CredentialsSummary email={created.email} password={created.password} />
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Готово
              </Button>
            </DialogFooter>
          </>
        ) : (
          <CreateUserForm
            onCancel={() => handleOpenChange(false)}
            onCreated={(values) => setCreated(values)}
            onSubmittingChange={setSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateUserForm({
  onCancel,
  onCreated,
  onSubmittingChange,
}: {
  onCancel: () => void;
  onCreated: (values: { email: string; password: string }) => void;
  onSubmittingChange: (submitting: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<CreateUserInput, unknown, CreateUserOutput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: EMPTY_VALUES,
  });
  const { control, handleSubmit, setError, formState } = form;

  async function onSubmit(values: CreateUserOutput) {
    onSubmittingChange(true);
    const result = await createPanelUser(values).finally(() => onSubmittingChange(false));
    if (!result.ok) {
      for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages[0];
        if (message) setError(key as FieldPath<CreateUserInput>, { type: "server", message });
      }
      toast.error(result.error);
      return;
    }
    toast.success("Пользователь создан");
    onCreated({ email: values.email, password: values.password });
    router.refresh();
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Новый пользователь</DialogTitle>
          <DialogDescription>
            Сотрудник получит доступ ко всей админке, кроме раздела «Пользователи».
          </DialogDescription>
        </DialogHeader>

        <FormField
          control={control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="off" inputMode="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Имя</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Временный пароль</FormLabel>
              <FormControl>
                <TempPasswordInput
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={formState.isSubmitting}
                />
              </FormControl>
              <FormDescription>
                Не короче {MIN_PASSWORD_LENGTH} символов. При первом входе пароль нужно будет
                сменить.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={formState.isSubmitting}
          >
            Отмена
          </Button>
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Создать
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
