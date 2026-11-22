import { useSyncExternalStore } from "react";

/** Ключ в localStorage и имя cookie */
export const CONSENT_KEY = "cookie_consent";
/** `all` — все cookie, включая Метрику; `necessary` — только необходимые */
export type Consent = "all" | "necessary";

/** Событие в рамках вкладки (событие `storage` приходит только из других вкладок) */
const CHANGE_EVENT = "cookie-consent-change";
/** Один год */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function isConsent(value: unknown): value is Consent {
  return value === "all" || value === "necessary";
}

function readCookie(): string | null {
  for (const part of document.cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CONSENT_KEY) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Сохранённое решение: localStorage, при недоступности/пустоте — cookie. На сервере — `null`. */
export function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (isConsent(stored)) return stored;
  } catch {
    // localStorage недоступен (приватный режим, запрет cookie) — читаем cookie
  }
  const fromCookie = readCookie();
  return isConsent(fromCookie) ? fromCookie : null;
}

/** Сохраняет решение на год в localStorage и cookie и оповещает подписчиков вкладки. */
export function writeConsent(value: Consent): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Остаётся cookie
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_KEY}=${value}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CONSENT_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** На сервере и при гидрации решение неизвестно */
const getServerSnapshot = (): undefined => undefined;

/**
 * Текущее решение о cookie: `undefined` — на сервере и до гидрации (ничего не рендерить),
 * `null` — решения нет, иначе `Consent`.
 */
export function useCookieConsent(): Consent | null | undefined {
  return useSyncExternalStore<Consent | null | undefined>(
    subscribe,
    readConsent,
    getServerSnapshot
  );
}
