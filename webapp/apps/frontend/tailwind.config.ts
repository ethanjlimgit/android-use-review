import type { Config } from "tailwindcss";

// Tailwind v4 uses CSS-first configuration via @theme directive in globals.css
// This config file is kept for content paths
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/shared-ui/**/*.{js,ts,jsx,tsx,mdx}",
  ],
} satisfies Config;

