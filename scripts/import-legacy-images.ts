/**
 * Импорт фотографий старого сайта: `pnpm import:images [--source <путь>] [--dry-run]`.
 *
 * Запускать после `pnpm db:migrate` и `pnpm seed`. Каждое фото проходит через `saveImage`
 * (проверка magic bytes, sharp-варианты avif/webp, blur) и попадает в `media_assets`; затем
 * заполняются 8 галерей из seed, обложки акций и афиши турниров, а в `public/images/` копируются
 * статичные файлы (логотип, фон слайдов «Бронирования», обложка турнира по умолчанию).
 *
 * Идемпотентность: ключ ассета — `originalName = "legacy:<путь от --source>"`. Найденный ассет
 * переиспользуется; элемент галереи добавляется, только если пары (galleryId, mediaId) нет;
 * обложки ставятся, только если поле `coverMediaId` пустое (правки админа важнее).
 *
 * Секреты старого сайта (`index.php`, `send/sendTg.php`, `74.zip`) скрипт не читает: все пути
 * заданы явно ниже, обход каталогов ограничен двумя папками с афишами.
 */
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { and, asc, eq, isNull } from "drizzle-orm";
import sharp from "sharp";
import { db, queryClient } from "../src/lib/db";
import { deleteMedia, getUploadDir, saveImage } from "../src/lib/media/storage";
import { MediaValidationError } from "../src/lib/media/validate";
import {
  galleries,
  galleryItems,
  mediaAssets,
  promotions,
  tournamentSeries,
  tournaments,
  type MediaAsset,
} from "../src/lib/schema";

// ── Константы путей ─────────────────────────────────────────────────────────

const DEFAULT_SOURCE = "C:\\OSPanel\\home\\74.loc";
/** Каталог картинок темы старого сайта (относительно --source) */
const A = "public/themes/piramida/assets/img";
const UP_2024 = "uploads/2024/10";
const POSTER_DIRS = [`${A}/calendar_plan`, "uploads/2025/09"] as const;
const POSTER_EXTS = [".jpg", ".webp"] as const;
const LEGACY_PREFIX = "legacy:";

const PUBLIC_IMAGES_DIR = path.resolve("public/images");

/** Обложка турнира по умолчанию: ширина и пропорция карточки турнира (`aspect-[16/6]`) */
const DEFAULT_COVER_WIDTH = 1280;
const DEFAULT_COVER_HEIGHT = 480;
const DEFAULT_COVER_QUALITY = 75;
/** Запасной вариант, если афиши нет: затемнённое фото бара */
const DEFAULT_COVER_FALLBACK_BRIGHTNESS = 0.5;

// ── Галереи ────────────────────────────────────────────────────────────────

type GalleryPlan = { key: string; files: { rel: string; alt: string }[] };

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const hallFiles = (dir: string, altPrefix: string) =>
  range(5).map((n) => ({
    rel: `${A}/tables-halls/${dir}/${n}.jpg`,
    alt: `${altPrefix}, фото ${n}`,
  }));

/** Порядок файлов = порядок в галерее (sortOrder). */
const GALLERY_PLAN: GalleryPlan[] = [
  {
    key: "hero",
    files: [{ rel: `${UP_2024}/bg.jpg`, alt: "Бильярдный клуб «Пирамида» — игровой зал" }],
  },
  {
    key: "service_russian",
    files: hallFiles("classic-hall", "Русский бильярд в клубе «Пирамида»"),
  },
  {
    key: "service_pool",
    files: hallFiles("american", "Американский бильярд (пул) в клубе «Пирамида»"),
  },
  { key: "service_vip", files: hallFiles("vip", "VIP-комната клуба «Пирамида»") },
  { key: "service_training", files: hallFiles("training", "Обучение бильярду в клубе «Пирамида»") },
  {
    key: "bar",
    files: range(6).map((n) => ({
      rel: `${A}/bar/bar-${n}.jpg`,
      alt: `Бар и кухня клуба «Пирамида», фото ${n}`,
    })),
  },
  {
    key: "about",
    files: [{ rel: `${A}/clients/lobbyo.jpg`, alt: "Холл бильярдного клуба «Пирамида»" }],
  },
  {
    // Порядок важен: элемент 0 — фон блока, элемент 1 — фото человека (задача 21)
    key: "cta",
    files: [
      { rel: `${A}/forma-01.jpg`, alt: "Фон блока бронирования" },
      { rel: `${UP_2024}/forma-e1729499854343.png`, alt: "Администратор клуба «Пирамида»" },
    ],
  },
];

