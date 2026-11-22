import { expect, test, type Page } from "@playwright/test";
import { expectToast, rowByText } from "./helpers/admin";
import { trackConsoleErrors, uniq, uniqueIp } from "./helpers/console";
import { sql } from "./helpers/db";
import {
  expectThankYou,
  fillLeadForm,
  leadsByPhone,
  normalizedPhone,
  randomPhone,
  waitForLead,
  type LeadDbRow,
} from "./helpers/leads";

/**
 * Заявки с сайта (SMTP/Telegram не настроены: уведомления пропускаются, лид сохраняется).
 * Каждый тест отправляет заявки со своего `x-real-ip` — лимит 5 заявок / 10 мин на IP.
 * Порядок важен (1 воркер, по порядку объявления): «Админка» проверяет лид из теста CTA,
 * rate limit — последний. Режим не serial: падение одного теста не отменяет остальные.
 */

const CTA_BLOCK = "Бильярдная забронировать стол";

/** IP для rate limit: фиксирован в пределах прогона, но свой у каждого прогона (повтор < 10 мин). */
function perRunIp(): string {
  const n = Math.floor(Date.now() / 1000) % 60_000;
  return `198.18.${Math.floor(n / 250)}.${(n % 250) + 1}`;
}

function ctaForm(page: Page) {
  return page.locator("#getconsultation");
}

/** Открывает попап «Перезвоните мне» из шапки (повтор клика — если гидратация ещё не завершилась). */
async function openCallbackDialog(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Перезвоните мне" });
  await expect(async () => {
    await page.getByRole("banner").getByRole("button", { name: "Заказать звонок" }).click();
    await expect(dialog).toBeVisible({ timeout: 2000 });
  }).toPass();
  return dialog;
}

