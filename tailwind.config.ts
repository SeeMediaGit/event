import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// Same palette as landing/ so the events site reads as the same product.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // --font-sans is set by next/font in app/layout.tsx. The default stack
        // stays behind it as the fallback, so a failed font load degrades to
        // the system face rather than to a serif.
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        ink: {
          DEFAULT: "#0a0a0a",
          surface: "#111111",
          elevated: "#1a1a1a",
        },
        brand: {
          DEFAULT: "#22c55e",
          light: "#4ade80",
          dark: "#16a34a",
        },
        muted: "#9ca3af",
      },
      boxShadow: {
        glow: "0 0 30px rgba(34,197,94,0.3), 0 0 60px rgba(34,197,94,0.1)",
        "glow-strong":
          "0 0 45px rgba(34,197,94,0.45), 0 0 95px rgba(34,197,94,0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
