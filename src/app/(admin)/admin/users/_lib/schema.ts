// Схемы раздела «Пользователи» (изоморфный модуль: форма на клиенте и Server Actions)
import { z } from "zod";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

const MAX_NAME_LENGTH = 120;
/** Ограничение длины email (RFC 5321) */
const MAX_EMAIL_LENGTH = 254;
/** id пользователей Better Auth — text (не UUID): только длина и безопасный набор символов */
const USER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const temporaryPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Не короче ${MIN_PASSWORD_LENGTH} символов`)
  .max(MAX_PASSWORD_LENGTH, `Не длиннее ${MAX_PASSWORD_LENGTH} символов`);

export const createUserSchema = z.object({
  // Better Auth хранит и сравнивает email в нижнем регистре
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(MAX_EMAIL_LENGTH, "Слишком длинный email")
    .pipe(z.email("Некорректный email")),
  name: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .max(MAX_NAME_LENGTH, `Не длиннее ${MAX_NAME_LENGTH} символов`),
  password: temporaryPasswordSchema,
});

export const userIdSchema = z.string().regex(USER_ID_RE, "Некорректный пользователь");

export const deleteUserSchema = z.object({ userId: userIdSchema });

export const resetTemporaryPasswordSchema = z.object({
  userId: userIdSchema,
  password: temporaryPasswordSchema,
});

export type CreateUserInput = z.input<typeof createUserSchema>;
