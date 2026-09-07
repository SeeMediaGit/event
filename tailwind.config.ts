import type { Config } from "tailwindcss";

// Same palette as landing/ so the events site reads as the same product.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
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
