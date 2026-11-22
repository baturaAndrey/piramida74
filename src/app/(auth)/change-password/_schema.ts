// Смена временного пароля (изоморфный модуль: форма и Server Action)
import { z } from "zod";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

export const changeTemporaryPasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Введите временный пароль")
      .max(MAX_PASSWORD_LENGTH, `Не длиннее ${MAX_PASSWORD_LENGTH} символов`),
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
    message: "Новый пароль совпадает с временным",
  });

export type ChangeTemporaryPasswordValues = z.infer<typeof changeTemporaryPasswordSchema>;
