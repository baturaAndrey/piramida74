#!/usr/bin/env node
/**
 * Запуск production standalone-сервера локально так же, как в Dockerfile:
 * `.next/static` и `public` копируются рядом с `.next/standalone/server.js`.
 * (`next start` с `output: "standalone"` не поддерживается и отдаёт статику некорректно.)
 *
 *   node scripts/e2e-start.mjs [port]
 *
 * server.js делает chdir в свой каталог, поэтому относительный UPLOAD_DIR
 * переводится в абсолютный относительно корня репозитория.
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const server = path.join(standalone, "server.js");
if (!existsSync(server)) {
  console.error("[e2e-start] Нет .next/standalone/server.js — сначала `pnpm build:ci`.");
  process.exit(1);
}

for (const [from, to] of [
  [path.join(root, ".next", "static"), path.join(standalone, ".next", "static")],
  [path.join(root, "public"), path.join(standalone, "public")],
]) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

const port = process.argv[2] ?? process.env.PORT ?? "3000";
const env = {
  ...process.env,
  NODE_ENV: "production",
  PORT: port,
  UPLOAD_DIR: path.resolve(root, process.env.UPLOAD_DIR ?? "./.data/uploads"),
};

const child = spawn(process.execPath, [server], { stdio: "inherit", env });
const stop = () => child.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
