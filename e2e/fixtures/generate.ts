/**
 * Генерирует маленькие тестовые изображения для e2e (результат коммитится):
 *   pnpm tsx e2e/fixtures/generate.ts
 */
import path from "node:path";
import sharp from "sharp";

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

async function main() {
  // Афиша турнира: 600×800, png
  await sharp({ create: { width: 600, height: 800, channels: 3, background: { r: 30, g: 90, b: 60 } } })
    .png()
    .toFile(path.join(dir, "poster.png"));
  // Обложка статьи: 1200×630, jpeg
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: { r: 120, g: 40, b: 40 } } })
    .jpeg({ quality: 80 })
    .toFile(path.join(dir, "cover.jpg"));
  console.warn("fixtures generated in", dir);
}

void main();