test.describe("Заявки", () => {
  let consoleErrors: () => string[];
  let ctaLead: { name: string; phone: string } | undefined;

  test.beforeEach(async ({ page }) => {
    consoleErrors = trackConsoleErrors(page);
    await page.setExtraHTTPHeaders({ "x-real-ip": uniqueIp() });
  });

  test.afterEach(() => {
    expect(consoleErrors()).toEqual([]);
  });

  test("форма CTA: ошибки полей, согласие обязательно, успешная отправка → /spasibo", async ({
    page,
  }) => {
    await page.goto("/");
    const section = ctaForm(page);
    await expect(section.getByText("Хотите забронировать стол?")).toBeVisible();
    const name = section.getByLabel("Ваше имя");
    const phone = section.getByLabel("Ваш номер телефона");
    const consent = section.getByRole("checkbox", { name: /согласие на обработку/ });
    const submit = section.getByRole("button", { name: "Оставить заявку" });

    // Пустая форма: кнопка неактивна, после ухода из полей показаны ошибки
    await expect(consent).not.toBeChecked();
    await expect(submit).toBeDisabled();
    await name.focus();
    await phone.focus();
    await consent.focus();
    await submit.focus({ timeout: 1000 }).catch(() => {}); // disabled-кнопка может не принять фокус
    await section.getByText("Заполните форму").click();
    await expect(section.getByText("Введите имя")).toBeVisible();
    await expect(section.getByText("Введите номер телефона полностью")).toBeVisible();

    // Корректные имя и телефон, но без согласия — отправка заблокирована, есть сообщение
    const lead = { name: `E2E Тест ${uniq()}`, phone: randomPhone() };
    await fillLeadForm(section, { ...lead, consent: false });
    await expect(section.getByText("Введите имя")).toHaveCount(0);
    await expect(section.getByText("Введите номер телефона полностью")).toHaveCount(0);
    await expect(section.getByText("Необходимо согласие на обработку данных")).toBeVisible();
    await expect(submit).toBeDisabled();
    expect(await leadsByPhone(lead.phone)).toHaveLength(0);

    await consent.check();
    await expect(section.getByText("Необходимо согласие на обработку данных")).toHaveCount(0);
    await submit.click();
    await expectThankYou(page);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    const row = await waitForLead(lead.phone);
    expect(row).toMatchObject({ type: "booking", source_block: CTA_BLOCK });
    ctaLead = lead;
  });

  test("попап «Заказать звонок»: окно звонка + телефон → успех", async ({ page }) => {
    await page.goto("/prices");
    const dialog = await openCallbackDialog(page);

    await dialog.getByRole("combobox", { name: "В какое время вам позвонить?" }).click();
    await page.getByRole("option", { name: "В течение часа" }).click();
    await expect(dialog.getByRole("combobox", { name: "В какое время вам позвонить?" })).toHaveText(
      "В течение часа"
    );
    // У обратного звонка нет поля имени
    await expect(dialog.getByLabel("Ваше имя")).toHaveCount(0);

    const phone = randomPhone();
    await fillLeadForm(dialog, { phone });
    await dialog.getByRole("button", { name: "Заказать звонок" }).click();
    await expectThankYou(page);

    const row = await waitForLead(phone);
    expect(row).toMatchObject({ type: "callback", source_block: "Шапка сайта" });
    const [extra] = await sql()<{ callback_window: string }[]>`
      select callback_window from leads where id = ${row.id}`;
    expect(extra?.callback_window).toBe("hour");
  });

  test("запись на турнир: попап «Записаться на турнир» → лид tournament со ссылкой на турнир", async ({
    page,
  }) => {
    // Ближайший опубликованный турнир (кнопка заявки есть у всех предстоящих турниров сезона)
    const [tournament] = await sql()<{ id: string; title: string }[]>`
      select id, title from tournaments
      where is_published and end_date >= (now() at time zone 'Asia/Yekaterinburg')::date
        and extract(year from start_date) = extract(year from now() at time zone 'Asia/Yekaterinburg')
      order by start_date limit 1`;
    test.skip(!tournament, "В сезоне нет предстоящих турниров");
    if (!tournament) return;

    await page.goto("/tournaments");
    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: tournament.title, exact: true }),
    });
    const dialog = page.getByRole("dialog", { name: "Записаться на турнир" });
    await expect(async () => {
      await card.first().getByRole("button", { name: "Подать заявку" }).click();
      await expect(dialog).toBeVisible({ timeout: 2000 });
    }).toPass();

    const phone = randomPhone();
    await fillLeadForm(dialog, { name: `E2E Игрок ${uniq()}`, phone });
    await dialog.getByRole("button", { name: "Записаться" }).click();
    await expectThankYou(page);

    const row = await waitForLead(phone);
    expect(row).toMatchObject({ type: "tournament", tournament_id: tournament.id });

    await page.goto(`/admin/leads/${row.id}`);
    await expect(page.getByRole("heading", { name: `Заявка #${row.number}` })).toBeVisible();
    await expect(page.getByRole("link", { name: tournament.title })).toHaveAttribute(
      "href",
      `/admin/tournaments/${tournament.id}`
    );
  });

  test("honeypot: заполненное скрытое поле → «успех» без записи в БД", async ({ page }) => {
    await page.goto("/");
    const section = ctaForm(page);
    const lead = { name: `E2E Бот ${uniq()}`, phone: randomPhone() };
    await fillLeadForm(section, lead);

    // Скрытое поле website (вне экрана) заполняем как бот — через нативный setter и событие input
    await section.locator('input[name="website"]').evaluate((input: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "https://spam.example");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await section.getByRole("button", { name: "Оставить заявку" }).click();
    await expectThankYou(page);

    // Даём серверу время на возможную запись — её быть не должно
    await page.waitForTimeout(1000);
    expect(await leadsByPhone(lead.phone)).toHaveLength(0);
    await page.goto(`/admin/leads?q=${encodeURIComponent(lead.name)}`);
    await expect(page.getByText(lead.name)).toHaveCount(0);
  });

  test("админка: лид в списке, карточка, смена статуса, уведомления пропущены", async ({
    page,
  }) => {
    test.skip(!ctaLead, "Нет лида из теста формы CTA");
    if (!ctaLead) return;
    const row: LeadDbRow = await waitForLead(ctaLead.phone);
    // Уведомления пишутся в notifyStatus после ответа клиенту (after())
    await expect
      .poll(async () => Object.keys((await waitForLead(ctaLead!.phone)).notify_status))
      .toEqual(expect.arrayContaining(["email", "telegram"]));

    await page.goto(`/admin/leads?q=${encodeURIComponent(ctaLead.name)}`);
    const listRow = rowByText(page, ctaLead.name);
    await expect(listRow).toContainText(`#${row.number}`);
    await expect(listRow).toContainText("Бронь");
    await expect(listRow).toContainText(CTA_BLOCK);
    await expect(listRow).toContainText(normalizedPhone(ctaLead.phone));
    await expect(listRow).toContainText("Новая");

    await listRow.getByText(ctaLead.name).click();
    await expect(page).toHaveURL(new RegExp(`/admin/leads/${row.id}$`));
    await expect(page.getByRole("heading", { name: `Заявка #${row.number}` })).toBeVisible();
    // Предыдущий маршрут (список) остаётся смонтированным скрытым — getByRole видит только доступное
    await expect(
      page.getByRole("definition").filter({ hasText: /^Хотите забронировать стол$/ })
    ).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: CTA_BLOCK })).toBeVisible();

    await page.getByRole("combobox", { name: "Статус заявки" }).click();
    await page.getByRole("option", { name: "В работе" }).click();
    await expectToast(page, "Статус: В работе");
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Статус заявки" })).toHaveText("В работе");
    const [saved] = await sql()<
      { status: string }[]
    >`select status from leads where id = ${row.id}`;
    expect(saved?.status).toBe("in_progress");

    // SMTP/Telegram не настроены → «пропущено», а не «ошибка»
    const notify = page.locator("li", { has: page.getByText(/^(Email|Telegram):/) });
    await expect(notify).toHaveCount(2);
    for (const channel of ["Email", "Telegram"]) {
      await expect(notify.filter({ hasText: `${channel}:` })).toContainText(
        "пропущено (не настроено)"
      );
    }
  });

  test("телефон, вставленный целиком «+7 (900) 111-22-33», сохраняется без сдвига", async ({
    page,
  }) => {
    // Маска при фокусе подставляет «+7(» — вставка номера с кодом страны не должна его дублировать
    const phone = "+7 (900) 111-22-33";
    const before = (await leadsByPhone(phone)).length;
    await page.goto("/");
    const section = ctaForm(page);
    await fillLeadForm(section, { name: `E2E Тест ${uniq()}`, phone, rawPhone: true });
    await expect(section.getByLabel("Ваш номер телефона")).toHaveValue("+7(900)111-22-33");
    await section.getByRole("button", { name: "Оставить заявку" }).click();
    await expectThankYou(page);
    await expect.poll(async () => (await leadsByPhone(phone)).length).toBe(before + 1);
  });

  test("ленивый попап с клавиатуры: фокус → Enter открывает, Escape закрывает и возвращает фокус", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = page.getByRole("banner").getByRole("button", { name: "Заказать звонок" });
    // Ждём только гидратацию кнопки (React вешает свои свойства на DOM-узел), а не открытие попапа:
    // само открытие проверяется обычным expect, без повторов toPass
    await expect
      .poll(() =>
        trigger.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps")))
      )
      .toBe(true);

    await trigger.focus(); // onFocus предзагружает чанк попапа
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Перезвоните мне" });
    await expect(dialog).toBeVisible(); // пока попап открыт, Radix скрывает шапку (aria-hidden) от getByRole

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("rate limit: 6-я заявка с одного IP за 10 минут отклоняется понятной ошибкой", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setExtraHTTPHeaders({ "x-real-ip": perRunIp() });

    const submitCallback = async (phone: string) => {
      await page.goto("/prices");
      const dialog = await openCallbackDialog(page);
      await fillLeadForm(dialog, { phone });
      await dialog.getByRole("button", { name: "Заказать звонок" }).click();
      return dialog;
    };

    for (let i = 0; i < 5; i++) {
      await submitCallback(randomPhone());
      await expectThankYou(page);
    }

    const phone = randomPhone();
    const dialog = await submitCallback(phone);
    await expect(dialog.getByRole("alert")).toContainText(
      /Слишком много заявок\. Попробуйте через \d+ мин\./
    );
    await expect(page).not.toHaveURL(/\/spasibo/);
    expect(await leadsByPhone(phone)).toHaveLength(0);
  });
});
