import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      // ── Typography ──────────────────────────────────────────────
      // font-display → Playfair Display (headings, brand wordmark)
      // font-body    → DM Sans         (UI text, labels, inputs)
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", "serif"],
        body: ['"DM Sans"', "system-ui", "sans-serif"],
      },

      // ── Shadows ─────────────────────────────────────────────────
      // Mirrors the prototype shadow values; use hsl() so they
      // respect the foreground/primary CSS vars automatically.
      boxShadow: {
        card: "0 4px 24px hsl(var(--foreground) / 0.10), 0 1px 4px hsl(var(--foreground) / 0.06)",
        "card-sm": "0 2px 8px hsl(var(--foreground) / 0.07)",
        terra: "0 3px 12px hsl(var(--primary) / 0.30)",
        "terra-lg": "0 4px 16px hsl(var(--primary) / 0.38)",
      },

      // ── Colors ───────────────────────────────────────────────────
      // shadcn/ui semantic tokens — all point to CSS vars in index.css
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Brand extras — values that don't map to a shadcn semantic slot
        "terra-dark": "hsl(var(--terra-dark))",   // hover state for primary buttons
        "ink-mid": "hsl(var(--ink-mid))",          // secondary text / labels
        success: {
          DEFAULT: "hsl(var(--success))",
          bg: "hsl(var(--success-bg))",
        },
      },

      // ── Border radius ────────────────────────────────────────────
      borderRadius: {
        lg: "var(--radius)",                      // 14px — cards, modals
        md: "calc(var(--radius) - 2px)",          // 12px — inputs, buttons
        sm: "calc(var(--radius) - 6px)",          // 8px  — badges, tags
      },

      // ── Keyframes ────────────────────────────────────────────────
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          from: { opacity: "0", transform: "scale(0.5)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-down": "slide-down 0.25s ease",
        "pop-in": "pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
