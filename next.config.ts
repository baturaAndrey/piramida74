import { legacyRedirects } from "./src/lib/seo/legacy-redirects";
import type { NextConfig } from "next";

type RedirectRule = Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>>[number];

const isProd = process.env.NODE_ENV === "production";

// CSP. Inline-скрипты Next.js требуют 'unsafe-inline' (nonce принудительно делает
// страницы динамическими и ломает prerender Cache Components).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://mc.yandex.ru https://mc.yandex.com https://yastatic.net`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://mc.yandex.ru https://mc.yandex.com https://yastatic.net https://*.maps.yandex.net https://yandex.ru",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self' https://mc.yandex.ru https://mc.yandex.com https://yastatic.net wss://mc.yandex.ru wss://mc.yandex.com",
  // карта Яндекса (конструктор/виджет организации; *.yandex.ru покрывает и mc.yandex.ru), VK Видео, Rutube
  "frame-src https://yandex.ru https://*.yandex.ru https://vk.com https://vk.ru https://vkvideo.ru https://rutube.ru",
  "child-src blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  // sharp — нативный модуль: не бандлить и гарантированно положить в standalone.
  // src/assets/fonts — woff-шрифты Onest для opengraph-image (кладёт задача 02, читает задача 25)
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/*": ["node_modules/sharp/**/*", "src/assets/fonts/**/*"],
  },
  experimental: {
    // загрузка до 10 МБ + накладные расходы multipart
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [], // внешних источников нет; загруженные файлы отдаёт /media и <Picture>
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: noindex },
      { source: "/login", headers: noindex },
      { source: "/forgot-password", headers: noindex },
      { source: "/reset-password", headers: noindex },
    ];
  },
  async redirects() {
    const rules: RedirectRule[] = [...legacyRedirects];
    // www -> apex как вторая линия обороны (основной редирект — Traefik/Dokploy).
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (site) {
      const host = new URL(site).host;
      if (!host.startsWith("www.") && !host.startsWith("localhost")) {
        rules.push({
          source: "/:path*",
          has: [{ type: "host", value: `www.${host}` }],
          destination: `${site.replace(/\/+$/, "")}/:path*`,
          statusCode: 301,
        });
      }
    }
    return rules;
  },
};

export default nextConfig;
