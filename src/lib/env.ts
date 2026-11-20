import { z } from "zod";

/** Пустая строка в .env (`SMTP_HOST=`) трактуется как «не задано». */
const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional()
);
const optionalPort = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.number().int().positive().optional()
);

const serverEnvSchema = z.object({
  POSTGRES_URL: z.string().min(1, "POSTGRES_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  UPLOAD_DIR: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().default(process.env.NODE_ENV === "production" ? "/data/uploads" : "./.data/uploads")
  ),
  // Необязательные: если не заданы, уведомление пропускается + console.warn
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalPort,
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: optionalString,
  LEADS_EMAIL_TO: optionalString,
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_CHAT_ID: optionalString,
  CRON_SECRET: optionalString,
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_YM_ID: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

let serverEnvCache: ServerEnv | undefined;

/** Валидирует серверные переменные (кэшируется). Вызывать лениво, не на уровне модуля. */
export function getServerEnv(): ServerEnv {
  if (serverEnvCache) return serverEnvCache;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid server environment variables:", z.flattenError(parsed.error).fieldErrors);
    throw new Error("Invalid server environment variables");
  }
  serverEnvCache = parsed.data;
  return serverEnvCache;
}

/** NEXT_PUBLIC_* читаются литералами, иначе Next не подставит их в клиентский бандл. */
export function getClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_YM_ID: process.env.NEXT_PUBLIC_YM_ID,
  });
  if (!parsed.success) {
    console.error("Invalid client environment variables:", z.flattenError(parsed.error).fieldErrors);
    throw new Error("Invalid client environment variables");
  }
  return parsed.data;
}

/** Предупреждения про необязательные переменные (только в dev). */
export function checkEnv(): void {
  const warnings: string[] = [];
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    warnings.push("SMTP не настроен: email-уведомления о заявках будут пропущены.");
  }
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    warnings.push("Telegram не настроен: уведомления в Telegram будут пропущены.");
  }
  if (!process.env.CRON_SECRET) {
    warnings.push("CRON_SECRET не задан: cron-маршруты будут отвечать 401.");
  }
  if (process.env.NODE_ENV === "development" && warnings.length > 0) {
    console.warn("Environment warnings:");
    warnings.forEach((w) => console.warn(`  - ${w}`));
  }
}
