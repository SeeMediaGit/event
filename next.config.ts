import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dev-only bubble. It defaults to the bottom-left corner, which is exactly
  // where AppSidebar puts its Гарах button — moving it right keeps the rail
  // usable while developing.
  devIndicators: { position: "bottom-right" },
  images: {
    // Poster / cover images live in Supabase Storage and on Bunny's CDN.
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.b-cdn.net" },
    ],
  },
};

export default nextConfig;