/** Если `.jpg` нет — берём уже пережатый `.webp` с тем же именем. */
const GALLERY_FALLBACKS: Record<string, string> = {
  [`${A}/forma-01.jpg`]: `${A}/forma-01.webp`,
};

// ── Обложки акций ──────────────────────────────────────────────────────────

const PROMOTION_COVERS: { slug: string; rel: string; alt: string }[] = [
  {
    slug: "devichnik-po-ponedelnikam",
    rel: `${UP_2024}/foto-1.jpg`,
    alt: "Девушки играют в бильярд",
  },
  {
    slug: "utro-v-dvizhenii",
    rel: `${UP_2024}/foto.jpg`,
    alt: "Утро в движении — бильярд для пенсионеров",
  },
  {
    slug: "absolut-po-muzhski",
    rel: `${UP_2024}/foto-3.jpg`,
    alt: "Absolut по-мужски — бутылка и закуска",
  },
];

// ── Афиши турниров ─────────────────────────────────────────────────────────

/**
 * Афиши (логическое имя → alt). Логическое имя — путь без расширения; конкретный файл выбирается
 * на этапе плана из группы дубликатов (см. `buildPosterIndex`).
 *
 * Все файлы просмотрены вручную (2026-11): `calendar_plan/*` и `calendar_plan_0xx` — фотографии
 * 780×300 без текста, дат и названий, поэтому годятся как общие обложки серии/вида турнира.
 * `turnir_00x` — вертикальные фото призёров конкретных прошлых турниров, `calendar_plan_06/07` —
 * исходники `mar_08`/`deti_03` в высоком разрешении; эти файлы турнирам не назначаются.
 */
const CP = `${A}/calendar_plan`;
const RESERVE = "uploads/2025/09";
const POSTERS: Record<string, string> = {
  [`${CP}/sen_01`]: "Игрок в белой рубашке прицеливается по шару",
  [`${CP}/sen_02`]: "Игрок выполняет удар, лёжа на борту стола",
  [`${CP}/sen_03`]: "Игрок в белой рубашке выполняет удар на русском бильярде",
  [`${CP}/sen_04`]: "Два игрока клуба «Пирамида» у бильярдного стола",
  [`${CP}/sen_05`]: "Игроки за столами в зале клуба «Пирамида»",
  [`${CP}/sen_06`]: "Игрок прицеливается в турнирном зале",
  [`${CP}/mar_01`]: "Девушка выполняет удар с упором на стол",
  // В calendar_plan есть только mar_02.webp; его .jpg-оригинал — uploads/2025/09/calendar_plan_08.jpg
  [`${CP}/mar_02`]: "Игрок в белой футболке прицеливается по шару",
  [`${CP}/mar_03`]: "Игрок с бородой прицеливается, крупный план",
  [`${CP}/mar_04`]: "Два игрока выполняют удары за соседними столами",
  [`${CP}/mar_07`]: "Девушка выполняет дальний удар на русском бильярде",
  [`${CP}/mar_08`]: "Кубок с медалью за первое место",
  [`${CP}/mar_09`]: "Игрок в оранжевой рубашке выполняет удар",
  [`${CP}/mar_10`]: "Девушка прицеливается по шарам",
  [`${CP}/dev_01`]: "Девушка прицеливается по шару",
  [`${CP}/60_01`]: "Игрок-ветеран выполняет удар на русском бильярде",
  [`${CP}/deti_03`]: "Юный игрок выполняет удар",
  [`${CP}/teen_01`]: "Юный игрок прицеливается по красному шару",
  [`${CP}/mm_01`]: "Игроки в зале клуба «Пирамида» во время турнира",
  [`${CP}/mm_02`]: "Игрок прицеливается в турнирном зале",
  [`${CP}/mm_03`]: "Призёры турнира с медалями и кубком",
  [`${CP}/mm_04`]: "Игрок прицеливается по пирамиде шаров",
  [`${RESERVE}/calendar_plan_010`]: "Игрок прицеливается битком, крупный план",
  [`${RESERVE}/calendar_plan_011`]: "Рука игрока и шары русского бильярда крупным планом",
};

