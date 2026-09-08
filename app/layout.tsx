import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

// Self-hosted by next/font at build time — no request to Google's CDN at
// runtime, and no layout shift while the face loads.
//
// Manrope, not Plus Jakarta Sans: every word in this UI is Mongolian Cyrillic,
// and Jakarta ships no Cyrillic glyphs at all, so it would have been silently
// replaced by the system font across the entire interface. The `cyrillic`
// subset below is the part that actually matters here.
const sans = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "SeeMedia Events — Уралдаан тэмцээн",
  description:
    "SeeMedia-гийн зохион байгуулж буй уралдаан тэмцээнүүд. Нэвтэрч жагсаалтыг үзнэ үү.",
  // The site is behind a login wall, so there is nothing here for a crawler.
  robots: { index: false, follow: false },
  icons: { icon: "/app-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn" className={sans.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
