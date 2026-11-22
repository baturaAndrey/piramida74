import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { trackConsoleErrors } from "./helpers/console";

/**
 * Визуальная сверка со старым сайтом (task-28, п. 3): скриншоты секций главной на 4 ширинах
 * в e2e/screenshots/{legacy,new}/<width>/<section>.png и сводная таблица index.html.
 * Пиксельного сравнения нет — материал для просмотра человеком.
 *
 * Старый сайт (http://74.loc, OSPanel) снимается, только если он отвечает страницей с
 * `id="discount"`; иначе его колонка в index.html — заглушка «legacy unavailable».
 */

const NEW_URL = "/";
const LEGACY_URL = process.env.E2E_LEGACY_URL ?? "http://74.loc/";
const LEGACY_PROBE_TIMEOUT_MS = 5_000;
const IMAGE_WAIT_MS = 5_000;

const OUT_DIR = path.join("e2e", "screenshots");

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
] as const;

/** Секции с якорями — одинаковые id на старом и новом сайте */
const ANCHOR_SECTIONS = [
  "discount",
  "service",
  "reasons",
  "portfolio",
  "price",
  "clientsc",
  "worksteps",
  "getconsultation",
  "contacts",
] as const;

/** Порядок строк в index.html */
const SECTIONS = ["header", "hero", ...ANCHOR_SECTIONS, "footer", "full"] as const;
type Section = (typeof SECTIONS)[number];
type Site = "legacy" | "new";

/** Анимации и переходы выключены, Reveal-блоки (новый) и wow/animated (старый) показаны. */
const FREEZE_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }
  [data-reveal] { opacity: 1 !important; transform: none !important; }
  .wow, .animated { visibility: visible !important; opacity: 1 !important; transform: none !important; }
`;

/** Лог результатов прогона для index.html (заполняется тестами) */
const notes: string[] = [];
let legacyAvailable = false;

function shotPath(site: Site, width: number, section: Section): string {
  return path.join(OUT_DIR, site, String(width), `${section}.png`);
}

/** Прокрутка до низа и обратно: срабатывают lazy-картинки и IntersectionObserver. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForLoadState("networkidle");
  // Дожидаемся загрузки картинок; lazy-картинки вне окна (скрытые слайды) могут не грузиться
  // никогда — ожидание ограничено по времени
  await page.evaluate(
    (timeoutMs) =>
      Promise.race([
        Promise.all(
          Array.from(document.images, (img) =>
            img.complete ? null : img.decode().catch(() => undefined)
          )
        ),
        new Promise((r) => setTimeout(r, timeoutMs)),
      ]),
    IMAGE_WAIT_MS
  );
}

/** Абсолютный (от начала документа) прямоугольник элемента; страница должна быть в начале. */
async function pageBox(locator: Locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + window.scrollX,
      y: r.top + window.scrollY,
      width: r.width,
      height: r.height,
    };
  });
}

/**
 * Снимок области документа. fullPage-режим (captureBeyondViewport) не прокручивает страницу,
 * поэтому закреплённая шапка не наезжает на секции.
 */
async function shootClip(
  page: Page,
  file: string,
  box: { x: number; y: number; width: number; height: number }
) {
  const viewportWidth = page.viewportSize()?.width ?? box.width;
  const clip = {
    x: 0,
    y: Math.max(0, Math.floor(box.y)),
    // Во всю ширину окна: видно и поля, и горизонтальное переполнение секции
    width: viewportWidth,
    height: Math.max(1, Math.ceil(box.height)),
  };
  await page.screenshot({ path: file, fullPage: true, clip });
}

async function openSite(browser: Browser, viewport: (typeof VIEWPORTS)[number]) {
  const context = await browser.newContext({
    viewport,
    // Reveal не прячет блоки при reduced motion — плюс CSS ниже на всякий случай
    reducedMotion: "reduce",
    locale: "ru-RU",
    timezoneId: "Asia/Yekaterinburg",
  });
  const page = await context.newPage();
  return { context, page };
}

/** Снимки одного сайта на одной ширине. Возвращает список проблем, замеченных автоматически. */
async function captureSite(page: Page, site: Site, width: number): Promise<string[]> {
  const issues: string[] = [];
  mkdirSync(path.join(OUT_DIR, site, String(width)), { recursive: true });
  await page.addStyleTag({ content: FREEZE_CSS });

  if (site === "new") {
    // Плашка cookie есть только на новом сайте
    const banner = page.getByRole("dialog", { name: "Cookie" });
    await banner.getByRole("button", { name: "Принять" }).click();
    await expect(banner).toBeHidden();
  }

  await scrollThrough(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  if (overflow > 0) issues.push(`${site} ${width}: горизонтальный скролл ${overflow}px`);

  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => img.complete && img.naturalWidth === 0 && img.currentSrc)
      .map((img) => img.currentSrc)
  );
  for (const src of broken) issues.push(`${site} ${width}: не загрузилась картинка ${src}`);

  // Секции по якорям (+ контроль порядка)
  let prevY = -1;
  for (const id of ANCHOR_SECTIONS) {
    const section = page.locator(`#${id}`).first();
    if ((await section.count()) === 0) {
      issues.push(`${site} ${width}: нет секции #${id}`);
      continue;
    }
    const box = await pageBox(section);
    if (box.height < 1) {
      issues.push(`${site} ${width}: секция #${id} нулевой высоты`);
      continue;
    }
    if (box.y < prevY) issues.push(`${site} ${width}: секция #${id} выше предыдущей`);
    prevY = box.y;
    await shootClip(page, shotPath(site, width, id), box);
  }

  // Hero, шапка (от верха до hero) и футер
  const hero =
    site === "new"
      ? page.locator("main > section").first()
      : page.locator(".hero, .main-screen, .first-screen, section").first();
  const heroBox = (await hero.count()) > 0 ? await pageBox(hero) : null;
  if (heroBox) {
    await shootClip(page, shotPath(site, width, "hero"), heroBox);
    await shootClip(page, shotPath(site, width, "header"), {
      x: 0,
      y: 0,
      width,
      height: Math.max(1, heroBox.y),
    });
  } else {
    issues.push(`${site} ${width}: не найден первый экран`);
  }

  const footer = page.locator("footer, .footer").last();
  if ((await footer.count()) > 0) {
    await shootClip(page, shotPath(site, width, "footer"), await pageBox(footer));
  } else {
    issues.push(`${site} ${width}: нет футера`);
  }

  await page.screenshot({ path: shotPath(site, width, "full"), fullPage: true });
  return issues;
}

