/**
 * Белый список видеоисточников для шорткода `{{Видео: url}}` и построение
 * embed-URL. Хост сравнивается **точно** (`vk.com.evil.com` не проходит),
 * допускается только `https:`. Изоморфный модуль.
 */

export type VideoProvider = "vk" | "rutube";

export type VideoSource =
  | { kind: "iframe"; src: string; provider: VideoProvider }
  /** Собственный файл `/media/…` (`.mp4`/`.webm`) */
  | { kind: "file"; src: string }
  | null;

const VK_HOSTS = new Set([
  "vk.ru",
  "vk.com",
  "vkvideo.ru",
  "www.vk.ru",
  "www.vk.com",
  "www.vkvideo.ru",
  "m.vk.com",
  "m.vk.ru",
]);
const RUTUBE_HOSTS = new Set(["rutube.ru", "www.rutube.ru"]);

/** Собственные видеофайлы: только эти расширения отдаются в `<video>` */
const VIDEO_FILE = /^\/media\/[^?#]+\.(mp4|webm)$/i;

/** `/video-12345_67890` в пути страницы VK Видео */
const VK_PATH = /\/video(-?\d+)_(\d+)/;
/** `/video/<id>/`, `/play/embed/<id>`, `/shorts/<id>/` у Rutube */
const RUTUBE_PATH = /^\/(?:video|play\/embed|shorts)\/([a-f0-9]{16,64})\/?$/i;

function resolveVkSource(url: URL): VideoSource {
  const m = VK_PATH.exec(url.pathname);
  const oid = m?.[1] ?? url.searchParams.get("oid");
  const id = m?.[2] ?? url.searchParams.get("id");
  if (!oid || !id || !/^-?\d+$/.test(oid) || !/^\d+$/.test(id)) return null;

  const query = new URLSearchParams({ oid, id, hd: "2" });
  const hash = url.searchParams.get("hash");
  if (hash && /^[a-f0-9]+$/i.test(hash)) query.set("hash", hash);
  return { kind: "iframe", provider: "vk", src: `https://vkvideo.ru/video_ext.php?${query}` };
}

function resolveRutubeSource(url: URL): VideoSource {
  const m = RUTUBE_PATH.exec(url.pathname);
  if (!m?.[1]) return null;
  return { kind: "iframe", provider: "rutube", src: `https://rutube.ru/play/embed/${m[1]}` };
}

/** URL из шорткода → источник для плеера, либо `null` (не рендерить). */
export function resolveVideoSource(raw: string): VideoSource {
  const value = raw.trim();

  if (value.startsWith("/")) {
    if (!value.startsWith("/media/") || value.includes("..") || value.includes("\\")) return null;
    return VIDEO_FILE.test(value) ? { kind: "file", src: value } : null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  if (VK_HOSTS.has(host)) return resolveVkSource(url);
  if (RUTUBE_HOSTS.has(host)) return resolveRutubeSource(url);
  return null;
}
