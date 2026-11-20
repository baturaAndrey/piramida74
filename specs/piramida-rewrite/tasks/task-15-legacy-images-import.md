# Task 15: Импорт фото со старого сайта

## Status

complete

## Wave

4

## Description

Скрипт `scripts/import-legacy-images.ts` (`pnpm import:images --source C:\OSPanel\home\74.loc`) переносит фотографии старого сайта в новую систему: прогоняет их через `saveImage` (sharp: варианты avif/webp, blur), складывает в `UPLOAD_DIR`, создаёт записи `media_assets`, заполняет пустые галереи, проставляет обложки акциям и афиши турниров, а также копирует нужные статичные файлы (логотип и т.п.) в `public/`. Скрипт идемпотентен: повторный запуск ничего не дублирует. Без него сайт после seed (задача 10) остаётся без картинок.

## Dependencies

**Depends on:** task-01-starter-cleanup-deps.md, task-09-media-core.md, task-10-seed-data.md
**Blocks:** task-28-qa-verification.md (визуальная сверка)

**Context from dependencies:**
- Task 01 установил `sharp`, `tsx` и другие пакеты и добавил в `package.json` скрипты `"seed": "tsx --env-file=.env scripts/seed.ts"` и `"import:images": "tsx --env-file=.env scripts/import-legacy-images.ts"` (`package.json` не править; запуск — `pnpm import:images [--source …] [--dry-run]`).
- Task 09 дал `saveImage(file: File | Buffer, opts: { folder: string; alt?: string; userId?: string; originalName?: string }): Promise<MediaAsset>` в `src/lib/media/storage.ts` (модуль можно запускать под `tsx`, он не импортирует `next/*`): проверка magic bytes, sharp, запись в `UPLOAD_DIR/<yyyy>/<mm>/`, вставка в `media_assets`. Папка `folder` — метка из `^[a-z0-9][a-z0-9-]{0,31}$`. Параметр `originalName` попадает в колонку `originalName` (для `Buffer` его нужно передавать всегда) и служит ключом идемпотентности. Вызов в этом скрипте — всегда `saveImage(buffer, { folder, alt, originalName })`.
- Task 03: `src/lib/db.ts` экспортирует `db` и `queryClient`; `galleries.key` — `text` unique (не enum); `galleryItems`: `galleryId`, `mediaId`, `caption?`, `variant` (`'default' | 'mobile'`, default `'default'`), `sortOrder`, уникальный индекс `(galleryId, mediaId, variant)`.
- Task 10 создал seed: ровно 8 пустых галерей с ключами `hero`, `service_russian`, `service_pool`, `service_vip`, `service_training`, `bar`, `about`, `cta` (скрипт новые галереи не создаёт — только заполняет эти); акции со `slug` `devichnik-po-ponedelnikam`, `utro-v-dvizhenii`, `absolut-po-muzhski`; серии турниров `marafon-promneftegaz`, `senyory-chelyabinska` и 30 турниров 2026 (поля `title`, `slug`, `seriesId`, `stageNumber`, `level` и др., обложки `null`). Скрипт запускают **после** `pnpm db:migrate` и `pnpm seed`.

## Files to Create

- `scripts/import-legacy-images.ts` — скрипт импорта
- `public/images/logo.png`, `public/images/logo.webp` — логотип (копируется скриптом или вручную)
- `public/images/work-steps-bg.webp` — тёмный фон слайдов блока «Бронирование» (копируется скриптом)
- `public/images/tournament-default.webp` — обложка турнира по умолчанию (генерируется скриптом из одной из афиш, см. ниже)

## Files to Modify

Нет.

## Technical Details

### Implementation Steps

1. Прочитать `src/lib/media/storage.ts`, `src/lib/schema/{media,club}.ts` (имена колонок `mediaAssets`, `galleries`, `galleryItems`, `promotions`, `tournaments`, `tournamentSeries`), `src/lib/db.ts`.

