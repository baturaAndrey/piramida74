import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Request,
  type TestInfo,
} from "@playwright/test";
import { ANON, expectToast } from "./helpers/admin";
import { uniq } from "./helpers/console";
import { sql } from "./helpers/db";

/**
 * Безопасность: защита админки, прямой вызов Server Action без сессии, cron-маршруты,
 * path traversal в /media, заголовки/CSP, отсутствие регистрации, 2FA (QR).
 * Rate limit входа — отдельно в zz-login-rate-limit.spec.ts (выполняется последним).
 */

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const SESSION_COOKIE = "better-auth.session_token";

/** Контекст запросов без cookie (playwright.request не наследует storageState проекта). */
async function anonRequest(
  playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } },
  testInfo: TestInfo
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: { cookies: [], origins: [] },
  });
}

function baseUrlOf(testInfo: TestInfo): string {
  const url = testInfo.project.use.baseURL;
  if (!url) throw new Error("baseURL не задан");
  return url;
}

// ---------------------------------------------------------------------------
// Анонимные проверки
// ---------------------------------------------------------------------------

test.describe("без сессии", () => {
  test.use(ANON);

  test("/admin/* редиректит на /login, X-Robots-Tag: noindex", async ({ playwright }, testInfo) => {
    const api = await anonRequest(playwright, testInfo);
    try {
      for (const path of ["/admin", "/admin/leads", "/admin/blog/articles"]) {
        const res = await api.get(path, { maxRedirects: 0 });
        expect(res.status(), path).toBeGreaterThanOrEqual(300);
        expect(res.status(), path).toBeLessThan(400);
        const location = new URL(res.headers()["location"] ?? "", baseUrlOf(testInfo));
        expect(location.pathname, path).toBe("/login");
        expect(location.searchParams.get("next"), path).toBe(path);
        if (path === "/admin") {
          expect(res.headers()["x-robots-tag"] ?? "").toContain("noindex");
        }
      }

      const login = await api.get("/login");
      expect(login.status()).toBe(200);
      expect(login.headers()["x-robots-tag"] ?? "").toContain("noindex");
    } finally {
      await api.dispose();
    }
  });

  test("в браузере /admin/leads открывает форму входа", async ({ page }) => {
    await page.goto("/admin/leads");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fleads/);
    await expect(page.getByLabel("Пароль", { exact: true })).toBeVisible();
  });

  test("API медиатеки без сессии → 401", async ({ playwright }, testInfo) => {
    const api = await anonRequest(playwright, testInfo);
    try {
      const list = await api.get("/api/admin/media");
      expect(list.status()).toBe(401);
      expect(await list.json()).toEqual({ error: "UNAUTHORIZED" });

      const upload = await api.post("/api/admin/media", {
        multipart: {
          file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("not-an-image") },
        },
      });
      expect(upload.status()).toBe(401);
      expect(await upload.json()).toEqual({ error: "UNAUTHORIZED" });
    } finally {
      await api.dispose();
    }
  });

  for (const route of ["/api/cron/retention", "/api/cron/blog"]) {
    test(`cron ${route}: 401 без/с неверным секретом, 200 с верным, GET → 405`, async ({
      playwright,
    }, testInfo) => {
      expect(CRON_SECRET, "CRON_SECRET из .env.e2e").not.toBe("");
      const api = await anonRequest(playwright, testInfo);
      try {
        expect((await api.post(route)).status()).toBe(401);
        expect(
          (await api.post(route, { headers: { Authorization: "Bearer wrong-secret" } })).status()
        ).toBe(401);
        expect(
          (await api.post(route, { headers: { Authorization: CRON_SECRET } })).status(),
          "секрет без схемы Bearer"
        ).toBe(401);

        const ok = await api.post(route, { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
        expect(ok.status()).toBe(200);
        expect(await ok.json()).toMatchObject({ ok: true });

        expect((await api.get(route)).status()).toBe(405);
      } finally {
        await api.dispose();
      }
    });
  }

  test("/media не отдаёт файлы вне каталога загрузок", async ({ playwright }, testInfo) => {
    const api = await anonRequest(playwright, testInfo);
    try {
      const paths = [
        "/media/..%2f..%2fetc%2fpasswd",
        "/media/%2e%2e/%2e%2e/package.json",
        "/media/2026/01/../../.env",
        "/media/..%2f..%2fpackage.json",
        "/media/..%2f..%2f.env.e2e",
        "/media/2026%2f..%2f..%2f..%2fpackage.json",
        "/media/..%5c..%5cpackage.json",
        "/media/%2e%2e%2f%2e%2e%2fsrc%2fapp%2flayout.tsx",
      ];
      for (const path of paths) {
        const res = await api.get(path, { maxRedirects: 0 });
        expect([400, 404], `${path} → ${res.status()}`).toContain(res.status());
        const body = await res.text();
        expect(body, path).not.toMatch(/root:|POSTGRES_URL|BETTER_AUTH_SECRET|"dependencies"/);
      }
    } finally {
      await api.dispose();
    }
  });

  test("заголовки безопасности и CSP", async ({ playwright }, testInfo) => {
    const api = await anonRequest(playwright, testInfo);
    try {
      for (const path of ["/", "/prices", "/login"]) {
        const res = await api.get(path);
        expect(res.status(), path).toBe(200);
        const h = res.headers();
        const csp = h["content-security-policy"] ?? "";
        expect(csp, path).not.toBe("");

        const frameDenied =
          h["x-frame-options"]?.toUpperCase() === "DENY" || /frame-ancestors 'none'/.test(csp);
        expect(frameDenied, `${path}: X-Frame-Options/frame-ancestors`).toBe(true);
        expect(h["x-content-type-options"], path).toBe("nosniff");
        expect(h["referrer-policy"] ?? "", path).not.toBe("");
        expect(h["x-powered-by"], path).toBeUndefined();

        const directives = new Map(
          csp
            .split(";")
            .map((d) => d.trim().split(/\s+/))
            .filter((parts) => parts[0])
            .map(([name, ...values]) => [name, values] as const)
        );
        const frameSrc = directives.get("frame-src") ?? [];
        for (const src of [
          "https://yandex.ru",
          "https://*.yandex.ru",
          "https://vk.com",
          "https://vk.ru",
          "https://vkvideo.ru",
          "https://rutube.ru",
        ]) {
          expect(frameSrc, `frame-src ${src}`).toContain(src);
        }
        for (const directive of ["script-src", "connect-src", "img-src"]) {
          const values = directives.get(directive) ?? [];
          for (const src of [
            "https://mc.yandex.ru",
            "https://mc.yandex.com",
            "https://yastatic.net",
          ]) {
            expect(values, `${directive} ${src}`).toContain(src);
          }
        }
        expect(directives.get("object-src"), "object-src").toEqual(["'none'"]);
        expect(directives.get("frame-ancestors"), "frame-ancestors").toEqual(["'none'"]);
      }
    } finally {
      await api.dispose();
    }
  });

  test("главная: cookie-согласие и карта без нарушений CSP", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (/Refused to|Content Security Policy/i.test(text)) violations.push(text);
    });
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        console.error(
          `Refused to load (CSP ${e.violatedDirective}): ${e.blockedURI} at ${e.sourceFile}:${e.lineNumber}:${e.columnNumber}`
        );
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Принять" }).click();
    const showMap = page.getByRole("button", { name: "Показать карту" });
    await showMap.scrollIntoViewIfNeeded();
    await showMap.click();
    const mapFrame = page.locator('iframe[src*="yandex.ru/map-widget"]');
    await expect(mapFrame).toBeAttached();
    // Даём iframe начать загрузку — нарушение CSP фиксируется сразу при навигации фрейма
    await page.waitForLoadState("load");
    await page.waitForTimeout(1500);

    expect(violations).toEqual([]);
  });

  test("регистрации нет: /register → 404, sign-up отклоняется", async ({
    playwright,
  }, testInfo) => {
    const api = await anonRequest(playwright, testInfo);
    const email = `e2e-signup-${uniq()}@example.com`;
    try {
      const register = await api.get("/register");
      expect(register.status()).toBe(404);

      const signUp = await api.post("/api/auth/sign-up/email", {
        headers: { Origin: baseUrlOf(testInfo) },
        data: { email, password: "Sup3r-long-password!", name: "E2E" },
      });
      expect(signUp.status(), await signUp.text()).toBeGreaterThanOrEqual(400);
      expect(signUp.status()).toBeLessThan(500);

      const rows = await sql()`select id from "user" where email = ${email}`;
      expect(rows).toHaveLength(0);
    } finally {
      await api.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// Под админом
// ---------------------------------------------------------------------------

test("API медиатеки с сессией: SVG отклоняется (4xx)", async ({ page }) => {
  await page.goto("/admin");
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>'
  );
  for (const mimeType of ["image/svg+xml", "image/png"]) {
    const res = await page.request.post("/api/admin/media", {
      multipart: {
        file: { name: mimeType === "image/png" ? "fake.png" : "x.svg", mimeType, buffer: svg },
        folder: "e2e-security",
      },
    });
    expect(res.status(), `${mimeType}: ${await res.text()}`).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  }
  const list = await page.request.get("/api/admin/media?folder=e2e-security");
  expect(list.status()).toBe(200);
});

type CapturedAction = { url: string; headers: Record<string, string>; body: string };

/** Ждёт POST Server Action, тело которого удовлетворяет `match`. */
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

type ReplayResult = { status: number; text: string; location: string | undefined };

/**
 * Повтор перехваченного Server Action вне браузера: те же URL, `next-action`, `content-type`,
 * тело (с заменой `from` → `to`) и cookie `cookie` (без cookie — анонимный вызов).
 */
async function replayAction(
  api: APIRequestContext,
  captured: CapturedAction,
  from: string,
  to: string,
  cookie?: string
): Promise<ReplayResult> {
  const pick = (name: string) => captured.headers[name];
  const headers: Record<string, string> = {
    "next-action": pick("next-action") ?? "",
    "content-type": pick("content-type") ?? "text/plain;charset=UTF-8",
    accept: pick("accept") ?? "text/x-component",
    origin: pick("origin") ?? new URL(captured.url).origin,
  };
  const routerState = pick("next-router-state-tree");
  if (routerState) headers["next-router-state-tree"] = routerState;
  if (cookie) headers["cookie"] = cookie;

  const res = await api.post(captured.url, {
    headers,
    data: captured.body.replaceAll(from, to),
    maxRedirects: 0,
  });
  return { status: res.status(), text: await res.text(), location: res.headers()["location"] };
}

/** Отказ: оптимистичный редирект proxy на /login или `{ ok:false, error:'Нет доступа' }`. */
function expectDenied(result: ReplayResult, label: string, viaAction: boolean) {
  expect(result.text, label).not.toContain('"ok":true');
  if (viaAction) {
    expect(result.status, label).toBe(200);
    expect(result.text, label).toContain('"ok":false');
    expect(result.text, label).toContain("Нет доступа");
  } else {
    expect([303, 307, 308], `${label}: ${result.status}`).toContain(result.status);
    expect(result.location ?? "", label).toContain("/login");
  }
}

/**
 * Две попытки на действие: без cookie (до action доходит только proxy) и с поддельной
 * session cookie (proxy пропускает — проверяет сам `adminAction`).
 */
async function expectReplayDenied(
  playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } },
  testInfo: TestInfo,
  captured: CapturedAction,
  from: string,
  to: string,
  label: string
) {
  const api = await anonRequest(playwright, testInfo);
  try {
    const noCookie = await replayAction(api, captured, from, to);
    testInfo.annotations.push({
      type: "observed",
      description: `${label} без cookie → ${noCookie.status} ${noCookie.location ?? ""}`,
    });
    expectDenied(noCookie, `${label} без cookie`, false);

    const forged = await replayAction(
      api,
      captured,
      from,
      to,
      `${SESSION_COOKIE}=forged-${uniq()}.invalid-signature`
    );
    testInfo.annotations.push({
      type: "observed",
      description: `${label} с поддельной cookie → ${forged.status}`,
    });
    expectDenied(forged, `${label} с поддельной cookie`, true);
  } finally {
    await api.dispose();
  }
}

