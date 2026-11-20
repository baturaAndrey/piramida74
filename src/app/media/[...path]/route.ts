import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { resolveMediaPath } from "@/lib/media/storage";

// `runtime`/`dynamic` не экспортируем — несовместимы с cacheComponents.
// Чтение `request.headers` делает обработчик динамическим (не пререндерится при build).

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".webp": "image/webp",
};

/** Имя файла содержит UUID, файлы не меняются — кэшируем навсегда. */
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Битая percent-последовательность → null (ответ 404), а не исключение. */
function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const ifNoneMatch = request.headers.get("if-none-match");
  const { path: segments } = await params;

  const decoded = segments.map(safeDecode);
  if (decoded.some((s) => s === null)) return notFound();
  const rel = decoded.join("/");

  const contentType = CONTENT_TYPES[path.posix.extname(rel).toLowerCase()];
  if (!contentType) return notFound();

  let abs: string;
  try {
    abs = resolveMediaPath(rel);
  } catch {
    return notFound();
  }

  let size: number;
  let mtimeMs: number;
  try {
    const stats = await stat(abs);
    if (!stats.isFile()) return notFound();
    size = stats.size;
    mtimeMs = stats.mtimeMs;
  } catch {
    return notFound();
  }

  const etag = `W/"${size}-${Math.floor(mtimeMs)}"`;
  const commonHeaders = {
    ETag: etag,
    "Cache-Control": IMMUTABLE_CACHE,
    "X-Content-Type-Options": "nosniff",
  };

  if (ifNoneMatch && ifNoneMatch.split(",").some((tag) => tag.trim() === etag)) {
    return new Response(null, { status: 304, headers: commonHeaders });
  }

  const body = Readable.toWeb(createReadStream(abs)) as ReadableStream;
  return new Response(body, {
    status: 200,
    headers: {
      ...commonHeaders,
      "Content-Type": contentType,
      "Content-Length": String(size),
    },
  });
}
