/**
 * Старые пути PHP-сайта к ассетам/загрузкам: навсегда удалены (410), чтобы поисковики
 * быстрее выкинули их из индекса. Папка `public/` Next.js отдаётся с корня и не пересекается.
 */
const gone = () =>
  new Response("Gone", {
    status: 410,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Robots-Tag": "noindex",
    },
  });

export const GET = gone;
export const HEAD = gone;
