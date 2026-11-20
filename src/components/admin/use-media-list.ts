"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMediaPage } from "@/lib/admin/media-client";
import {
  MEDIA_PAGE_SIZE_DEFAULT,
  type MediaDto,
  type MediaListResponse,
} from "@/lib/admin/media-dto";

const SEARCH_DEBOUNCE_MS = 300;

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type ListState = {
  /** Ключ запроса (q + folder), которому соответствуют items */
  key: string;
  items: MediaDto[];
  total: number;
  page: number;
  error: string | null;
};

type UseMediaListOptions = {
  /** Пока false — запросы не выполняются (например, закрытый диалог) */
  enabled?: boolean;
  /** Первая страница, отрисованная сервером для пустого запроса (q = "", folder = "") */
  initial?: MediaListResponse;
  pageSize?: number;
};

const keyOf = (q: string, folder: string) => JSON.stringify([q, folder]);

function mergeUnique(existing: MediaDto[], incoming: MediaDto[]): MediaDto[] {
  const seen = new Set(existing.map((item) => item.id));
  return [...existing, ...incoming.filter((item) => !seen.has(item.id))];
}

/**
 * Постраничный список медиатеки из `GET /api/admin/media`:
 * поиск с debounce 300 мс, фильтр папки, «Загрузить ещё», локальные правки после загрузки/удаления.
 */
export function useMediaList({
  enabled = true,
  initial,
  pageSize = MEDIA_PAGE_SIZE_DEFAULT,
}: UseMediaListOptions = {}) {
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const requestKey = keyOf(debouncedQuery, folder);

  const [state, setState] = useState<ListState | null>(() =>
    initial
      ? {
          key: keyOf("", ""),
          items: initial.items,
          total: initial.total,
          page: initial.page,
          error: null,
        }
      : null
  );
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    // Данные для этого запроса уже есть (серверная первая страница или повторное открытие)
    if (state?.key === requestKey) return;
    const controller = new AbortController();
    fetchMediaPage({ q: debouncedQuery, folder, page: 1, pageSize }, controller.signal)
      .then((res) =>
        setState({
          key: requestKey,
          items: res.items,
          total: res.total,
          page: res.page,
          error: null,
        })
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          key: requestKey,
          items: [],
          total: 0,
          page: 1,
          error: error instanceof Error ? error.message : "Не удалось загрузить медиатеку",
        });
      });
    return () => controller.abort();
    // state намеренно не в зависимостях: эффект реагирует только на смену запроса
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, requestKey, debouncedQuery, folder, pageSize]);

  const isCurrent = state?.key === requestKey;
  const items = isCurrent ? state.items : [];
  const total = isCurrent ? state.total : 0;
  const loading = enabled && !isCurrent;

  const loadMore = useCallback(async () => {
    if (!state || state.key !== requestKey) return;
    setLoadingMore(true);
    try {
      const res = await fetchMediaPage({
        q: debouncedQuery,
        folder,
        page: state.page + 1,
        pageSize,
      });
      setState((prev) =>
        prev && prev.key === requestKey
          ? { ...prev, items: mergeUnique(prev.items, res.items), total: res.total, page: res.page }
          : prev
      );
    } catch (error) {
      setState((prev) =>
        prev
          ? { ...prev, error: error instanceof Error ? error.message : "Не удалось загрузить" }
          : prev
      );
    } finally {
      setLoadingMore(false);
    }
  }, [state, requestKey, debouncedQuery, folder, pageSize]);

  /** Новый ассет — в начало списка (если подходит под фильтр папки) */
  const prepend = useCallback(
    (asset: MediaDto) => {
      setState((prev) => {
        if (!prev || prev.key !== requestKey) return prev;
        if (folder && asset.folder !== folder) return prev;
        if (prev.items.some((item) => item.id === asset.id)) return prev;
        return { ...prev, items: [asset, ...prev.items], total: prev.total + 1 };
      });
    },
    [requestKey, folder]
  );

  const replace = useCallback((asset: MediaDto) => {
    setState((prev) =>
      prev
        ? { ...prev, items: prev.items.map((item) => (item.id === asset.id ? asset : item)) }
        : prev
    );
  }, []);

  const remove = useCallback((id: string) => {
    setState((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.filter((item) => item.id !== id),
            total: Math.max(0, prev.total - 1),
          }
        : prev
    );
  }, []);

  return {
    query,
    setQuery,
    folder,
    setFolder,
    items,
    total,
    loading,
    loadingMore,
    hasMore: items.length < total,
    error: isCurrent ? state.error : null,
    loadMore,
    prepend,
    replace,
    remove,
  };
}