/**
 * Соответствие афиша → турнир (после визуальной проверки):
 * - серия `senyory-chelyabinska`, туры 1–8: sen_01…sen_06 по `(stage - 1) % 6`;
 * - серия `marafon-promneftegaz`, туры 1–12: mar_01, 02, 03, 04, 07, 08, 09, 10 по `(stage - 1) % 8`;
 * - «Мисс бильярд (свободная пирамида)»: dev_01;
 * - «День Победы. Ветераны 60+ (московская пирамида)»: 60_01;
 * - уровень `regional_youth` (2 турнира, по дате): deti_03, teen_01 — юные игроки за столом;
 *   deti_01 (дети с дипломами) и teen_02 (взрослые призёры) — фото награждений, не выбраны;
 * - уровень `regional_championship` (4 турнира, по дате): mm_01…mm_04 (mm_05 не нужен);
 * - «Командные соревнования»: calendar_plan_011, «День города. Комбинированная пирамида»:
 *   calendar_plan_010 — нейтральные фото из резервного пула;
 * остальные турниры (таких сейчас нет) остаются с `coverMediaId = null`.
 */
const SENIORS_SERIES = "senyory-chelyabinska";
const MARATHON_SERIES = "marafon-promneftegaz";
const SENIORS_POSTERS = range(6).map((n) => `${CP}/sen_0${n}`);
const MARATHON_POSTERS = ["01", "02", "03", "04", "07", "08", "09", "10"].map(
  (n) => `${CP}/mar_${n}`
);
const POSTERS_BY_TITLE: Record<string, string> = {
  "Мисс бильярд (свободная пирамида)": `${CP}/dev_01`,
  "День Победы. Ветераны 60+ (московская пирамида)": `${CP}/60_01`,
  "Командные соревнования": `${RESERVE}/calendar_plan_011`,
  "День города. Комбинированная пирамида": `${RESERVE}/calendar_plan_010`,
};
const POSTERS_BY_LEVEL: Partial<Record<string, string[]>> = {
  regional_youth: [`${CP}/deti_03`, `${CP}/teen_01`],
  regional_championship: [`${CP}/mm_01`, `${CP}/mm_02`, `${CP}/mm_03`, `${CP}/mm_04`],
};

// ── Статичные файлы public/images ──────────────────────────────────────────

const STATIC_COPIES: { rel: string; target: string }[] = [
  { rel: `${A}/logo.png`, target: "logo.png" },
  { rel: `${A}/logo.webp`, target: "logo.webp" },
  { rel: `${A}/content/work-steps-bd-dark.webp`, target: "work-steps-bg.webp" },
];
const DEFAULT_COVER_TARGET = "tournament-default.webp";
/** Нейтральное фото кубка (2560×1707, без дат и текста) — исходник mar_08 в высоком разрешении */
const DEFAULT_COVER_SOURCE = `${RESERVE}/calendar_plan_06.jpg`;
const DEFAULT_COVER_FALLBACK = `${A}/bar/bar-1.jpg`;

// ── Состояние и отчёт ──────────────────────────────────────────────────────

type BlockStats = {
  created: number;
  reused: number;
  linked: number;
  /** Привязка уже была (элемент галереи есть или обложка задана) — ничего не меняли */
  alreadyLinked: number;
  skipped: string[];
  failed: string[];
};

const report = new Map<string, BlockStats>();
const missingFiles = new Set<string>();
let variantsCreated = 0;

function block(name: string): BlockStats {
  let s = report.get(name);
  if (!s) {
    s = { created: 0, reused: 0, linked: 0, alreadyLinked: 0, skipped: [], failed: [] };
    report.set(name, s);
  }
  return s;
}

