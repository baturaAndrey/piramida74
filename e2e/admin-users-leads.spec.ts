import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type Request,
  type TestInfo,
} from "@playwright/test";
import { expectToast, rowByText } from "./helpers/admin";
import { uniq, uniqueIp } from "./helpers/console";
import { sql } from "./helpers/db";

/**
 * Удаление заявок (одной и списком) и раздел «Пользователи»: сотрудник с временным паролем,
 * принудительная смена пароля, доступ сотрудника (заявки — да, пользователи — нет),
 * удаление пользователя главным админом.
 *
 * Проект `chromium` работает под storageState главного админа (auth.setup.ts).
 */

const SESSION_COOKIE = "better-auth.session_token";

// ---------------------------------------------------------------------------
// Хелперы
// ---------------------------------------------------------------------------

type CapturedAction = { url: string; headers: Record<string, string>; body: string };

/** Ждёт POST Server Action, тело которого удовлетворяет `match` (как в security.spec.ts). */
function captureAction(page: Page, match: (body: string) => boolean): Promise<CapturedAction> {
  return new Promise((resolve) => {
    const onRequest = async (req: Request) => {
      const headers = await req.allHeaders();
      const body = req.postData() ?? "";
      if (req.method() !== "POST" || !headers["next-action"] || !match(body)) return;
      page.off("request", onRequest);
      resolve({ url: req.url(), headers, body });
    };
    page.on("request", onRequest);
  });
}

/** Повтор Server Action с другим телом и cookie (`cookie` — заголовок целиком). */
async function replayAction(
  api: APIRequestContext,
  captured: CapturedAction,
  body: string,
  cookie: string
): Promise<string> {
  const pick = (name: string) => captured.headers[name];
  const headers: Record<string, string> = {
    "next-action": pick("next-action") ?? "",
    "content-type": pick("content-type") ?? "text/plain;charset=UTF-8",
    accept: pick("accept") ?? "text/x-component",
    origin: pick("origin") ?? new URL(captured.url).origin,
    cookie,
  };
  const routerState = pick("next-router-state-tree");
  if (routerState) headers["next-router-state-tree"] = routerState;
  const res = await api.post(captured.url, { headers, data: body, maxRedirects: 0 });
  return res.text();
}

/** Заголовок Cookie с сессией контекста */
async function sessionCookieHeader(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name.endsWith(SESSION_COOKIE));
  if (!session) throw new Error("Нет cookie сессии");
  return `${session.name}=${session.value}`;
}

/** Контекст запросов без storageState проекта */
function anonRequest(
  playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } },
  testInfo: TestInfo
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: { cookies: [], origins: [] },
  });
}

/** Заявки напрямую в БД (быстрее и не зависит от rate limit формы). Возвращает id и номера. */
async function insertLeads(
  token: string,
  count: number
): Promise<{ id: string; number: number }[]> {
  const db = sql();
  const [doc] = await db<{ id: string }[]>`
    select id from legal_documents where published_at is not null order by published_at desc limit 1`;
  if (!doc) throw new Error("Нет опубликованного документа согласия (pnpm e2e:db)");
  const rows: { id: string; number: number }[] = [];
  for (let i = 0; i < count; i++) {
    const [row] = await db<{ id: string; number: number }[]>`
      insert into leads (type, source_block, form_title, page_url, name, phone,
                         consent_document_id, consent_at)
      values ('callback', 'E2E', 'E2E удаление', '/', ${`E2E del ${token} ${i}`},
              ${`+7 (900) 000-00-0${i}`}, ${doc.id}, now())
      returning id, number`;
    if (row) rows.push(row);
  }
  return rows;
}