/** Старый сайт доступен и отдаёт именно главную (а не ошибку БД/OSPanel). */
async function probeLegacy(): Promise<boolean> {
  try {
    const response = await fetch(LEGACY_URL, {
      signal: AbortSignal.timeout(LEGACY_PROBE_TIMEOUT_MS),
    });
    return response.ok && (await response.text()).includes('id="discount"');
  } catch {
    return false;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function cell(site: Site, width: number, section: Section): string {
  const file = shotPath(site, width, section);
  if (!existsSync(file)) {
    const reason = site === "legacy" && !legacyAvailable ? "legacy unavailable" : "нет снимка";
    return `<div class="missing">${site}: ${reason}</div>`;
  }
  const rel = `${site}/${width}/${section}.png`;
  return `<a href="${rel}" target="_blank"><img src="${rel}" alt="${site} ${section} ${width}" loading="lazy"></a>`;
}

/** Статическая таблица «секция × ширина», в ячейке — старый | новый. */
function writeIndex() {
  const head = VIEWPORTS.map((v) => `<th>${v.width}px</th>`).join("");
  const rows = SECTIONS.map((section) => {
    const cells = VIEWPORTS.map(
      (v) =>
        `<td><div class="pair"><figure><figcaption>старый</figcaption>${cell("legacy", v.width, section)}</figure><figure><figcaption>новый</figcaption>${cell("new", v.width, section)}</figure></div></td>`
    ).join("");
    return `<tr><th scope="row">${section}</th>${cells}</tr>`;
  }).join("\n");
  const notesHtml = notes.length
    ? `<ul>${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
    : "<p>Автоматических замечаний нет.</p>";

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Визуальная сверка: старый | новый сайт</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 16px; color: #111; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 6px; vertical-align: top; }
  thead th { position: sticky; top: 0; background: #f5f5f5; }
  .pair { display: flex; gap: 6px; }
  figure { margin: 0; width: 220px; }
  figcaption { font-size: 12px; color: #666; }
  img { width: 100%; height: auto; border: 1px solid #eee; }
  .missing { padding: 24px 8px; background: #fafafa; color: #999; text-align: center; font-size: 12px; }
</style>
</head>
<body>
<h1>Визуальная сверка главной</h1>
<p>Сгенерировано: ${escapeHtml(new Date().toISOString())}. Старый сайт: ${escapeHtml(LEGACY_URL)} —
${legacyAvailable ? "снят" : '<b>legacy unavailable</b> (не отвечает или нет <code>id="discount"</code>)'}.
Клик по картинке открывает её в полном размере.</p>
<h2>Автоматические замечания</h2>
${notesHtml}
<table>
<thead><tr><th>Секция</th>${head}</tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`;
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, "index.html"), html, "utf8");
}

test.describe.configure({ mode: "serial" });

test.describe("Визуальная сверка главной", () => {
  test.beforeAll(async () => {
    legacyAvailable = await probeLegacy();
    if (!legacyAvailable)
      notes.push(`Старый сайт ${LEGACY_URL} недоступен — снимки legacy пропущены`);
  });

  test.afterAll(() => {
    writeIndex();
  });

  for (const viewport of VIEWPORTS) {
    test(`новый сайт, ${viewport.width}px`, async ({ browser, baseURL }) => {
      test.setTimeout(180_000);
      const { context, page } = await openSite(browser, viewport);
      try {
        const errors = trackConsoleErrors(page);
        const response = await page.goto(new URL(NEW_URL, baseURL).toString());
        expect(response?.status()).toBe(200);
        await expect(page.locator("#contacts")).toBeAttached();
        const issues = await captureSite(page, "new", viewport.width);
        notes.push(...issues);
        expect(errors()).toEqual([]);
        // Явные дефекты нового сайта — падение теста (снимки уже сохранены)
        expect(issues).toEqual([]);
      } finally {
        await context.close();
      }
    });

    test(`старый сайт, ${viewport.width}px`, async ({ browser }) => {
      test.skip(!legacyAvailable, `legacy unavailable: ${LEGACY_URL} не отдаёт главную`);
      test.setTimeout(180_000);
      const { context, page } = await openSite(browser, viewport);
      try {
        await page.goto(LEGACY_URL);
        // Старый сайт — только материал для сравнения: его дефекты фиксируем, но не валим тест
        notes.push(...(await captureSite(page, "legacy", viewport.width)));
      } finally {
        await context.close();
      }
    });
  }
});
