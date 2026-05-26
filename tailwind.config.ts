import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          cream: "#F5F0E8",
          taupe: "#C4B9A8",
          terracotta: "#b5522a",
          brown: "#2e1f14",
        },
      },
      fontFamily: {
        serif: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
}
export default config
