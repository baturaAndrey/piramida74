// Удаление заявок: схема ввода и тексты (чистый модуль — общий для Server Action, клиента и тестов)
import { z } from "zod";
import { plural } from "../../menu/_lib/labels";

/**
 * Выбор живёт в пределах страницы списка (LEADS_PAGE_SIZE = 50 в ./filters — тот модуль
 * серверный, сюда не импортируется); запас ×2, но без «удалить всё» одним запросом.
 */
export const MAX_DELETE_LEADS = 100;

export const deleteLeadsSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1, "Не выбрано ни одной заявки")
    .max(MAX_DELETE_LEADS, `За раз можно удалить не больше ${MAX_DELETE_LEADS} заявок`)
    // Повторы не ошибка, но в запрос и аудит идут один раз
    .transform((ids) => [...new Set(ids)]),
});

/** «1 заявку», «3 заявки», «5 заявок» (винительный падеж) */
export function leadsCountLabel(count: number): string {
  return `${count} ${plural(count, ["заявку", "заявки", "заявок"])}`;
}

/** Заголовок диалога подтверждения */
export function deleteLeadsTitle(count: number): string {
  return `Удалить ${leadsCountLabel(count)}?`;
}

/** Текст toast после удаления */
export function deletedLeadsMessage(count: number): string {
  return `${plural(count, ["Удалена", "Удалены", "Удалено"])} ${count} ${plural(count, ["заявка", "заявки", "заявок"])}`;
}