function errorMessage(error: unknown): string {
  if (error instanceof MediaValidationError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

// ── Аргументы ──────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    source: { type: "string", default: DEFAULT_SOURCE },
    "dry-run": { type: "boolean", default: false },
  },
});
const source = path.resolve(args.source ?? DEFAULT_SOURCE);
const dryRun = args["dry-run"] ?? false;

const abs = (rel: string) => path.join(source, ...rel.split("/"));

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** Возвращает первый существующий путь из списка; иначе отмечает файл отсутствующим. */
async function pickExisting(candidates: string[]): Promise<string | null> {
  for (const rel of candidates) {
    if (await exists(abs(rel))) return rel;
  }
  missingFiles.add(candidates[0] ?? "");
  return null;
}

// ── Афиши: дедупликация по sha256 ──────────────────────────────────────────

/**
 * Строит индекс «логическое имя афиши → канонический файл».
 *
 * Группы дубликатов объединяют (union-find) файлы с одинаковым sha256 и пары `name.jpg`/`name.webp`
 * в одной папке (это одна афиша в двух форматах). Внутри группы канонический файл выбирается
 * по приоритету: `.jpg` перед `.webp` (оригинал качественнее пережатого), затем
 * `calendar_plan/*` перед `uploads/2025/09/*`. Так `mar_02` (в calendar_plan только .webp)
 * получает `.jpg`-оригинал `uploads/2025/09/calendar_plan_08.jpg`, а копии в uploads не
 * импортируются повторно.
 */
async function buildPosterIndex(): Promise<{ canonical: Map<string, string>; duplicates: number }> {
  const files: string[] = [];
  for (const dir of POSTER_DIRS) {
    if (!(await exists(abs(dir)))) {
      missingFiles.add(`${dir}/`);
      continue;
    }
    const entries = await readdir(abs(dir));
    for (const name of entries.sort()) {
      if (POSTER_EXTS.some((ext) => name.toLowerCase().endsWith(ext))) files.push(`${dir}/${name}`);
    }
  }

  const parent = new Map<string, string>(files.map((f) => [f, f]));
  const find = (f: string): string => {
    let root = f;
    while (parent.get(root) !== root) root = parent.get(root) ?? root;
    parent.set(f, root);
    return root;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));

  const byHash = new Map<string, string>();
  const byStem = new Map<string, string>();
  for (const rel of files) {
    const hash = createHash("sha256")
      .update(await readFile(abs(rel)))
      .digest("hex");
    const sameHash = byHash.get(hash);
    if (sameHash) union(rel, sameHash);
    else byHash.set(hash, rel);

    const stem = rel.replace(/\.[^.]+$/, "");
    const sameStem = byStem.get(stem);
    if (sameStem) union(rel, sameStem);
    else byStem.set(stem, rel);
  }

  const rank = (rel: string) =>
    (rel.endsWith(".jpg") ? 0 : 2) + (rel.startsWith(POSTER_DIRS[0]) ? 0 : 1);
  const groups = new Map<string, string[]>();
  for (const rel of files) {
    const root = find(rel);
    groups.set(root, [...(groups.get(root) ?? []), rel]);
  }

  const canonical = new Map<string, string>();
  for (const members of groups.values()) {
    const best = [...members].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0];
    if (!best) continue;
    for (const rel of members) canonical.set(rel.replace(/\.[^.]+$/, ""), best);
  }
  return { canonical, duplicates: files.length - groups.size };
}

// ── Импорт одного файла ────────────────────────────────────────────────────

type ImportResult = { asset: MediaAsset; created: boolean } | null;

/** Кэш на время запуска: один файл может понадобиться нескольким турнирам. */
const importCache = new Map<string, Promise<ImportResult>>();

function importFile(
  rel: string,
  folder: string,
  alt: string,
  blockName: string
): Promise<ImportResult> {
  const cached = importCache.get(rel);
  if (cached) return cached;
  const result = importFileUncached(rel, folder, alt, blockName);
  importCache.set(rel, result);
  return result;
}