async function leadIdsExisting(ids: string[]): Promise<string[]> {
  const rows = await sql()<{ id: string }[]>`select id from leads where id in ${sql()(ids)}`;
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Заявки
// ---------------------------------------------------------------------------

test.describe("удаление заявок", () => {
  test("несколько заявок из списка и одна со страницы заявки", async ({ page }) => {
    const token = uniq();
    const leads = await insertLeads(token, 3);
    const [first, second, third] = leads;
    if (!first || !second || !third) throw new Error("лиды не созданы");

    try {
      await page.goto(`/admin/leads?q=${encodeURIComponent(`E2E del ${token}`)}`);
      await expect(page.getByRole("row")).toHaveCount(4); // шапка + 3

      // Без выбора кнопки нет
      await expect(page.getByRole("button", { name: "Удалить выбранные" })).toHaveCount(0);
      await page.getByRole("checkbox", { name: `Выбрать заявку #${first.number}` }).check();
      await page.getByRole("checkbox", { name: `Выбрать заявку #${second.number}` }).check();
      // Клик по чекбоксу не открывает карточку
      await expect(page).toHaveURL(/\/admin\/leads\?/);
      await expect(page.getByText("Выбрано: 2")).toBeVisible();

      await page.getByRole("button", { name: "Удалить выбранные" }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog.getByRole("heading", { name: "Удалить 2 заявки?" })).toBeVisible();
      await expect(dialog).toContainText("Действие необратимо");
      await dialog.getByRole("button", { name: "Удалить" }).click();
      await expectToast(page, "Удалены 2 заявки");
      await expect(dialog).toBeHidden();

      await expect(page.getByRole("row")).toHaveCount(2);
      expect(await leadIdsExisting(leads.map((l) => l.id))).toEqual([third.id]);
      const audits = await sql()<{ entity_id: string }[]>`
        select entity_id from audit_log where action = 'lead.delete'
          and entity_id in ${sql()([first.id, second.id])}`;
      expect(audits).toHaveLength(2);

      // Одна заявка — со своей страницы, после удаления — назад к списку
      await page.goto(`/admin/leads/${third.id}`);
      await page.getByRole("button", { name: "Удалить заявку" }).click();
      const single = page.getByRole("alertdialog");
      await expect(single.getByRole("heading", { name: "Удалить 1 заявку?" })).toBeVisible();
      await single.getByRole("button", { name: "Удалить" }).click();
      await expectToast(page, "Удалена 1 заявка");
      await expect(page).toHaveURL(/\/admin\/leads$/);
      expect(await leadIdsExisting([third.id])).toEqual([]);
    } finally {
      await sql()`delete from leads where name like ${`E2E del ${token}%`}`;
    }
  });
});

// ---------------------------------------------------------------------------
// Пользователи
// ---------------------------------------------------------------------------

test.describe("пользователи админки", () => {
  test("главный админ создаёт сотрудника → смена временного пароля → доступ сотрудника → удаление", async ({
    page,
    browser,
    playwright,
    baseURL,
  }, testInfo) => {
    test.setTimeout(120_000);
    const token = uniq();
    const email = `e2e-staff-${token}@example.com`;
    const name = `E2E Сотрудник ${token}`;
    const newPassword = `Staff-own-${token}`;
    const [lead, otherLead] = await insertLeads(token, 2);
    if (!lead || !otherLead) throw new Error("лиды не созданы");

    // Отдельный IP: вход сотрудника не расходует общий лимит /sign-in/email
    const staffContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { "x-real-ip": uniqueIp() },
    });
    const api = await anonRequest(playwright, testInfo);

    try {
      // --- Главный админ: пункт меню и создание пользователя ---
      await page.goto("/admin/users");
      await expect(page.getByRole("heading", { level: 1, name: "Пользователи" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Пользователи", exact: true })).toBeVisible();

      // Свою строку удалить нельзя
      const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
      const ownRow = rowByText(page, adminEmail);
      await expect(ownRow).toContainText("Главный админ");
      await expect(ownRow.getByRole("button", { name: /Удалить пользователя/ })).toHaveCount(0);

      await page.getByRole("button", { name: "Добавить пользователя" }).click();
      const createDialog = page.getByRole("dialog");
      await createDialog.getByLabel("Email").fill(email);
      await createDialog.getByLabel("Имя").fill(name);
      await createDialog.getByRole("button", { name: "Сгенерировать" }).click();
      const passwordInput = createDialog.getByLabel("Временный пароль");
      const tempPassword = await passwordInput.inputValue();
      expect(tempPassword.length).toBeGreaterThanOrEqual(10);
      // Глазок показывает пароль
      await createDialog.getByRole("button", { name: "Показать пароль" }).click();
      await expect(passwordInput).toHaveAttribute("type", "text");

      const createCapture = captureAction(page, (b) => b.includes(email));
      await createDialog.getByRole("button", { name: "Создать" }).click();
      const createReq = await createCapture;
      await expectToast(page, "Пользователь создан");
      await expect(createDialog.getByTestId("temp-password")).toHaveText(tempPassword);
      await createDialog.getByRole("button", { name: "Готово" }).click();

      const staffRow = rowByText(page, email);
      await expect(staffRow).toContainText("Сотрудник");
      await expect(staffRow).toContainText("Временный пароль");
      const [created] = await sql()<{ id: string; role: string; must_change_password: boolean }[]>`
        select id, role, must_change_password from "user" where email = ${email}`;
      expect(created).toMatchObject({ role: "staff", must_change_password: true });
      const staffId = created?.id ?? "";

      // Контрольный захват staff-действия (удаление заявки) под админом — для повтора сотрудником
      await page.goto(`/admin/leads/${lead.id}`);
      const deleteLeadCapture = captureAction(page, (b) => b.includes(lead.id));
      await page.getByRole("button", { name: "Удалить заявку" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
      const deleteLeadReq = await deleteLeadCapture;
      await expectToast(page, "Удалена 1 заявка");

      // --- Сотрудник: вход с временным паролем → только смена пароля ---
      const staffPage = await staffContext.newPage();
      await staffPage.goto("/login");
      await staffPage.getByLabel("Email").fill(email);
      await staffPage.getByLabel("Пароль", { exact: true }).fill(tempPassword);
      await staffPage.getByRole("button", { name: /войти/i }).click();
      await expect(staffPage).toHaveURL(/\/change-password$/);
      await expect(
        staffPage.getByRole("heading", { name: "Смените временный пароль" })
      ).toBeVisible();

      // Любая страница админки уводит обратно на смену пароля (проверка на сервере)
      await staffPage.goto("/admin/leads");
      await expect(staffPage).toHaveURL(/\/change-password$/);

      // Server Action админки с временным паролем — отказ (заявка не удаляется)
      let staffCookie = await sessionCookieHeader(staffContext);
      const deniedBeforeChange = await replayAction(
        api,
        deleteLeadReq,
        deleteLeadReq.body.replaceAll(lead.id, otherLead.id),
        staffCookie
      );
      expect(deniedBeforeChange).toContain("Нет доступа");
      expect(await leadIdsExisting([otherLead.id])).toEqual([otherLead.id]);

      // Смена пароля: неверный временный → ошибка поля; верный → /admin
      await staffPage.getByLabel("Временный пароль").fill("wrong-temp-password");
      await staffPage.getByLabel("Новый пароль", { exact: true }).fill(newPassword);
      await staffPage.getByLabel("Повторите новый пароль").fill(newPassword);
      await staffPage.getByRole("button", { name: "Сменить пароль и войти" }).click();
      await expect(staffPage.getByText("Неверный временный пароль").first()).toBeVisible();

      await staffPage.getByLabel("Временный пароль").fill(tempPassword);
      await staffPage.getByRole("button", { name: "Сменить пароль и войти" }).click();
      await expect(staffPage).toHaveURL(/\/admin$/);
      const [afterChange] = await sql()<{ must_change_password: boolean }[]>`
        select must_change_password from "user" where id = ${staffId}`;
      expect(afterChange?.must_change_password).toBe(false);

      // --- Сотрудник: заявки доступны, «Пользователи» — нет ---
      await staffPage.goto("/admin/leads");
      await expect(staffPage.getByRole("heading", { level: 1, name: "Заявки" })).toBeVisible();
      await expect(staffPage.getByRole("link", { name: "Заявки", exact: true })).toBeVisible();
      await expect(staffPage.getByRole("link", { name: "Пользователи", exact: true })).toHaveCount(
        0
      );

      await staffPage.goto("/admin/users");
      await expect(staffPage.getByText("Не найдено")).toBeVisible();
      await expect(staffPage.getByRole("heading", { level: 1, name: "Пользователи" })).toHaveCount(
        0
      );

      // Новая сессия после смены пароля (старая отозвана)
      staffCookie = await sessionCookieHeader(staffContext);

      // Staff-действие теперь проходит
      const allowed = await replayAction(
        api,
        deleteLeadReq,
        deleteLeadReq.body.replaceAll(lead.id, otherLead.id),
        staffCookie
      );
      expect(allowed).toContain('"ok":true');
      expect(await leadIdsExisting([otherLead.id])).toEqual([]);

      // Действия раздела «Пользователи» сотруднику запрещены
      const forgedEmail = `e2e-forged-${token}@example.com`;
      const deniedCreate = await replayAction(
        api,
        createReq,
        createReq.body.replaceAll(email, forgedEmail),
        staffCookie
      );
      expect(deniedCreate).toContain("Нет доступа");

      // …и эндпоинты плагина admin Better Auth напрямую — тоже (403)
      const authHeaders = { cookie: staffCookie, origin: baseURL ?? "" };
      const directCreate = await api.post("/api/auth/admin/create-user", {
        headers: authHeaders,
        data: { email: forgedEmail, password: "Forged-password-1", name: "forged", role: "admin" },
      });
      expect(directCreate.status()).toBe(403);
      const directSetRole = await api.post("/api/auth/admin/set-role", {
        headers: authHeaders,
        data: { userId: staffId, role: "admin" },
      });
      expect(directSetRole.status()).toBe(403);
      const directList = await api.get("/api/auth/admin/list-users", { headers: authHeaders });
      expect(directList.status()).toBe(403);
      // Флаг смены пароля нельзя снять/поставить через updateUser (input: false)
      const directUpdate = await api.post("/api/auth/update-user", {
        headers: authHeaders,
        data: { mustChangePassword: true },
      });
      expect(directUpdate.status()).toBeGreaterThanOrEqual(400);

      expect(await sql()`select id from "user" where email = ${forgedEmail}`).toHaveLength(0);
      const [stillStaff] = await sql()<{ role: string; must_change_password: boolean }[]>`
        select role, must_change_password from "user" where id = ${staffId}`;
      expect(stillStaff).toMatchObject({ role: "staff", must_change_password: false });

      // --- Главный админ удаляет сотрудника; удалить себя нельзя ---
      await page.goto("/admin/users");
      const deleteUserCapture = captureAction(page, (b) => b.includes(staffId));
      await rowByText(page, email)
        .getByRole("button", { name: `Удалить пользователя ${email}` })
        .click();
      const confirm = page.getByRole("alertdialog");
      await expect(confirm).toContainText("Действие необратимо");
      await confirm.getByRole("button", { name: "Удалить" }).click();
      const deleteUserReq = await deleteUserCapture;
      await expectToast(page, "Пользователь удалён");
      await expect(page.getByRole("row").filter({ hasText: email })).toHaveCount(0);
      expect(await sql()`select id from "user" where id = ${staffId}`).toHaveLength(0);
      expect(await sql()`select id from session where user_id = ${staffId}`).toHaveLength(0);

      // Сессия удалённого сотрудника больше не действует
      await staffPage.goto("/admin/leads");
      await expect(staffPage).toHaveURL(/\/login/);

      // Прямой вызов удаления самого себя — отказ сервера
      const [admin] = await sql()<{ id: string }[]>`
        select id from "user" where email = ${adminEmail}`;
      const adminCookie = await sessionCookieHeader(page.context());
      const selfDelete = await replayAction(
        api,
        deleteUserReq,
        deleteUserReq.body.replaceAll(staffId, admin?.id ?? ""),
        adminCookie
      );
      expect(selfDelete).toContain("Нельзя удалить самого себя");
      expect(await sql()`select id from "user" where id = ${admin?.id ?? ""}`).toHaveLength(1);
    } finally {
      await staffContext.close();
      await api.dispose();
      await sql()`delete from "user" where email like ${`e2e-%-${token}@example.com`}`;
      await sql()`delete from leads where name like ${`E2E del ${token}%`}`;
    }
  });
});
