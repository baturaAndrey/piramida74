import { expect, test, type Page } from "@playwright/test";
import { expectToast } from "./helpers/admin";
import { trackConsoleErrors, uniq } from "./helpers/console";
import { todayPlus } from "./helpers/dates";
import { sql } from "./helpers/db";

/**
 * Блог: публикация, черновик и подписанный предпросмотр, отложенная публикация, смена slug
 * (301), noindex, рубрика с пагинацией, автор, OG-картинка.
 *
 * Кэш: публичные чтения блога — `'use cache'` с тегом `blog`; админские действия делают
 * `updateTag` (данные видны сразу), а proxy-lookup `/blog/<slug>` сбрасывается `bumpBlogRouteCache`.
 * Данные, вставленные прямым SQL, становятся видны только после `POST /api/cron/blog`
 * (`revalidateTag(blog, "max")` — stale-while-revalidate, поэтому проверки через `expect.poll`).
 */

const RUTUBE_ID = "0123456789abcdef0123456789abcdef";
/** Документ 404 браузер пишет в консоль — ожидаемо в негативных проверках */
const NOT_FOUND_RESOURCE = /Failed to load resource: the server responded with a status of 404/;
/** Сколько страниц /blog просматривать в поисках карточки */
const BLOG_PAGES_TO_SCAN = 4;
const ID_URL_RE = /\/admin\/blog\/articles\/([0-9a-f-]{36})$/;

type Status = "Черновик" | "Запланирована" | "Опубликована";

type ArticleOptions = {
  title: string;
  status?: Status;
  /** datetime-local, время Екатеринбурга */
  publishAt?: string;
  body?: string;
  author?: string;
  noindex?: boolean;
};

/** Создаёт статью через форму (кнопка «Сохранить» — остаёмся на странице редактирования). */
async function createArticle(
  page: Page,
  opts: ArticleOptions
): Promise<{ id: string; slug: string }> {
  await page.goto("/admin/blog/articles/new");
  await page.getByLabel("Заголовок", { exact: true }).fill(opts.title);
  // slug следует за заголовком (транслит) — заодно признак завершённой гидрации
  const slugInput = page.locator("#article-slug:visible");
  await expect(slugInput).not.toHaveValue("");
  const slug = await slugInput.inputValue();

  await page.getByLabel("Краткое описание", { exact: true }).fill(`Описание: ${opts.title}`);
  if (opts.status && opts.status !== "Черновик") {
    await page.getByLabel("Статус", { exact: true }).click();
    await page.getByRole("option", { name: opts.status, exact: true }).click();
  }
  if (opts.publishAt) {
    await page.getByLabel("Дата и время публикации", { exact: true }).fill(opts.publishAt);
  }
  if (opts.author) {
    await page.getByLabel("Автор", { exact: true }).click();
    await page.getByRole("option", { name: opts.author, exact: true }).click();
  }
  await page.getByLabel("Текст статьи", { exact: true }).fill(opts.body ?? "Текст статьи.");
  if (opts.noindex) {
    await page.getByRole("button", { name: /^SEO/ }).click();
    await page.getByRole("switch", { name: "Не индексировать (noindex)" }).click();
  }

  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expectToast(page, "Статья сохранена");
  await page.waitForURL(ID_URL_RE);
  const id = ID_URL_RE.exec(new URL(page.url()).pathname)?.[1];
  expect(id).toBeTruthy();
  return { id: id!, slug };
}

async function postCron(page: Page) {
  const res = await page.request.post("/api/cron/blog", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true });
}

async function statusOf(page: Page, path: string): Promise<number> {
  return (await page.request.get(path, { maxRedirects: 0 })).status();
}

async function textOf(page: Page, path: string): Promise<string> {
  const res = await page.request.get(path);
  expect(res.status()).toBe(200);
  return res.text();
}