async function importFileUncached(
  rel: string,
  folder: string,
  alt: string,
  blockName: string
): Promise<ImportResult> {
  const stats = block(blockName);
  const originalName = `${LEGACY_PREFIX}${rel}`;
  try {
    const [existing] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.originalName, originalName))
      .limit(1);
    if (existing) {
      stats.reused++;
      return { asset: existing, created: false };
    }

    const buf = await readFile(abs(rel));
    const saved = await saveImage(buf, { folder, alt, originalName });
    // saveImage оставляет от originalName только базовое имя без «:» (1.jpg повторяется в
    // нескольких папках), поэтому ключ идемпотентности записывается отдельным UPDATE.
    try {
      const [asset] = await db
        .update(mediaAssets)
        .set({ originalName })
        .where(eq(mediaAssets.id, saved.id))
        .returning();
      if (!asset) throw new Error("ассет исчез после сохранения");
      stats.created++;
      variantsCreated += asset.variants.length;
      return { asset, created: true };
    } catch (error) {
      // Без ключа повторный запуск создал бы дубликат — откатываем сохранённый ассет
      await deleteMedia(saved.id).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    stats.failed.push(`${rel} — ${errorMessage(error)}`);
    console.error(`  ✗ ${rel}: ${errorMessage(error)}`);
    return null;
  }
}

// ── Блоки импорта ──────────────────────────────────────────────────────────

async function importGalleries(): Promise<void> {
  const rows = await db.select().from(galleries);
  const byKey = new Map(rows.map((g) => [g.key, g]));

  for (const plan of GALLERY_PLAN) {
    const name = `gallery:${plan.key}`;
    const stats = block(name);
    const gallery = byKey.get(plan.key);
    if (!gallery) {
      stats.skipped.push(`галереи «${plan.key}» нет в БД — сначала выполните \`pnpm seed\``);
      continue;
    }

    for (const [index, file] of plan.files.entries()) {
      const fallback = GALLERY_FALLBACKS[file.rel];
      const rel = await pickExisting(fallback ? [file.rel, fallback] : [file.rel]);
      if (!rel) {
        stats.skipped.push(`${file.rel} — файла нет в источнике`);
        continue;
      }
      if (dryRun) {
        console.log(`  [plan] ${plan.key}[${index}] ← ${rel}`);
        continue;
      }
      const result = await importFile(rel, "galleries", file.alt, name);
      if (!result) continue;

      const [present] = await db
        .select({ id: galleryItems.id })
        .from(galleryItems)
        .where(
          and(eq(galleryItems.galleryId, gallery.id), eq(galleryItems.mediaId, result.asset.id))
        )
        .limit(1);
      if (present) {
        stats.alreadyLinked++;
        continue;
      }

      const inserted = await db
        .insert(galleryItems)
        .values({ galleryId: gallery.id, mediaId: result.asset.id, sortOrder: index })
        .onConflictDoNothing()
        .returning({ id: galleryItems.id });
      stats.linked += inserted.length;
    }
  }
}

async function importPromotionCovers(): Promise<void> {
  const name = "promotions";
  const stats = block(name);
  for (const cover of PROMOTION_COVERS) {
    const [promo] = await db
      .select({ id: promotions.id, coverMediaId: promotions.coverMediaId })
      .from(promotions)
      .where(eq(promotions.slug, cover.slug))
      .limit(1);
    if (!promo) {
      stats.skipped.push(`акции «${cover.slug}» нет в БД — сначала выполните \`pnpm seed\``);
      continue;
    }
    const rel = await pickExisting([cover.rel]);
    if (!rel) {
      stats.skipped.push(`${cover.rel} — файла нет в источнике`);
      continue;
    }
    if (dryRun) {
      console.log(`  [plan] акция ${cover.slug} ← ${rel}`);
      continue;
    }
    // Обложку, заданную админом, не трогаем — и файл не импортируем
    if (promo.coverMediaId) {
      stats.alreadyLinked++;
      continue;
    }
    const result = await importFile(rel, "promotions", cover.alt, name);
    if (!result) continue;
    const updated = await db
      .update(promotions)
      .set({ coverMediaId: result.asset.id })
      .where(and(eq(promotions.id, promo.id), isNull(promotions.coverMediaId)))
      .returning({ id: promotions.id });
    stats.linked += updated.length;
  }
}

