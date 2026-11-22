import { config } from "zod/v4/core";

// Выполняется в браузере до гидратации. Zod 4 при первой валидации проверяет поддержку
// JIT через `Function("")`; CSP без 'unsafe-eval' блокирует это и Chrome пишет в консоль
// нарушение CSP («Refused to evaluate…»). jitless отключает проверку (и eval) целиком.
// Только `config` из ядра (общий `globalThis.__zod_globalConfig`, тот же, что у `z.config`):
// импорт всего `zod` отсюда добавлял ~108 КБ в начальный бандл каждой страницы.
config({ jitless: true });
