#!/usr/bin/env node
/**
 * Сборка служебных скриптов в автономные ESM-бандлы для Docker-образа (`pnpm build:scripts`):
 * в runner-стадии нет tsx, исходников и devDependencies, поэтому seed, seed-admin и импорт
 * фотографий собираются esbuild'ом в dist/scripts/*.mjs вместе с seed-данными и зависимостями.
 *
 * sharp — нативный модуль, его не бандлим: в образе он уже лежит в node_modules standalone-сборки.
 */
import { build } from "esbuild";

const ENTRY_POINTS = [
  "scripts/seed.ts",
  "scripts/seed-admin.ts",
  "scripts/import-legacy-images.ts",
];

await build({
  entryPoints: ENTRY_POINTS,
  outdir: "dist/scripts",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: ["sharp"],
  // CJS-зависимости внутри ESM-бандла вызывают require() для встроенных модулей Node
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});