/** Логическое имя афиши для турнира по таблице соответствия; null — оставить без обложки. */
function posterFor(
  t: { title: string; level: string; stageNumber: number | null; seriesSlug: string | null },
  levelIndex: number
): string | null {
  const stage = t.stageNumber ?? 0;
  if (t.seriesSlug === SENIORS_SERIES && stage >= 1) {
    return SENIORS_POSTERS[(stage - 1) % SENIORS_POSTERS.length] ?? null;
  }
  if (t.seriesSlug === MARATHON_SERIES && stage >= 1) {
    return MARATHON_POSTERS[(stage - 1) % MARATHON_POSTERS.length] ?? null;
  }
  const byTitle = POSTERS_BY_TITLE[t.title];
  if (byTitle) return byTitle;
  return POSTERS_BY_LEVEL[t.level]?.[levelIndex] ?? null;
}

async function importTournamentCovers(): Promise<void> {
  const name = "tournaments";
  const stats = block(name);
  const { canonical, duplicates } = await buildPosterIndex();
  console.log(
    `  афиш-кандидатов: ${canonical.size} имён, дубликатов (sha256 / jpg+webp) отсеяно: ${duplicates}`
  );

  const rows = await db
    .select({
      id: tournaments.id,
      title: tournaments.title,
      level: tournaments.level,
      stageNumber: tournaments.stageNumber,
      startDate: tournaments.startDate,
      coverMediaId: tournaments.coverMediaId,
      seriesSlug: tournamentSeries.slug,
    })
    .from(tournaments)
    .leftJoin(tournamentSeries, eq(tournaments.seriesId, tournamentSeries.id))
    .orderBy(asc(tournaments.startDate), asc(tournaments.title));
  if (rows.length === 0) {
    stats.skipped.push("турниров нет в БД — сначала выполните `pnpm seed`");
    return;
  }

  // Порядковый номер турнира внутри своего уровня (по дате) — для групп «по порядку дат»
  const levelCounters = new Map<string, number>();
  for (const t of rows) {
    const levelIndex = levelCounters.get(t.level) ?? 0;
    if (!t.seriesSlug) levelCounters.set(t.level, levelIndex + 1);

    const poster = posterFor(t, levelIndex);
    if (!poster) {
      stats.skipped.push(`${t.startDate} «${t.title}» — подходящей афиши нет, обложка не задана`);
      continue;
    }
    const rel = canonical.get(poster);
    if (!rel) {
      missingFiles.add(`${poster}.{jpg,webp}`);
      stats.skipped.push(`${t.startDate} «${t.title}» — файла афиши ${poster} нет в источнике`);
      continue;
    }
    if (dryRun) {
      console.log(`  [plan] ${t.startDate} «${t.title}» ← ${rel}`);
      continue;
    }
    if (t.coverMediaId) {
      stats.alreadyLinked++;
      continue;
    }
    const result = await importFile(rel, "tournaments", POSTERS[poster] ?? t.title, name);
    if (!result) continue;
    const updated = await db
      .update(tournaments)
      .set({ coverMediaId: result.asset.id })
      .where(and(eq(tournaments.id, t.id), isNull(tournaments.coverMediaId)))
      .returning({ id: tournaments.id });
    stats.linked += updated.length;
  }
}