2. **Аргументы** (`node:util.parseArgs`): `--source <путь>` (по умолчанию `C:\OSPanel\home\74.loc`), `--dry-run` (только проверка файлов и печать плана, без записи в БД/на диск). Запуск: `pnpm import:images --source "C:\OSPanel\home\74.loc"`; нужны `POSTGRES_URL` и `UPLOAD_DIR` (подхватываются из `.env` флагом `--env-file` в скрипте `package.json`). Импорты в скриптах — относительные (`../src/lib/...`). В конце `await queryClient.end()` (из `../src/lib/db`).

3. **Проверка источника.** Перед любыми записями проверить существование каждого файла из плана (ниже); отсутствующие вывести списком и продолжить с остальными (не падать). Убедиться, что в БД есть галереи и акции из seed; если нужной галереи/акции нет — предупреждение и пропуск этого блока («сначала выполните `pnpm seed`»). Секреты старого сайта (`index.php`, `send/sendTg.php`, `74.zip`) не читать и не копировать.

4. **Выбор исходников.** Для всех фото брать **оригинальный `.jpg`** (качество выше, чем у уже пережатых `.webp`); для файла с прозрачностью (`forma-e1729499854343`) — `.png`; если `.jpg` нет — `.webp`. Пути ниже даны относительно `--source`; `A` = `public/themes/piramida/assets/img`.

   Галереи (порядок файлов = порядок в галерее; `folder: "galleries"`; `alt` — русский текст, номер кадра в конце):

   | Ключ галереи | Файлы | alt (шаблон) |
   |---|---|---|
   | `hero` | `uploads/2024/10/bg.jpg` | Бильярдный клуб «Пирамида» — игровой зал |
   | `service_russian` | `A/tables-halls/classic-hall/1.jpg … 5.jpg` | Русский бильярд в клубе «Пирамида», фото N |
   | `service_pool` | `A/tables-halls/american/1.jpg … 5.jpg` | Американский бильярд (пул) в клубе «Пирамида», фото N |
   | `service_vip` | `A/tables-halls/vip/1.jpg … 5.jpg` | VIP-комната клуба «Пирамида», фото N |
   | `service_training` | `A/tables-halls/training/1.jpg … 5.jpg` | Обучение бильярду в клубе «Пирамида», фото N |
   | `bar` | `A/bar/bar-1.jpg … bar-6.jpg` | Бар и кухня клуба «Пирамида», фото N |
   | `about` | `A/clients/lobbyo.jpg` | Холл бильярдного клуба «Пирамида» |
   | `cta` | `A/forma-01.jpg` (фон, `sortOrder` 0; если `.jpg` нет — `A/forma-01.webp`), затем `uploads/2024/10/forma-e1729499854343.png` (фото человека, с прозрачностью, `sortOrder` 1) | Фон блока бронирования / Администратор клуба «Пирамида» |

   Галерею `cta` читает блок «Хотите забронировать стол?» на главной (задача 21: `getGallery('cta')`, элемент 0 — фон, элемент 1 — фото человека; если галерея пуста — статичные `public/images/home/*`, которые копирует задача 21). Порядок элементов `cta` важен.

   Не существует мобильный hero `uploads/2024/10/bg-ss.webp` (битая ссылка старого сайта) — не импортировать, отметить в отчёте. Слайды «Бронирования в 3 шага» (`uploads/2024/10/forma-2.webp`, `forma.webp`, `forma-1.webp`) — декоративные мелкие файлы (≤ 43 КБ), в галереи не включаются.

   Обложки акций (`folder: "promotions"`, проставляются в `promotions.coverMediaId`, только если поле сейчас `null`):

   | slug акции | Файл | alt |
   |---|---|---|
   | `devichnik-po-ponedelnikam` | `uploads/2024/10/foto-1.jpg` | Девушки играют в бильярд |
   | `utro-v-dvizhenii` | `uploads/2024/10/foto.jpg` | Утро в движении — бильярд для пенсионеров |
   | `absolut-po-muzhski` | `uploads/2024/10/foto-3.jpg` | Absolut по-мужски — бутылка и закуска |

   Афиши турниров (`folder: "tournaments"`, проставляются в `tournaments.coverMediaId`, только если поле `null`). Источники: `A/calendar_plan/*` и `uploads/2025/09/*`. Файлы-дубликаты по содержимому нужно отсеять **на этапе плана**: вычислить `sha256` каждого кандидата и оставить для каждого хэша один канонический путь (приоритет: `A/calendar_plan/*` перед `uploads/2025/09/*`; `.jpg` перед `.webp`), иначе одинаковые афиши будут импортированы несколько раз (в `uploads/2025/09/calendar_plan_01/02/03/04/05/08/09/012` лежат копии файлов `calendar_plan/sen_*`, `deti_*`, `dev_*`, `mar_02`). Остальные уникальные файлы `uploads/2025/09/` (`calendar_plan_06`, `calendar_plan_07`, `calendar_plan_010`, `calendar_plan_011`, `turnir_001…006`) — резервный пул, который нужно посмотреть.

   Эвристика соответствия (по префиксу имени файла в `calendar_plan/`) — **отправная точка, её нужно проверить глазами**: откройте инструментом Read по одному-двум файлам каждого префикса (`sen_`, `mar_`, `mm_`, `dev_`, `deti_`, `teen_`, `60_`) и убедитесь, что афиша общая для серии, а не про конкретную дату/турнир; если на афише напечатана конкретная дата или название, не подходящие турниру, не назначайте её ему (оставьте `null`):

   | Турниры | Файлы (циклически по индексу) |
   |---|---|
   | серия `senyory-chelyabinska`, туры 1–8 | `sen_01…sen_06` по `(stageNumber - 1) % 6` |
   | серия `marafon-promneftegaz`, туры 1–12 | `mar_01, mar_02, mar_03, mar_04, mar_07, mar_08, mar_09, mar_10` по `(stageNumber - 1) % 8` |
   | «Мисс бильярд (свободная пирамида)» | `dev_01` |
   | «День Победы. Ветераны 60+ …» | `60_01` |
   | уровень `regional_youth` («Первенство области …», 2 турнира) | `teen_01`, `teen_02` либо `deti_01`, `deti_03` (после просмотра выбрать подходящие) |
   | уровень `regional_championship` («Чемпионат области …», 4 турнира) | `mm_01…mm_05` по порядку дат (после просмотра подтвердить, что `mm_*` — афиши чемпионатов; иначе оставить `null`) |
   | «Командные соревнования», «День города …» | подходящая афиша из резервного пула, если она общая; иначе `null` |

   Итоговое соответствие зафиксировать в комментарии/константе в начале скрипта (чтобы оно было ревьюируемым).

