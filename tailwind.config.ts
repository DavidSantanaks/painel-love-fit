import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff1f4", 100: "#ffe3ea", 200: "#ffcbd8", 300: "#ffa1b9",
          400: "#ff6b92", 500: "#f83b6e", 600: "#e51a58", 700: "#c10f49",
          800: "#a11043", 900: "#89123e",
        },
        ink: { 50: "#f6f6f7", 100: "#ececef", 200: "#d5d6db", 300: "#b0b2bb", 400: "#858896", 500: "#666a7a", 600: "#515463", 700: "#424551", 800: "#2b2d36", 900: "#18191f", 950: "#0e0f13" },
        wa: { bg: "#efeae2", out: "#d9fdd3", in: "#ffffff", head: "#008069" },
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: { "fade-up": "fade-up .28s cubic-bezier(.2,.8,.2,1) both" },
    },
  },
  plugins: [],
} satisfies Config;
