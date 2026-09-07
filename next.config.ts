import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Poster / cover images live in Supabase Storage and on Bunny's CDN.
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.b-cdn.net" },
    ],
  },
};

export default nextConfig;
