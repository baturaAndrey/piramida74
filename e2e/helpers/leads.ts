import { expect, type Locator, type Page } from "@playwright/test";
import { sql } from "./db";

/** Уникальный телефон +7 (9XX) XXX-XX-XX — по нему лид находится в админке и БД. */
export function randomPhone(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  return `+7 (9${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
}

/** Вид телефона в БД и админке (`normalizePhone`): «+7 (900) 111-22-33». */
export function normalizedPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").slice(1);
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

type LeadFields = {
  name?: string;
  phone: string;
  consent?: boolean;
  /** Вставить номер как есть («+7 (900) …»); по умолчанию вводятся 10 национальных цифр */
  rawPhone?: boolean;
};

/** Заполняет LeadForm внутри `scope` (форма CTA, попап, диалог калькулятора). */
export async function fillLeadForm(
  scope: Locator,
  { name, phone, consent = true, rawPhone = false }: LeadFields
) {
  if (name !== undefined) await scope.getByLabel("Ваше имя").fill(name);
  // При фокусе маска подставляет «+7(», поэтому по умолчанию вводим только национальный номер
  const value = rawPhone ? phone : phone.replace(/\D/g, "").slice(1);
  await scope.getByLabel("Ваш номер телефона").fill(value);
  if (consent) await scope.getByRole("checkbox", { name: /согласие на обработку/ }).check();
}

/** Ждёт перехода на /spasibo после успешной отправки. */
export async function expectThankYou(page: Page) {
  await expect(page).toHaveURL(/\/spasibo$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Спасибо за обращение");
}

export type LeadDbRow = {
  id: string;
  number: number;
  type: string;
  source_block: string;
  form_title: string;
  phone: string | null;
  tournament_id: string | null;
  quote_total: number | null;
  quote_snapshot: { quote?: { total?: number } } | null;
  notify_status: Record<string, { ok: boolean; error?: string }>;
};

/** Лиды по точному телефону (новые сверху). */
export async function leadsByPhone(phone: string): Promise<LeadDbRow[]> {
  return sql()<LeadDbRow[]>`
    select id, number, type, source_block, form_title, phone, tournament_id,
           quote_total, quote_snapshot, notify_status
    from leads where phone = ${normalizedPhone(phone)} order by created_at desc`;
}

/** Ждёт, пока лид появится в БД (запись идёт до редиректа, но страховка от гонок). */
export async function waitForLead(phone: string): Promise<LeadDbRow> {
  let row: LeadDbRow | undefined;
  await expect
    .poll(async () => {
      [row] = await leadsByPhone(phone);
      return row !== undefined;
    })
    .toBe(true);
  return row as LeadDbRow;
}
