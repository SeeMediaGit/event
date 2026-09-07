import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

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
    <html lang="mn">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
