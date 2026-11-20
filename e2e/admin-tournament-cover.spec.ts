import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectToast, rowByText } from "./helpers/admin";
import { trackConsoleErrors, uniq } from "./helpers/console";
import { opDatePlus, todayPlus } from "./helpers/dates";
import { sql } from "./helpers/db";

/**
 * Турнир с афишей: создание в админке, загрузка обложки через ImageUploadField,
 * отображение на /tournaments и на главной («Календарный план», ближайшие 5),
 * отказ для запрещённых файлов, прошедший/идущий турнир, «Дублировать».
 */

const POSTER = path.join(__dirname, "fixtures", "poster.png");
/** Ответ 400/413 на запрещённый файл браузер пишет в консоль — это ожидаемо в негативном тесте */
const EXPECTED_UPLOAD_ERRORS = [
  /Failed to load resource: the server responded with a status of 4\d\d/,
];

/** Первый URL из `srcset` («/media/… 320w, …») */
function firstSrcSetUrl(srcset: string | null): string {
  return (srcset ?? "").split(",")[0]?.trim().split(/\s+/)[0] ?? "";
}

/** Картинка карточки: `<source type="image/avif">` из `/media/…`, файл отдаётся с immutable-кэшем. */
async function expectMediaCover(page: Page, card: Locator) {
  const source = card.locator('picture source[type="image/avif"]').first();
  await expect(source).toHaveAttribute("srcset", /^\/media\//);
  await expect(card.locator("picture img").first()).toHaveAttribute("src", /^\/media\//);

  const url = firstSrcSetUrl(await source.getAttribute("srcset"));
  const res = await page.request.get(url);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^image\/(avif|webp)/);
  expect(res.headers()["cache-control"]).toContain("immutable");
}

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function fillDates(page: Page, start: string, end: string) {
  await page.getByLabel("Начало", { exact: true }).fill(start);
  await page.getByLabel("Конец", { exact: true }).fill(end);
}

test.describe("Админка: турнир с афишей", () => {
  test("создание турнира с афишей → список, /tournaments, главная; «Дублировать»", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    const suffix = uniq();
    const title = `E2E Турнир ${suffix} 1 тур`;
    // Завтра–послезавтра: раньше сидовых предстоящих турниров. Остатки прошлых прогонов с теми же
    // датами удаляем (порядок при равных датах не определён); кэш сбросит сохранение ниже
    await sql()`delete from tournaments where title like 'E2E Турнир %'`;
    const start = todayPlus(1);
    const end = todayPlus(2);

    await page.goto("/admin/tournaments/new");
    await expect(page.getByRole("heading", { name: "Новый турнир" })).toBeVisible();

    await page.getByLabel("Название", { exact: true }).fill(title);
    await expect(page.getByLabel("Адрес (slug)")).toHaveValue(`e2e-turnir-${suffix}-1-tur`);
    await chooseOption(page, "Дисциплина", "Свободная пирамида");
    await fillDates(page, start, end);
    await page.getByLabel("Описание", { exact: true }).fill("Турнир, созданный e2e-тестом");

    await page.getByLabel("Афиша", { exact: true }).setInputFiles(POSTER);
    await expectToast(page, "Изображение загружено");
    await expect(page.getByText(/poster\.png · \d+×\d+/)).toBeVisible();
    await expect(page.locator('picture source[type="image/avif"]').first()).toHaveAttribute(
      "srcset",
      /^\/media\//
    );

    await page.getByRole("button", { name: "Создать турнир" }).click();
    await expectToast(page, "Сохранено");
    await page.waitForURL(/\/admin\/tournaments$/);
    const row = rowByText(page, title);
    await expect(row).toBeVisible();
    await expect(row).toContainText("Свободная пирамида");

    // Публичный календарь: updateTag в saveTournament сбрасывает кэш без перезапуска
    await page.goto("/tournaments");
    const card = page.locator("article").filter({ hasText: title });
    await expect(card).toBeVisible();
    await expectMediaCover(page, card);

    // Главная: «Календарный план» (#reasons) — до 5 ближайших. Попадает ли турнир в пятёрку,
    // зависит от данных других тестов — ожидание считаем тем же запросом, что и getUpcomingTournaments
    const [rank] = await sql()<{ ahead: number; ties: number }[]>`
      select
        count(*) filter (where (start_date, end_date) < (${start}::date, ${end}::date))::int as ahead,
        count(*) filter (where start_date = ${start}::date and end_date = ${end}::date
                         and title <> ${title})::int as ties
      from tournaments where is_published and end_date >= ${opDatePlus(0)}::date`;
    await page.goto("/");
    const plan = page.locator("#reasons");
    await plan.scrollIntoViewIfNeeded();
    await expect(plan.getByRole("heading", { name: "Календарный план" })).toBeVisible();
    expect(await plan.locator("article").count()).toBeLessThanOrEqual(5);
    const homeRow = plan.locator("article").filter({ hasText: title });
    if (rank!.ahead + rank!.ties < 5) {
      await expect(homeRow).toBeVisible();
      await expectMediaCover(page, homeRow);
    } else if (rank!.ahead >= 5) {
      test.info().annotations.push({ type: "home-top5", description: "турнир не в ближайших 5" });
      await expect(homeRow).toHaveCount(0);
    } else {
      // Равные даты с чужими турнирами на границе пятёрки — порядок не определён
      test.info().annotations.push({ type: "home-top5", description: "на границе пятёрки" });
    }

    // «Дублировать» → следующий тур, афиша сохраняется, публикация снята
    await page.goto(`/admin/tournaments?q=${encodeURIComponent(suffix)}`);
    await rowByText(page, title).getByRole("button", { name: "Действия" }).click();
    await page.getByRole("menuitem", { name: "Дублировать" }).click();
    await expect(page.getByRole("heading", { name: "Дублирование турнира" })).toBeVisible();
    await expect(page.getByText(`Копия турнира «${title}»`)).toBeVisible();
    const copyTitle = `E2E Турнир ${suffix} 2 тур`;
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue(copyTitle);
    await expect(page.getByText(/poster\.png · \d+×\d+/)).toBeVisible();
    await expect(page.getByRole("switch", { name: "Опубликован на сайте" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    await fillDates(page, todayPlus(15), todayPlus(15));
    await page.getByRole("button", { name: "Создать турнир" }).click();
    await expectToast(page, "Сохранено");
    await page.waitForURL(/\/admin\/tournaments$/);
    await expect(rowByText(page, copyTitle)).toBeVisible();

    const [copy] = await sql()<{ slug: string; cover_media_id: string | null }[]>`
      select slug, cover_media_id from tournaments where title = ${copyTitle}`;
    const [orig] = await sql()<{ cover_media_id: string | null }[]>`
      select cover_media_id from tournaments where title = ${title}`;
    expect(copy?.slug).toBe(`e2e-turnir-${suffix}-2-tur`);
    expect(copy?.cover_media_id).toBeTruthy();
    expect(copy?.cover_media_id).toBe(orig?.cover_media_id);

    expect(errors()).toEqual([]);
  });

  test("запрещённые файлы афиши отклоняются: SVG, текст с расширением .png, > 10 МБ", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page, EXPECTED_UPLOAD_ERRORS);
    await page.goto("/admin/tournaments/new");
    // Дожидаемся гидрации (slug следует за названием только на клиенте) — иначе change
    // у file input до гидрации теряется
    await page.getByLabel("Название", { exact: true }).fill("Гидрация");
    await expect(page.getByLabel("Адрес (slug)")).toHaveValue("gidratsiya");
    const input = page.getByLabel("Афиша", { exact: true });

    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>'
    );
    await input.setInputFiles({ name: "evil.svg", mimeType: "image/svg+xml", buffer: svg });
    await expectToast(page, "«evil.svg»: допустимы только JPEG, PNG, WebP и AVIF");

    // Браузер сообщает image/png по расширению — отсекает сервер по magic bytes
    await input.setInputFiles({
      name: "fake.png",
      mimeType: "image/png",
      buffer: Buffer.from("это не картинка, а текст"),
    });
    await expectToast(page, /^Допустимы только JPEG, PNG, WebP и AVIF$/);

    const big = Buffer.alloc(10 * 1024 * 1024 + 1024, 0);
    readFileSync(path.join(__dirname, "fixtures", "poster.png")).copy(big);
    await input.setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: big });
    await expectToast(page, "«huge.png»: файл больше 10 МБ");

    await expect(page.getByText("Изображение не выбрано")).toBeVisible();

    // Серверная защита в обход клиентской проверки (сессия админа из storageState)
    const svgRes = await page.request.post("/api/admin/media", {
      multipart: {
        folder: "tournaments",
        file: { name: "evil.svg", mimeType: "image/svg+xml", buffer: svg },
      },
    });
    expect(svgRes.status()).toBe(400);
    const bigRes = await page.request.post("/api/admin/media", {
      multipart: {
        folder: "tournaments",
        file: { name: "huge.png", mimeType: "image/png", buffer: big },
      },
    });
    expect([413, 400]).toContain(bigRes.status());

    expect(errors()).toEqual([]);
  });

  test("прошедший турнир не попадает в «ближайшие 5», идущий сегодня — попадает", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    const suffix = uniq();
    const pastTitle = `E2E Прошедший ${suffix}`;
    const ongoingTitle = `E2E Идёт сегодня ${suffix}`;

    // Данные — прямым SQL; кэш ('use cache' + тег tournaments) сбрасываем ниже обычным
    // сохранением турнира в админке (updateTag), иначе главная их не увидит
    // Остатки прошлых прогонов (идущие «сегодня» турниры) вытеснили бы новый из пятёрки
    await sql()`delete from tournaments where title like 'E2E Прошедший %' or title like 'E2E Идёт сегодня %'`;
    const [, ongoing] = await sql()<{ id: string }[]>`
      insert into tournaments (title, slug, level, start_date, end_date, is_published)
      values
        (${pastTitle}, ${`e2e-past-${suffix}`}, 'club', ${opDatePlus(-3)}, ${opDatePlus(-1)}, true),
        (${ongoingTitle}, ${`e2e-ongoing-${suffix}`}, 'club', ${opDatePlus(-1)}, ${opDatePlus(1)}, true)
      returning id`;
    expect(ongoing?.id).toBeTruthy();

    await page.goto(`/admin/tournaments/${ongoing!.id}`);
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue(ongoingTitle);
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expectToast(page, "Сохранено");
    await page.waitForURL(/\/admin\/tournaments$/);

    await page.goto("/");
    const plan = page.locator("#reasons");
    await plan.scrollIntoViewIfNeeded();
    await expect(plan.locator("article").filter({ hasText: ongoingTitle })).toBeVisible();
    await expect(plan.locator("article").filter({ hasText: pastTitle })).toHaveCount(0);
    expect(await plan.locator("article").count()).toBeLessThanOrEqual(5);

    expect(errors()).toEqual([]);
  });
});