5. **Идемпотентность.** Каждый импортируемый файл получает `originalName = "legacy:" + <относительный путь от --source с прямыми слешами>` (например `legacy:public/themes/piramida/assets/img/bar/bar-1.jpg`). Перед `saveImage` ищется `mediaAssets.originalName`; найденный ассет переиспользуется. Элемент галереи добавляется, только если пары `(galleryId, mediaId)` ещё нет (`sortOrder` — позиция в списке); у акций/турниров `coverMediaId` не перезаписывается, если уже задан (правки админа важнее). Дубликаты по хэшу исключены на этапе плана (шаг 4), поэтому повторный запуск даёт тот же набор файлов.

6. **Импорт одного файла:**

```ts
async function importFile(rel: string, folder: string, alt: string) {
  const originalName = `legacy:${rel}`
  const existing = await db.query.mediaAssets.findFirst({ where: eq(mediaAssets.originalName, originalName) })
  if (existing) return { asset: existing, created: false }
  const buf = await fs.readFile(path.join(source, rel))
  const asset = await saveImage(buf, { folder, alt, originalName })
  return { asset, created: true }
}
```
   (если у Drizzle нет `db.query.mediaAssets`, использовать `select().from(mediaAssets).where(...)`). Ошибки одного файла (`MediaValidationError`, чтение) логируются и не прерывают весь импорт; по завершении — итоговая таблица: импортировано / переиспользовано / пропущено (с причиной) по блокам, число созданных вариантов и размер `UPLOAD_DIR` (по желанию), код возврата ненулевой, если были ошибки.

