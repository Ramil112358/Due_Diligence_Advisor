import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        klarus: {
          ink: "#18181b",
          paper: "#ffffff",
          panel: "#f8fafc",
          accent: "#61684b",
          line: "#e2e8f0",
          muted: "#3f3f45",
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        surface: "0 16px 40px -28px rgba(15, 23, 42, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
