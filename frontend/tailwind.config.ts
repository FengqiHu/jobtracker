import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        "ink-strong": "var(--ink-strong)",
        "ink-soft": "var(--ink-soft)",
        "surface-muted": "var(--surface-muted)",
        line: "var(--line)"
      },
      fontFamily: {
        display: ['"Cal Sans"', "Inter", "sans-serif"],
        sans: ["Inter", "sans-serif"]
      },
      boxShadow: {
        card: "var(--shadow-card)",
        soft: "var(--shadow-soft)",
        inset: "var(--shadow-inset)"
      },
      borderRadius: {
        xl2: "1.25rem"
      },
      maxWidth: {
        container: "1200px"
      }
    }
  },
  plugins: []
}

export default config
