import type { NotifyChannelStatus } from "@/lib/schema";

/**
 * Результат отправки по одному каналу (`Promise.allSettled`) → запись для `leads.notifyStatus`.
 * Вынесено из `src/lib/actions/leads.ts`: 'use server'-файл может экспортировать только async-функции.
 */
export function channelStatus(
  result: PromiseSettledResult<{ ok: boolean; error?: string }>
): NotifyChannelStatus {
  const at = new Date().toISOString();
  if (result.status === "rejected") {
    const error = result.reason instanceof Error ? result.reason.message : "unknown error";
    return { ok: false, error, at };
  }
  const { ok, error } = result.value;
  return error === undefined ? { ok, at } : { ok, error, at };
}