test.describe("прямой вызов Server Action без авторизации", () => {
  test("createTagInline и saveArticle", async ({ page, playwright }, testInfo) => {
    const token = uniq();
    const tagName = `e2e-sec-tag-${token}`;
    const title = `E2E sec article ${token}`;
    const forgedToken = `${token}x9`;

    try {
      await page.goto("/admin/blog/articles/new");

      // Тег создаётся inline (под админом — это контроль: тот же запрос с сессией проходит)
      const tagCapture = captureAction(page, (b) => b.includes(`"name":"${tagName}"`));
      await page.getByLabel("Новый тег").fill(tagName);
      await page.getByLabel("Новый тег").press("Enter");
      const tagReq = await tagCapture;
      await expectToast(page, `Тег «${tagName}» создан`);

      const articleCapture = captureAction(page, (b) => b.includes('"title"') && b.includes(title));
      await page.getByRole("textbox", { name: "Заголовок", exact: true }).fill(title);
      await page.getByRole("button", { name: "Сохранить", exact: true }).click();
      const articleReq = await articleCapture;
      await expectToast(page, "Статья сохранена");

      const db = sql();
      expect(await db`select id from blog_tags where name = ${tagName}`).toHaveLength(1);
      expect(await db`select id from articles where title = ${title}`).toHaveLength(1);

      await expectReplayDenied(playwright, testInfo, tagReq, token, forgedToken, "createTagInline");
      await expectReplayDenied(playwright, testInfo, articleReq, token, forgedToken, "saveArticle");

      expect(await db`select id from blog_tags where name like ${`%${forgedToken}%`}`).toHaveLength(
        0
      );
      expect(await db`select id from articles where title like ${`%${forgedToken}%`}`).toHaveLength(
        0
      );

      // Повторное чтение под админом: в списке статей нет записи из анонимного вызова
      await page.goto("/admin/blog/articles");
      await expect(page.getByText(title).first()).toBeVisible();
      await expect(page.getByText(`E2E sec article ${forgedToken}`)).toHaveCount(0);
    } finally {
      const db = sql();
      await db`delete from articles where title like ${`E2E sec article ${token}%`}`;
      await db`delete from blog_tags where name like ${`e2e-sec-tag-${token}%`}`;
    }
  });

  test("saveExtra (цены)", async ({ page, playwright }, testInfo) => {
    const token = uniq();
    const name = `E2E sec extra ${token}`;
    const forgedToken = `${token}x9`;

    try {
      await page.goto("/admin/pricing?tab=extras");
      await page.getByRole("button", { name: "Добавить услугу" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Название").fill(name);
      await dialog.getByLabel("Цена, ₽").fill("10");
      // Не показываем тестовую услугу на публичном сайте
      await dialog.getByRole("switch").click();

      const capture = captureAction(page, (b) => b.includes(name) && b.includes('"priceUnit"'));
      await dialog.getByRole("button", { name: "Сохранить" }).click();
      const req = await capture;
      await expectToast(page, "Услуга добавлена");

      const db = sql();
      expect(await db`select id from extra_services where name = ${name}`).toHaveLength(1);

      await expectReplayDenied(playwright, testInfo, req, token, forgedToken, "saveExtra");

      expect(
        await db`select id from extra_services where name like ${`%${forgedToken}%`}`
      ).toHaveLength(0);
      await page.reload();
      await expect(page.getByText(name, { exact: true })).toBeVisible();
      await expect(page.getByText(`E2E sec extra ${forgedToken}`)).toHaveCount(0);
    } finally {
      await sql()`delete from extra_services where name like ${`E2E sec extra ${token}%`}`;
    }
  });
});

// ---------------------------------------------------------------------------
// Обезличивание заявок
// ---------------------------------------------------------------------------

test("retention: старая заявка обезличивается, свежая не затронута", async ({
  playwright,
}, testInfo) => {
  const db = sql();
  const token = uniq();
  const [consent] = await db<{ id: string }[]>`
    select id from legal_documents
    where type = 'consent' and published_at is not null
    order by published_at desc limit 1`;
  expect(consent, "опубликованный документ согласия (seed)").toBeTruthy();

  const insertLead = (label: string, createdAtSql: ReturnType<typeof db.unsafe>) => db<
    { id: string }[]
  >`
    insert into leads (type, source_block, form_title, page_url, name, phone, comment,
      consent_document_id, consent_at, ip_hash, user_agent, created_at)
    values ('callback', 'E2E', 'E2E retention', '/', ${`Old ${label} ${token}`}, '+79990000000',
      ${`retention ${label} ${token}`}, ${consent!.id}, now(), ${"a".repeat(64)}, 'E2E-UA', ${createdAtSql})
    returning id`;

  const ids: string[] = [];
  try {
    // 130 мес. — старше максимально допустимого срока хранения (120 мес.)
    const [old] = await insertLead("old", db.unsafe("now() - interval '130 months'"));
    const [fresh] = await insertLead("fresh", db.unsafe("now()"));
    ids.push(old!.id, fresh!.id);

    const api = await anonRequest(playwright, testInfo);
    try {
      const res = await api.post("/api/cron/retention", {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      expect(res.status()).toBe(200);
      const json = (await res.json()) as { ok: boolean; anonymized?: number };
      expect(json.ok).toBe(true);
      expect(json.anonymized ?? 0).toBeGreaterThanOrEqual(1);
    } finally {
      await api.dispose();
    }

    const [oldRow] = await db`
      select name, phone, comment, ip_hash, user_agent, anonymized_at, type, form_title
      from leads where id = ${old!.id}`;
    expect(oldRow).toMatchObject({
      name: null,
      phone: null,
      comment: null,
      ip_hash: null,
      user_agent: "",
      type: "callback",
      form_title: "E2E retention",
    });
    expect(oldRow!.anonymized_at).not.toBeNull();

    const [freshRow] = await db`
      select name, phone, comment, ip_hash, user_agent, anonymized_at
      from leads where id = ${fresh!.id}`;
    expect(freshRow).toMatchObject({
      name: `Old fresh ${token}`,
      phone: "+79990000000",
      comment: `retention fresh ${token}`,
      ip_hash: "a".repeat(64),
      user_agent: "E2E-UA",
      anonymized_at: null,
    });
  } finally {
    if (ids.length) await db`delete from leads where id in ${db(ids)}`;
  }
});

// ---------------------------------------------------------------------------
// 2FA
// ---------------------------------------------------------------------------

test("2FA: включение показывает QR-код (SVG), без подтверждения 2FA не включается", async ({
  page,
}) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD не заданы");
  const db = sql();
  const [user] = await db<{ id: string; two_factor_enabled: boolean | null }[]>`
    select id, two_factor_enabled from "user" where email = ${email}`;
  expect(user, "e2e-админ").toBeTruthy();
  expect(user!.two_factor_enabled, "2FA выключена до теста").not.toBe(true);

  try {
    await page.goto("/admin/account");
    await page.getByRole("button", { name: "Включить 2FA" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Пароль", { exact: true }).fill(password);
    await dialog.getByRole("button", { name: "Продолжить" }).click();
    await expect(dialog).toBeHidden();

    const qr = page.locator("svg").filter({
      has: page.locator("title", { hasText: "QR-код для приложения-аутентификатора" }),
    });
    await expect(qr).toBeVisible();
    expect(await qr.locator("path").count()).toBeGreaterThan(0);
    await expect(page.getByText("Или введите ключ вручную:")).toBeVisible();

    // До подтверждения кодом 2FA не включена
    const [after] = await db<{ two_factor_enabled: boolean | null }[]>`
      select two_factor_enabled from "user" where id = ${user!.id}`;
    expect(after!.two_factor_enabled).not.toBe(true);

    await page.getByRole("button", { name: "Отмена" }).click();
    await expect(page.getByRole("button", { name: "Включить 2FA" })).toBeVisible();
  } finally {
    // Общий вход e2e не должен требовать 2FA: убираем незавершённую настройку
    await db`update "user" set two_factor_enabled = false where id = ${user!.id}`;
    await db`delete from two_factor where user_id = ${user!.id}`;
  }
});