test.describe("Блог", () => {
  test("публикация: slug транслитом, H1, оглавление, Rutube, без чужого iframe, sitemap, RSS, OG", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    const suffix = uniq();
    const title = `E2E Статья ${suffix}`;
    const body = [
      "Вступление статьи.",
      "",
      "## Первый раздел",
      "",
      "Текст первого раздела.",
      "",
      `{{Видео: https://rutube.ru/video/${RUTUBE_ID}/}}`,
      "",
      "## Второй раздел",
      "",
      "{{Видео: https://evil.example/x}}",
    ].join("\n");

    const { slug } = await createArticle(page, { title, status: "Опубликована", body });
    expect(slug).toBe(`e2e-statya-${suffix}`);

    await page.goto("/blog");
    await expect(page.locator("article").filter({ hasText: title })).toBeVisible();

    const res = await page.goto(`/blog/${slug}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const toc = page.getByRole("navigation", { name: "Оглавление статьи" });
    await expect(toc).toBeVisible();
    await expect(toc.getByRole("link", { name: "Первый раздел" })).toBeVisible();
    await expect(toc.getByRole("link", { name: "Второй раздел" })).toBeVisible();

    const iframes = page.locator("article iframe, main iframe");
    await expect(iframes).toHaveCount(1);
    await expect(iframes.first()).toHaveAttribute(
      "src",
      new RegExp(`^https://rutube\\.ru/play/embed/${RUTUBE_ID}`)
    );
    await expect(page.locator('iframe[src*="evil.example"]')).toHaveCount(0);

    await expect
      .poll(async () => (await textOf(page, "/sitemap.xml")).includes(`/blog/${slug}</loc>`))
      .toBe(true);
    await expect
      .poll(async () => (await textOf(page, "/blog/rss.xml")).includes(`/blog/${slug}`))
      .toBe(true);

    // Next добавляет к файловому маршруту opengraph-image хэш (`opengraph-image-<hash>`),
    // поэтому адрес берём из og:image, а не строим `/blog/<slug>/opengraph-image` (там 404)
    const ogUrl = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(new URL(ogUrl ?? "").pathname).toMatch(new RegExp(`^/blog/${slug}/opengraph-image`));
    const og = await page.request.get(new URL(ogUrl ?? "").pathname + new URL(ogUrl ?? "").search);
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");

    expect(errors()).toEqual([]);
  });

  test("черновик: не виден, 404; подписанный предпросмотр работает, подделанный токен — «не найдено»", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page, [NOT_FOUND_RESOURCE]);
    const suffix = uniq();
    const title = `E2E Черновик ${suffix}`;
    const { id, slug } = await createArticle(page, { title, body: "## Раздел\n\nЧерновой текст." });

    const popupPromise = page.context().waitForEvent("page");
    await page.getByRole("button", { name: "Открыть подписанный предпросмотр" }).click();
    const popup = await popupPromise;
    const popupErrors = trackConsoleErrors(popup);
    await popup.waitForURL(new RegExp(`/blog/preview/${id}\\?t=`));
    await expect(popup.getByText("Предпросмотр. Статья не опубликована")).toBeVisible();
    await expect(popup.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(popup.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    const previewUrl = new URL(popup.url());
    await popup.close();
    expect(popupErrors()).toEqual([]);

    await page.goto("/blog");
    await expect(page.locator("article").filter({ hasText: title })).toHaveCount(0);

    const draft = await page.goto(`/blog/${slug}`);
    expect(draft?.status()).toBe(404);
    await expect(page.getByText("Страница не найдена!")).toBeVisible();

    // Подделка токена: меняем один символ подписи
    const token = previewUrl.searchParams.get("t") ?? "";
    expect(token.length).toBeGreaterThan(10);
    const last = token.at(-1);
    const forged = `${token.slice(0, -1)}${last === "A" ? "B" : "A"}`;
    const forgedRes = await page.goto(`/blog/preview/${id}?t=${encodeURIComponent(forged)}`);
    // Известное поведение: страница стримится, notFound() внутри Suspense уже не меняет код (200)
    test.info().annotations.push({
      type: "preview-forged-token-status",
      description: String(forgedRes?.status()),
    });
    expect([200, 404]).toContain(forgedRes?.status());
    await expect(page.getByText("Страница не найдена!")).toBeVisible();
    await expect(page.getByText(title)).toHaveCount(0);
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();

    expect(errors()).toEqual([]);
  });

  test("отложенная публикация: в будущем не видна, после переноса даты и cron — видна", async ({
    page,
  }) => {
    // Без пересборки с правкой cron (bumpBlogRouteCache) proxy может держать 404 до 60 с
    test.setTimeout(150_000);
    const errors = trackConsoleErrors(page, [NOT_FOUND_RESOURCE]);
    const suffix = uniq();
    const title = `E2E Отложенная ${suffix}`;
    const { id, slug } = await createArticle(page, {
      title,
      status: "Запланирована",
      publishAt: `${todayPlus(1)}T12:00`,
    });
    await expect(page.getByText(/Запланирована на/)).toBeVisible();

    await page.goto("/blog");
    await expect(page.locator("article").filter({ hasText: title })).toHaveCount(0);
    expect(await statusOf(page, `/blog/${slug}`)).toBe(404);

    // Дата в прошлом (с запасом больше 5-минутного округления «сейчас» в ключах кэша).
    // Другие тесты публикуют статьи «сейчас» — поэтому ниже ищем карточку на нескольких страницах /blog
    await sql()`update articles set published_at = now() - interval '10 minutes' where id = ${id}`;
    await postCron(page);

    await expect
      .poll(() => statusOf(page, `/blog/${slug}`), { timeout: 75_000, intervals: [1_000, 5_000] })
      .toBe(200);
    await expect
      .poll(
        async () => {
          for (let n = 1; n <= BLOG_PAGES_TO_SCAN; n++) {
            const res = await page.goto(n === 1 ? "/blog" : `/blog?page=${n}`);
            if (res?.status() !== 200) break;
            if ((await page.locator("article").filter({ hasText: title }).count()) > 0) return 1;
          }
          return 0;
        },
        { timeout: 30_000 }
      )
      .toBe(1);
    await page.goto(`/blog/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    expect(errors()).toEqual([]);
  });

  test("смена slug: старый адрес отдаёт 301 на новый, запись в redirects", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const suffix = uniq();
    const title = `E2E Переезд ${suffix}`;
    const { slug: oldSlug } = await createArticle(page, { title, status: "Опубликована" });
    const newSlug = `${oldSlug}-novyy`;

    await page.locator("#article-slug:visible").fill(newSlug);
    const notice = page.getByText(
      `Смена slug создаст 301-редирект со старого адреса /blog/${oldSlug}`
    );
    await expect(notice).toBeVisible();
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    // Тост «Статья сохранена» от создания ещё на экране — ждём обновления формы (новый slug
    // стал сохранённым, предупреждение о 301 исчезло)
    await expect(notice).toBeHidden();

    const res = await page.request.get(`/blog/${oldSlug}`, { maxRedirects: 0 });
    test.info().annotations.push({ type: "slug-change-status", description: String(res.status()) });
    expect(res.status()).toBe(301);
    expect(new URL(res.headers()["location"] ?? "", "http://x").pathname).toBe(`/blog/${newSlug}`);

    await page.goto(`/blog/${oldSlug}`);
    await expect(page).toHaveURL(new RegExp(`/blog/${newSlug}$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    const rows = await sql()<{ to_path: string; code: number }[]>`
      select to_path, code from redirects where from_path = ${`/blog/${oldSlug}`}`;
    expect(rows).toEqual([{ to_path: `/blog/${newSlug}`, code: 301 }]);

    expect(errors()).toEqual([]);
  });

  test("noindex: meta robots noindex, нет в sitemap и RSS", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const suffix = uniq();
    const title = `E2E Noindex ${suffix}`;
    const { slug } = await createArticle(page, { title, status: "Опубликована", noindex: true });

    const res = await page.goto(`/blog/${slug}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);

    expect(await textOf(page, "/sitemap.xml")).not.toContain(`/blog/${slug}<`);
    expect(await textOf(page, "/blog/rss.xml")).not.toContain(`/blog/${slug}`);

    expect(errors()).toEqual([]);
  });

  test("рубрика: 13 статей → 12 карточек и «Показать ещё», на ?page=2 — остальное", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    const suffix = uniq();
    const rubricName = `E2E Рубрика ${suffix}`;

    await page.goto("/admin/blog/rubrics");
    await page.getByRole("button", { name: "Новая рубрика" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Название", { exact: true }).fill(rubricName);
    await expect(dialog.locator("#rubric-slug")).not.toHaveValue("");
    const rubricSlug = await dialog.locator("#rubric-slug").inputValue();
    expect(rubricSlug).toBe(`e2e-rubrika-${suffix}`);
    await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expectToast(page, "Рубрика создана");

    // 13 статей — прямым SQL; кэш блога сбрасывается cron-эндпоинтом
    const [rubric] = await sql()<
      { id: string }[]
    >`select id from rubrics where slug = ${rubricSlug}`;
    expect(rubric?.id).toBeTruthy();
    await sql()`
      insert into articles (slug, title, excerpt, body, rubric_id, status, published_at)
      select ${`e2e-rub-${suffix}-`} || g, ${`E2E Рубричная ${suffix} №`} || g, '', 'Текст',
             ${rubric!.id}::uuid, 'published', now() - make_interval(mins => g + 10)
      from generate_series(1, 13) as g`;
    await postCron(page);

    const cards = page.getByRole("region", { name: "Статьи рубрики" }).locator("article");
    // Секция стримится (Suspense) — ждём её появления в каждой попытке; повтор — на случай
    // stale-while-revalidate после cron
    await expect(async () => {
      await page.goto(`/blog/${rubricSlug}`);
      await expect(cards).toHaveCount(12, { timeout: 10_000 });
    }).toPass({ timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: rubricName })).toBeVisible();
    const more = page.getByRole("link", { name: "Показать ещё" });
    await expect(more).toHaveAttribute("href", `/blog/${rubricSlug}?page=2`);

    await page.goto(`/blog/${rubricSlug}?page=2`);
    await expect(cards).toHaveCount(1);
    // Свежие сверху: на второй странице — самая старая (№13)
    await expect(cards.first()).toContainText(`E2E Рубричная ${suffix} №13`);

    expect(errors()).toEqual([]);
  });

  test("автор: страница /authors/<slug> со статьями и JSON-LD Person", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const suffix = uniq();
    const authorName = `E2E Автор ${suffix}`;

    await page.goto("/admin/blog/authors/new");
    await page.getByLabel("Имя", { exact: true }).fill(authorName);
    const slugInput = page.locator("#author-slug");
    await expect(slugInput).not.toHaveValue("");
    const authorSlug = await slugInput.inputValue();
    await page.getByLabel("Роль в клубе", { exact: true }).fill("Тренер клуба");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expectToast(page, "Автор сохранён");
    await page.waitForURL(/\/admin\/blog\/authors$/);

    const title = `E2E Авторская ${suffix}`;
    await createArticle(page, { title, status: "Опубликована", author: authorName });

    const res = await page.goto(`/authors/${authorSlug}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: authorName })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: title })).toBeVisible();

    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    const person = jsonLd
      .flatMap((text) => {
        const data: unknown = JSON.parse(text);
        return Array.isArray(data) ? data : [data];
      })
      .find((item) => (item as { "@type"?: string })["@type"] === "Person") as
      { name?: string } | undefined;
    expect(person?.name).toBe(authorName);

    expect(errors()).toEqual([]);
  });
});
