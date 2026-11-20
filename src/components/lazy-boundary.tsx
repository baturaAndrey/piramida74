"use client";

import { Component } from "react";

type LazyBoundaryProps = {
  children: React.ReactNode;
  /** Что показать вместо упавшего чанка; по умолчанию — ничего */
  fallback?: React.ReactNode;
  /** Сообщить об ошибке (закрыть попап, показать тост) */
  onError?: (error: unknown) => void;
  /**
   * Смена значения сбрасывает ошибку и рендерит `children` заново — например, при повторном
   * открытии попапа. `React.lazy` запоминает отклонённый промис, поэтому повторная попытка
   * снова вызовет `onError` (повторное уведомление), а не загрузит чанк.
   */
  resetKey?: unknown;
};

type LazyBoundaryState = { failed: boolean; resetKey: unknown };

/**
 * Граница ошибок для `React.lazy`-чанков (попап заявки, лайтбокс). Без неё сбой загрузки чанка
 * (обрыв сети, новый деплой с другими хэшами) всплывает до error.tsx и заменяет всю страницу,
 * хотя упал только необязательный попап.
 */
export class LazyBoundary extends Component<LazyBoundaryProps, LazyBoundaryState> {
  override state: LazyBoundaryState = { failed: false, resetKey: this.props.resetKey };

  // Ключ запоминается в state, а не сравнивается в componentDidUpdate: ошибка из того же
  // рендера, где сменился ключ, иначе сразу бы сбросилась и `onError` сработал бы дважды
  static getDerivedStateFromProps(
    props: LazyBoundaryProps,
    state: LazyBoundaryState
  ): Partial<LazyBoundaryState> | null {
    if (Object.is(props.resetKey, state.resetKey)) return null;
    return { failed: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(): Partial<LazyBoundaryState> {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  override render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
