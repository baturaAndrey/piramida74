import { expect, test, type Page } from "@playwright/test";
import { expectToast } from "./helpers/admin";
import { trackConsoleErrors, uniq } from "./helpers/console";
import { sql } from "./helpers/db";

/** Юр. документы: путь страницы и тип в `legal_documents` */
const LEGAL_PAGES = [
  { path: "/politika", type: "policy", title: /Политика/ },
  { path: "/soglasie", type: "consent", title: /Согласие/ },
] as const;

/** Поля реквизитов оператора в /admin/settings → плейсхолдер в тексте документа */
const OPERATOR_FIELDS = [
  { label: "Оператор (ИП / ООО)", placeholder: "operator_name" },
  { label: "Email для обращений", placeholder: "operator_email" },
  { label: "ИНН", placeholder: "operator_inn" },
  { label: "ОГРН / ОГРНИП", placeholder: "operator_ogrn" },
  { label: "Адрес оператора", placeholder: "operator_address" },
] as const;

type OperatorPlaceholder = (typeof OPERATOR_FIELDS)[number]["placeholder"];

const EMPTY_VALUE = "[не указано]";

/** Текст статьи юр. документа (заголовок, версия и тело). */
async function readLegalArticle(page: Page, path: string): Promise<string> {
  const response = await page.goto(path);
  expect(response?.status(), `${path} → 200`).toBe(200);
  const article = page.locator("main article");
  await expect(article.getByRole("heading", { level: 1 })).toBeVisible();
  return article.innerText();
}

/** Сколько раз плейсхолдер встречается в текущей опубликованной версии документа. */
async function placeholderCount(type: string, placeholder: string): Promise<number> {
  const [doc] = await sql()<{ body: string }[]>`
    select body from legal_documents
    where type = ${type} and published_at is not null
    order by published_at desc limit 1`;
  expect(doc, `опубликованный документ ${type}`).toBeDefined();
  return doc!.body.split(`{{${placeholder}}}`).length - 1;
}

const countOccurrences = (text: string, needle: string) => text.split(needle).length - 1;

/** Заполняет реквизиты оператора в /admin/settings и сохраняет. */
async function saveOperator(page: Page, values: Record<OperatorPlaceholder, string>) {
  await page.goto("/admin/settings");
  let changed = false;
  for (const { label, placeholder } of OPERATOR_FIELDS) {
    const input = page.getByLabel(label, { exact: true });
    if ((await input.inputValue()) !== values[placeholder]) changed = true;
    await input.fill(values[placeholder]);
  }
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expectToast(page, changed ? /Сохранено/ : /Сохранено|Изменений нет/);
}