async function copyStaticFiles(): Promise<void> {
  const name = "public/images";
  const stats = block(name);
  if (!dryRun) await mkdir(PUBLIC_IMAGES_DIR, { recursive: true });

  for (const file of STATIC_COPIES) {
    const target = path.join(PUBLIC_IMAGES_DIR, file.target);
    if (await exists(target)) {
      stats.reused++;
      continue;
    }
    const rel = await pickExisting([file.rel]);
    if (!rel) {
      stats.skipped.push(`${file.rel} — файла нет в источнике`);
      continue;
    }
    if (dryRun) {
      console.log(`  [plan] ${rel} → public/images/${file.target}`);
      continue;
    }
    try {
      await copyFile(abs(rel), target);
      stats.created++;
    } catch (error) {
      stats.failed.push(`${file.target} — ${errorMessage(error)}`);
    }
  }

  const coverTarget = path.join(PUBLIC_IMAGES_DIR, DEFAULT_COVER_TARGET);
  if (await exists(coverTarget)) {
    stats.reused++;
    return;
  }
  const rel = await pickExisting([DEFAULT_COVER_SOURCE]);
  const fallbackRel = rel ? null : await pickExisting([DEFAULT_COVER_FALLBACK]);
  const sourceRel = rel ?? fallbackRel;
  if (!sourceRel) {
    stats.skipped.push(`${DEFAULT_COVER_TARGET} — нет ни афиши, ни запасного фото`);
    return;
  }
  if (dryRun) {
    console.log(`  [plan] ${sourceRel} → public/images/${DEFAULT_COVER_TARGET} (sharp)`);
    return;
  }
  try {
    let pipeline = sharp(abs(sourceRel))
      .rotate()
      .resize(DEFAULT_COVER_WIDTH, DEFAULT_COVER_HEIGHT, { fit: "cover", position: "attention" });
    if (!rel) pipeline = pipeline.modulate({ brightness: DEFAULT_COVER_FALLBACK_BRIGHTNESS });
    await pipeline.webp({ quality: DEFAULT_COVER_QUALITY }).toFile(coverTarget);
    stats.created++;
  } catch (error) {
    stats.failed.push(`${DEFAULT_COVER_TARGET} — ${errorMessage(error)}`);
  }
}

// ── Отчёт ──────────────────────────────────────────────────────────────────

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? await dirSize(full) : (await stat(full)).size;
  }
  return total;
}

async function printReport(): Promise<boolean> {
  console.log("\nИтог:");
  console.table(
    Object.fromEntries(
      [...report].map(([name, s]) => [
        name,
        {
          создано: s.created,
          переиспользовано: s.reused,
          привязано: s.linked,
          "уже привязано": s.alreadyLinked,
          пропущено: s.skipped.length,
          ошибок: s.failed.length,
        },
      ])
    )
  );

  for (const [name, s] of report) {
    for (const reason of s.skipped) console.log(`  пропущено [${name}]: ${reason}`);
    for (const reason of s.failed) console.log(`  ОШИБКА [${name}]: ${reason}`);
  }
  if (missingFiles.size > 0) {
    console.warn(`\nОтсутствуют в источнике (${missingFiles.size}):`);
    for (const rel of missingFiles) console.warn(`  - ${rel}`);
  }
  console.log(
    "\nНе импортируются намеренно: мобильный hero uploads/2024/10/bg-ss.webp (битая ссылка " +
      "старого сайта), слайды-декор uploads/2024/10/forma.webp, forma-1.webp, forma-2.webp."
  );

  if (!dryRun) {
    const uploadBytes = await dirSize(getUploadDir());
    console.log(
      `Создано вариантов изображений: ${variantsCreated}; размер UPLOAD_DIR: ${(uploadBytes / 1024 / 1024).toFixed(1)} МБ`
    );
  }
  return [...report.values()].some((s) => s.failed.length > 0);
}

// ── main ───────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  if (!(await exists(source))) {
    console.error(`Каталог источника не найден: ${source}`);
    return 1;
  }
  console.log(`Источник: ${source}${dryRun ? " (dry-run: без записи в БД и на диск)" : ""}`);

  console.log("\n▶ Галереи");
  await importGalleries();
  console.log("▶ Обложки акций");
  await importPromotionCovers();
  console.log("▶ Афиши турниров");
  await importTournamentCovers();
  console.log("▶ Статичные файлы public/images");
  await copyStaticFiles();

  const hasErrors = await printReport();
  return hasErrors ? 1 : 0;
}

main()
  .then(async (code) => {
    await queryClient.end();
    process.exit(code);
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await queryClient.end().catch(() => undefined);
    process.exit(1);
  });
