import { resolveVideoSource } from "@/lib/content/video-url";

/**
 * `{{Видео: url}}` — плеер VK Видео / Rutube (iframe) или собственный файл `/media/…`.
 * Источник проходит белый список `resolveVideoSource`; иначе ничего не рендерится.
 * `sandbox` не ставится: плееры VK/Rutube требуют scripts + same-origin (вместе это
 * бессмысленно), а источник уже ограничен whitelist'ом и CSP `frame-src`.
 * Изоморфный компонент.
 */
export function VideoEmbed({ url }: { url: string }) {
  const source = resolveVideoSource(url);
  if (source === null) return null;

  if (source.kind === "iframe") {
    return (
      <figure className="my-6">
        <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-lg border">
          <iframe
            src={source.src}
            title="Видео"
            loading="lazy"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </figure>
    );
  }

  return (
    <figure className="my-6">
      <video controls preload="metadata" className="bg-muted w-full rounded-lg border">
        <source src={source.src} />
      </video>
    </figure>
  );
}