test.describe("SEO и юридические страницы", () => {
  test("/politika и /soglasie: 200, заголовок, версия, без «{{»", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    for (const { path, title } of LEGAL_PAGES) {
      const text = await readLegalArticle(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      expect(text).toMatch(/Версия \S+ от \d{1,2} [а-я]+ \d{4}/);
      expect(text, `${path}: нет неподставленных плейсхолдеров`).not.toContain("{{");
    }
    expect(errors()).toEqual([]);
  });

  test("реквизиты operator.* из /admin/settings подставляются в документы ровно один раз", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);

    // Исходные значения — чтобы вернуть их в finally (настройки глобальные)
    await page.goto("/admin/settings");
    const original = {} as Record<OperatorPlaceholder, string>;
    for (const { label, placeholder } of OPERATOR_FIELDS) {
      original[placeholder] = await page.getByLabel(label, { exact: true }).inputValue();
    }

    // Пустые реквизиты видны как «[не указано]»
    if (Object.values(original).some((v) => v.trim() === "")) {
      const text = await readLegalArticle(page, "/politika");
      expect(text).toContain(EMPTY_VALUE);
    }

    const suffix = uniq();
    const filled: Record<OperatorPlaceholder, string> = {
      operator_name: `ООО «E2E Оператор ${suffix}»`,
      operator_email: `e2e-${suffix}@example.com`,
      operator_inn: "7451234567",
      operator_ogrn: "1027400000001",
      operator_address: `г. Челябинск, ул. Тестовая, ${suffix}`,
    };

    try {
      await saveOperator(page, filled);

      for (const { path, type } of LEGAL_PAGES) {
        const text = await readLegalArticle(page, path);
        expect(text, `${path}: нет «{{»`).not.toContain("{{");
        for (const { placeholder } of OPERATOR_FIELDS) {
          const value = filled[placeholder];
          const expected = await placeholderCount(type, placeholder);
          expect(countOccurrences(text, value), `${path}: ${placeholder} подставлен`).toBe(
            expected
          );
          // Подстановка однократная: значение не склеено с самим собой
          expect(text, `${path}: ${placeholder} не дублируется`).not.toContain(value + value);
        }
        // Все реквизиты заполнены — пометок о пропуске быть не должно
        expect(text, `${path}: без «${EMPTY_VALUE}»`).not.toContain(EMPTY_VALUE);
      }
    } finally {
      await saveOperator(page, original);
    }
    expect(errors()).toEqual([]);
  });

  test("попап политики в футере показывает тот же текст, что /politika", async ({ page }) => {
    // Реализация: в форме заявки — ссылки на /soglasie и /politika (новая вкладка), а попап
    // с полным текстом (PolicyDialog) — в футере для политики. Оба берут text из
    // getCurrentLegalDocument, поэтому сверяем попап футера со страницей.
    const errors = trackConsoleErrors(page);
    await readLegalArticle(page, "/politika");
    const paragraphs = await page
      .locator("main article p")
      .evaluateAll((nodes) =>
        nodes.map((n) => (n.textContent ?? "").trim()).filter((t) => t.length > 40)
      );
    expect(paragraphs.length).toBeGreaterThan(0);

    await page
      .getByRole("contentinfo")
      .getByRole("button", { name: "Политика конфиденциальности" })
      .click();
    // Плашка cookie — тоже role="dialog", а попап политики грузится отдельным чанком после
    // клика (до его появления плашка ещё не скрыта модалкой): берём именно попап
    const dialog = page.getByRole("dialog").and(page.locator(':not([aria-label="Cookie"])'));
    await expect(dialog).toBeVisible();
    const dialogText = (await dialog.innerText()).replace(/\s+/g, " ");
    for (const paragraph of paragraphs) {
      expect(dialogText).toContain(paragraph.replace(/\s+/g, " "));
    }

    // Ссылка «согласие» в форме заявки ведёт на /soglasie
    await page.goto("/");
    const consentLink = page
      .locator("#getconsultation")
      .getByRole("link", { name: "согласие на обработку персональных данных" });
    await expect(consentLink).toHaveAttribute("href", "/soglasie");
    expect(errors()).toEqual([]);
  });

  test("/sitemap.xml: валидный XML с публичными страницами и без служебных", async ({
    page,
    request,
  }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();

    // Парсим XML средствами браузера: parsererror = невалидный документ
    await page.goto("/robots.txt");
    const locs = await page.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, "application/xml");
      if (doc.getElementsByTagName("parsererror").length > 0) return null;
      return Array.from(
        doc.getElementsByTagName("loc"),
        (n) => new URL(n.textContent ?? "").pathname
      );
    }, xml);
    expect(locs, "sitemap.xml — валидный XML").not.toBeNull();

    for (const path of [
      "/",
      "/menu",
      "/prices",
      "/tournaments",
      "/calculator",
      "/blog",
      "/politika",
      "/soglasie",
    ]) {
      expect(locs, `в sitemap есть ${path}`).toContain(path);
    }
    for (const prefix of ["/admin", "/spasibo", "/login"]) {
      expect(
        locs!.filter((p) => p === prefix || p.startsWith(`${prefix}/`)),
        `в sitemap нет ${prefix}`
      ).toEqual([]);
    }
  });

  test("/robots.txt: Disallow служебных путей и абсолютный Sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const lines = (await response.text()).split(/\r?\n/).map((l) => l.trim());
    for (const path of ["/admin", "/login", "/api/", "/spasibo"]) {
      expect(lines, `Disallow: ${path}`).toContain(`Disallow: ${path}`);
    }
    expect(lines.some((l) => /^Sitemap: https?:\/\/[^/]+\/sitemap\.xml$/.test(l))).toBe(true);
  });

  test("редиректы со старых URL и 410 для старых файлов", async ({ request, baseURL }) => {
    const cases: { from: string; to: string; status: RegExp }[] = [
      { from: "/index.php", to: "/", status: /^301$/ },
      { from: "/politika/politika.html", to: "/politika", status: /^301$/ },
      { from: "/politika/politika-content.html", to: "/politika", status: /^301$/ },
      { from: "/politika/", to: "/politika", status: /^30\d$/ },
      { from: "/spasibo/", to: "/spasibo", status: /^30\d$/ },
    ];
    for (const { from, to, status } of cases) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(String(response.status()), `${from} → статус`).toMatch(status);
      const location = response.headers()["location"] ?? "";
      expect(new URL(location, baseURL).pathname, `${from} → ${to}`).toBe(to);
    }

    for (const gone of [
      "/uploads/2024/10/bg.webp",
      "/public/themes/piramida/assets/img/logo.png",
    ]) {
      const response = await request.get(gone, { maxRedirects: 0 });
      expect(response.status(), `${gone} → 410`).toBe(410);
    }
  });

  test("/yandex_b2d6db0830b1e9ce.html отдаёт файл подтверждения", async ({ request }) => {
    const response = await request.get("/yandex_b2d6db0830b1e9ce.html");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("Verification: b2d6db0830b1e9ce");
  });

  test("несуществующая страница → 404 в стиле старого сайта, noindex", async ({ page }) => {
    // 404 самого документа — ожидаемая ошибка консоли
    const errors = trackConsoleErrors(page, [/status of 404/]);
    const response = await page.goto(`/net-takoy-stranicy-${uniq()}`);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Страница не найдена!" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "На главную", exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    expect(errors()).toEqual([]);
  });
});