7. **Статичные файлы в `public/images/`** (папку создать; копировать только если целевого файла нет, содержимое одинаковое с тем, что копируют другие задачи):
   - `A/logo.png` → `public/images/logo.png`; `A/logo.webp` → `public/images/logo.webp` (логотип шапки, 125×106);
   - `A/content/work-steps-bd-dark.webp` → `public/images/work-steps-bg.webp`;
   - `public/images/tournament-default.webp` — обложка турнира без афиши (её используют секции турниров как запасную): сгенерировать через `sharp` из одной общей афиши без конкретной даты (после просмотра выбрать из `calendar_plan/mm_01.jpg` либо другой нейтральной; ширина 1280, `webp` quality 75). Если подходящей общей афиши нет — взять фото `bar-1.jpg` затемнённым (`modulate({ brightness: 0.5 })`).
   Этой задаче принадлежат только `public/images/logo.png`, `logo.webp`, `tournament-default.webp`, `work-steps-bg.webp`. Файл `public/images/popup-bg.webp` копирует задача 11, `public/images/home/*` (в т. ч. запасные фото CTA) — задача 21, favicons/manifest/`public/icons/*` — задача 02, `yandex_*.html` — задача 23; здесь не трогать.

8. **Запуск и проверка:** `docker compose up -d`, `pnpm db:migrate`, `pnpm seed`, затем `pnpm import:images --dry-run` и `pnpm import:images`; повторить запуск — убедиться, что новых строк в `media_assets` и `gallery_items` нет; проверить в БД: у каждой из 8 галерей нужное число элементов (hero 1, service_* по 5, bar 6, about 1, cta 2), у 3 акций есть `coverMediaId`, у части турниров есть обложки; открыть в браузере `/media/<path>-640.webp` любого импортированного ассета.

### Environment Variables

- `POSTGRES_URL` — БД с применёнными миграциями и seed
- `UPLOAD_DIR` — каталог загрузок (`./.data/uploads` в dev)

## Acceptance Criteria

- [ ] `pnpm import:images --source "C:\OSPanel\home\74.loc"` отрабатывает без падения, отсутствующие файлы перечисляет предупреждением; `--dry-run` ничего не пишет.
- [ ] Галереи заполнены в порядке из таблицы: `hero` (1), `service_russian`/`service_pool`/`service_vip`/`service_training` (по 5), `bar` (6), `about` (1), `cta` (2: фон, затем фото человека); у каждого ассета осмысленный русский `alt`.
- [ ] У акций `devichnik-po-ponedelnikam`, `utro-v-dvizhenii`, `absolut-po-muzhski` проставлены обложки; турниры получили афиши по таблице соответствия (после визуальной проверки), остальные остались с `coverMediaId = null`; уже заданные обложки не перезаписываются.
- [ ] Дубликаты афиш (по `sha256`) не импортируются повторно; в соответствии с `originalName = legacy:<путь>` повторный запуск не создаёт новых строк в `media_assets` и `gallery_items`.
- [ ] Для каждого импорта созданы варианты avif/webp в `UPLOAD_DIR/<yyyy>/<mm>/`, файлы отдаются маршрутом `/media/...`.
- [ ] В `public/images/` лежат `logo.png`, `logo.webp`, `work-steps-bg.webp`, `tournament-default.webp`; мобильный hero `bg-ss.webp` не импортируется (отсутствует в источнике), слайды-декор шага 1–3 не импортируются.
- [ ] В скрипте и выводе нет секретов старого сайта; итоговая сводка (создано/переиспользовано/пропущено) печатается.
- [ ] `pnpm lint` и `pnpm typecheck` проходят.

## Notes

- Контент афиш (`calendar_plan_*`) неизвестен без просмотра: соответствие афиша → турнир приблизительное, админ перезагружает афиши через админку; корректнее оставить `null`, чем привязать афишу с чужой датой.
- Исходные `.webp` старого сайта уже пережаты с потерями, поэтому используются `.jpg`-оригиналы (`bg.jpg` 106 КБ, `tables-halls/*/N.jpg`, `bar/bar-N.jpg`).
- Задачи секций (20–22) показывают для турнира без обложки статичный `/images/tournament-default.webp`.
