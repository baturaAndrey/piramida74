import { Suspense } from "react";
import { Onest } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getClientEnv } from "@/lib/env";
import type { Metadata, Viewport } from "next";
import "./globals.css";

const onest = Onest({
  subsets: ["cyrillic", "latin"],
  variable: "--font-onest",
  display: "swap",
});

const SITE_NAME = "Бильярдный клуб «Пирамида»";
const DESCRIPTION =
  "Бильярдный клуб «Пирамида» в Челябинске: русская пирамида, американский пул, VIP-комнаты, авторская кухня, турниры и обучение. Горсад им. Пушкина, ежедневно 09:00–02:00.";

export const metadata: Metadata = {
  metadataBase: new URL(getClientEnv().NEXT_PUBLIC_SITE_URL),
  title: { default: `${SITE_NAME} в Челябинске`, template: `%s | ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: SITE_NAME,
    title: `${SITE_NAME} в Челябинске`,
    description: DESCRIPTION,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#2f6c4a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body className={`${onest.variable} min-h-screen antialiased`}>
        {/* Cache Components: страницы, читающие headers()/cookies() без своего Suspense, не ломают пререндер */}
        <Suspense fallback={null}>{children}</Suspense>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
