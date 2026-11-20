/**
 * Изоморфная маска и нормализация российского телефона (без зависимостей от React).
 * Маска старого сайта: `+7(999)999-99-99`; валидный номер — 10 цифр после `+7`.
 */

/** Длина национального номера (без кода страны) */
export const PHONE_NATIONAL_LENGTH = 10;

/** Префикс маски, который подставляется при фокусе на пустом поле */
export const PHONE_MASK_PREFIX = "+7(";

/**
 * Оставляет только цифры национального номера (максимум 10). Одна ведущая «7» или «8» всегда считается
 * кодом страны и отбрасывается (российский номер начинается с 9/3/4/8xx…, поэтому правило однозначно;
 * «+7(» из самой маски тоже даёт ведущую «7»).
 */
export function nationalDigits(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d[0] === "7" || d[0] === "8") d = d.slice(1);
  return d.slice(0, PHONE_NATIONAL_LENGTH);
}

/**
 * Форматирует ввод по маске: "" → ""; "9" → "+7(9"; "9000685" → "+7(900)068-5";
 * полный → "+7(900)068-50-00". Разделители добавляются только перед следующей цифрой,
 * поэтому значение никогда не заканчивается на «)» или «-».
 */
export function formatPhone(input: string): string {
  return formatNational(nationalDigits(input));
}

/** Маска по уже выделенным национальным цифрам (без повторного отбрасывания ведущей «7»/«8») */
function formatNational(d: string): string {
  if (d.length === 0) return "";
  let out = PHONE_MASK_PREFIX + d.slice(0, 3);
  if (d.length > 3) out += `)${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

export function isPhoneComplete(input: string): boolean {
  return nationalDigits(input).length === PHONE_NATIONAL_LENGTH;
}

/**
 * Строгая проверка для сервера: ровно 10 национальных цифр и ничего лишнего
 * (`nationalDigits` молча обрезает хвост, поэтому «+7 900 068 50 00 99» отдельно отклоняется).
 */
export function isValidPhone(input: string): boolean {
  const all = input.replace(/\D/g, "");
  if (all.length === PHONE_NATIONAL_LENGTH + 1) return all[0] === "7" || all[0] === "8";
  // 10 цифр без кода страны: ведущая «7»/«8» тут была бы отброшена как код → номер неполный
  return all.length === PHONE_NATIONAL_LENGTH && isPhoneComplete(all);
}

/** Каноничный вид для БД и уведомлений: "+7 (900) 068-50-00"; неполный номер → null */
export function normalizePhone(input: string): string | null {
  if (!isValidPhone(input)) return null;
  const d = nationalDigits(input);
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

/**
 * При фокусе поле уже содержит «+7(», и вставка номера с кодом страны («+7 (900) 111-22-33»,
 * «89001112233») даёт «+7(+7 (900)…» — лишняя «7» сдвигала бы номер. Если после префикса маски
 * пришёл полный номер с кодом (11 цифр с 7/8), а прежнее значение было пустым или голым префиксом
 * маски, префикс отбрасывается. Только в этом случае: если цифры уже набраны (например, 9), вставка
 * ещё двух тоже даёт 11 цифр с 7/8 — отбрасывание префикса исказило бы введённый номер.
 */
function dropMaskPrefixBeforePastedNumber(previous: string, raw: string): string {
  const isPreviousBlank = previous === "" || previous === PHONE_MASK_PREFIX;
  if (!raw.startsWith(PHONE_MASK_PREFIX) || !isPreviousBlank) return raw;
  const rest = raw.slice(PHONE_MASK_PREFIX.length);
  const digits = rest.replace(/\D/g, "");
  const hasCountryCode = digits[0] === "7" || digits[0] === "8";
  return digits.length === PHONE_NATIONAL_LENGTH + 1 && hasCountryCode ? rest : raw;
}

/**
 * Применяет новое «сырое» значение поля к предыдущему отформатированному.
 * Если пользователь удалял символ (сырое значение короче прежнего), а отформатированное не стало короче
 * (удалён разделитель «)» или «-», который маска тут же вернула бы), удаляется последняя цифра —
 * иначе стереть номер через разделитель невозможно.
 */
export function applyPhoneInput(previous: string, raw: string): string {
  const next = formatPhone(dropMaskPrefixBeforePastedNumber(previous, raw));
  const isDeletion = raw.length < previous.length;
  if (isDeletion && next.length >= previous.length) {
    return formatNational(nationalDigits(next).slice(0, -1));
  }
  return next;
}
