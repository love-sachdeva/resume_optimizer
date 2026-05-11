import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        ink: "#111111",
        bone: "#f7f4ea",
        mist: "#c7d8d4",
        cyan: "#75f0d6",
        salmon: "#ff8f5a",
        gold: "#f7c76c",
        panel: "rgba(255,255,255,0.72)"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(17, 17, 17, 0.14)",
        soft: "0 12px 30px rgba(17, 17, 17, 0.08)"
      },
      fontFamily: {
        sans: ["Avenir Next", "Segoe UI", "Helvetica Neue", "sans-serif"],
        display: ["Avenir Next Condensed", "Trebuchet MS", "Arial Narrow", "sans-serif"]
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at top, rgba(117,240,214,0.18), transparent 35%), radial-gradient(circle at bottom right, rgba(255,143,90,0.18), transparent 32%)"
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" }
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0, 0, 0) rotate(0deg)" },
          "50%": { transform: "translate3d(0, -16px, 0) rotate(6deg)" }
        },
        pulseGrid: {
          "0%, 100%": { opacity: "0.28" },
          "50%": { opacity: "0.62" }
        }
      },
      animation: {
        marquee: "marquee 28s linear infinite",
        drift: "drift 8s ease-in-out infinite",
        pulseGrid: "pulseGrid 4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
