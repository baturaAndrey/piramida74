// Клиентские helpers медиатеки: проверка файла до отправки, загрузка и чтение списка через /api/admin/media.
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  type MediaDto,
  type MediaListResponse,
} from "./media-dto";

const MEDIA_API = "/api/admin/media";

/** Сообщение об ошибке или `null`, если файл можно отправлять. */
export function validateImageFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `«${file.name}»: допустимы только JPEG, PNG, WebP и AVIF`;
  }
  if (file.size > MAX_UPLOAD_BYTES) return `«${file.name}»: файл больше 10 МБ`;
  return null;
}

async function readError(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return "Сессия истекла — войдите снова";
  if (res.status === 413) return "Файл больше 10 МБ";
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // тело не JSON — используем общий текст
  }
  return fallback;
}

/** Загружает картинку; при ошибке бросает `Error` с понятным пользователю текстом. */
export async function uploadMedia(
  file: File,
  opts: { folder: string; alt?: string | undefined }
): Promise<MediaDto> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", opts.folder);
  if (opts.alt) form.append("alt", opts.alt);

  let res: Response;
  try {
    res = await fetch(MEDIA_API, { method: "POST", body: form });
  } catch {
    throw new Error("Нет связи с сервером");
  }
  if (!res.ok) throw new Error(await readError(res, "Не удалось загрузить файл"));
  const body = (await res.json()) as { asset: MediaDto };
  return body.asset;
}

export async function fetchMediaPage(
  params: { q?: string; folder?: string; page?: number; pageSize?: number | undefined },
  signal?: AbortSignal
): Promise<MediaListResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.folder) search.set("folder", params.folder);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));

  const res = await fetch(`${MEDIA_API}?${search.toString()}`, {
    signal: signal ?? null,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await readError(res, "Не удалось загрузить медиатеку"));
  return (await res.json()) as MediaListResponse;
}
