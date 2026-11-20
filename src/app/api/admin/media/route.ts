import { audit } from "@/lib/admin/audit";
import { toMediaDto } from "@/lib/admin/media-dto";
import { listMedia } from "@/lib/admin/media-queries";
import { saveImage } from "@/lib/media/storage";
import { MAX_IMAGE_BYTES, MediaValidationError } from "@/lib/media/validate";
import { requireAdminAction, type AuthSession } from "@/lib/session";

const DEFAULT_FOLDER = "general";
const MAX_ALT_LENGTH = 300;
/** Запас на multipart-обвязку: тело заметно больше лимита — отказываем, не читая его */
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 1024 * 1024;

async function getAdminSession(): Promise<AuthSession | null> {
  try {
    return await requireAdminAction();
  } catch {
    return null;
  }
}

function unauthorized(): Response {
  return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

function tooLarge(): Response {
  return Response.json({ error: "Файл больше 10 МБ" }, { status: 413 });
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

/** Загрузка картинки в медиатеку: multipart `file`, `folder?`, `alt?` → 201 `{ asset }`. */
export async function POST(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return tooLarge();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Ожидается multipart/form-data");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Файл не передан");
  if (file.size > MAX_IMAGE_BYTES) return tooLarge();

  const folderRaw = form.get("folder");
  const folder =
    typeof folderRaw === "string" && folderRaw.trim() ? folderRaw.trim() : DEFAULT_FOLDER;
  const altRaw = form.get("alt");
  const alt = typeof altRaw === "string" ? altRaw.trim().slice(0, MAX_ALT_LENGTH) : "";

  try {
    const asset = await saveImage(file, {
      folder,
      alt,
      userId: session.user.id,
      originalName: file.name,
    });
    await audit(session.user.id, "media.upload", "media", asset.id, {
      after: { originalName: asset.originalName, folder: asset.folder },
    });
    return Response.json({ asset: toMediaDto(asset) }, { status: 201 });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return error.code === "TOO_LARGE" ? tooLarge() : badRequest(error.message);
    }
    console.error("[api/admin/media] upload failed", error);
    return Response.json({ error: "Не удалось сохранить файл" }, { status: 500 });
  }
}

/** Список для пикера и медиатеки: `?q=&folder=&page=&pageSize=`. */
export async function GET(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") ?? "1");
  const pageSizeRaw = params.get("pageSize");

  const result = await listMedia({
    q: params.get("q"),
    folder: params.get("folder"),
    page: Number.isFinite(page) ? page : 1,
    pageSize: pageSizeRaw ? Number(pageSizeRaw) : undefined,
  });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
