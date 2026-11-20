import { describe, expect, expectTypeOf, it } from "vitest";
import type { LeadType } from "@/lib/schema/enums";
import { leadEmail, leadTelegram, type LeadForNotify, type LeadNotifyType } from "./lead-templates";

const NAME = "Иван Тестовый";
const PHONE = "+7 (900) 111-22-33";
const COMMENT = "Хочу стол у окна";

const lead: LeadForNotify = {
  id: "00000000-0000-4000-8000-000000000001",
  number: 42,
  type: "tournament",
  sourceBlock: "Турниры",
  formTitle: "Записаться на турнир",
  pageUrl: "https://example.test/tournaments",
  name: NAME,
  phone: PHONE,
  callbackWindow: "hour",
  preferredDate: null,
  preferredTime: null,
  guests: null,
  comment: COMMENT,
  promotionTitle: null,
  tournamentTitle: "Кубок клуба",
  quote: null,
};

describe("leadTelegram", () => {
  it("без includePii не содержит имя, телефон и комментарий", () => {
    const text = leadTelegram(lead, { includePii: false });
    expect(text).not.toContain(NAME);
    expect(text).not.toContain(PHONE);
    expect(text).not.toContain("900");
    expect(text).not.toContain(COMMENT);
    // Обязательная служебная информация остаётся
    expect(text).toContain("#42");
    expect(text).toContain("Челябинск");
    expect(text).toContain("/admin/leads/");
  });

  it("с includePii содержит имя и телефон", () => {
    const text = leadTelegram(lead, { includePii: true });
    expect(text).toContain(NAME);
    expect(text).toContain(PHONE);
  });

  it("экранирует HTML в пользовательских полях", () => {
    const text = leadTelegram({ ...lead, name: "<b>x</b>" }, { includePii: true });
    expect(text).not.toContain("<b>x</b>");
    expect(text).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("leadEmail", () => {
  it("письмо (внутренний канал) содержит контакты", () => {
    const mail = leadEmail(lead);
    expect(mail.text).toContain(NAME);
    expect(mail.text).toContain(PHONE);
  });
});

describe("LeadNotifyType", () => {
  it("совпадает с enum lead_type схемы", () => {
    // Модуль уведомлений не импортирует схему (собирается независимо) — синхронность
    // типов проверяется здесь: расхождение ломает typecheck.
    expectTypeOf<LeadNotifyType>().toEqualTypeOf<LeadType>();
  });
});
