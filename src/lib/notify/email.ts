import nodemailer, { type Transporter } from "nodemailer";
import { getServerEnv } from "@/lib/env";

export interface SendEmailInput {
  /** По умолчанию LEADS_EMAIL_TO (можно список через запятую) */
  to?: string;
  subject: string;
  html: string;
  text: string;
}

export type NotifyResult = { ok: boolean; error?: string };

/** Яндекс 360: smtp.yandex.ru:465, implicit TLS */
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_SENDER_NAME = "Пирамида 74";

let transporter: Transporter | undefined;
let transporterKey = "";

/** Транспорт создаётся лениво и пересоздаётся только при смене host/port/user. */
function getTransporter(host: string, port: number, user: string, pass: string): Transporter {
  const key = `${host}:${port}:${user}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    transporterKey = key;
  }
  return transporter;
}

/** Яндекс отклоняет письма, если From не совпадает с авторизованным ящиком, поэтому по умолчанию — SMTP_USER. */
function formatFrom(fromRaw: string): string {
  return fromRaw.includes("<") ? fromRaw : `${DEFAULT_SENDER_NAME} <${fromRaw}>`;
}

/** Отправляет письмо. Никогда не бросает исключений. */
export async function sendEmail(input: SendEmailInput): Promise<NotifyResult> {
  try {
    const env = getServerEnv();
    const to = input.to ?? env.LEADS_EMAIL_TO;
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !to) {
      console.warn("[notify/email] SMTP не настроен или нет получателя — письмо пропущено");
      return { ok: false, error: "not_configured" };
    }
    const from = formatFrom(env.SMTP_FROM ?? env.SMTP_USER);
    await getTransporter(
      env.SMTP_HOST,
      env.SMTP_PORT ?? DEFAULT_SMTP_PORT,
      env.SMTP_USER,
      env.SMTP_PASS
    ).sendMail({
      from,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { ok: true };
  } catch (err) {
    // Логируем только сообщение ошибки: тело письма содержит ПДн, а конфиг — пароль
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[notify/email] send failed:", message);
    return { ok: false, error: message };
  }
}
