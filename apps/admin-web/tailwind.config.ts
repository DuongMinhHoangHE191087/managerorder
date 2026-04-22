import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/widgets/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#55ca02",
          light: "#7add2a",
        },
        background: {
          light: "#f7f8f5",
        },
        glass: {
          white: "rgba(255, 255, 255, 0.7)",
          border: "rgba(255, 255, 255, 0.2)",
          shadow: "rgba(85, 202, 2, 0.05)",
        },
        surface: {
          light: "#f7faf6",
          strong: "#eef5e9",
          hover: "#edf4e7",
        },
      },
      fontFamily: {
        display: ["var(--font-heading)"],
        body: ["var(--font-body)"],
        heading: ["var(--font-heading)"],
      },
      borderRadius: {
        ios: "20px",
        "ios-sm": "14px",
        "ios-lg": "24px",
      },
      boxShadow: {
        glass: "0 1px 2px rgba(15, 23, 42, 0.06), 0 12px 32px rgba(15, 23, 42, 0.04)",
        "glass-hover": "0 1px 2px rgba(15, 23, 42, 0.08), 0 16px 40px rgba(15, 23, 42, 0.06)",
        ios: "0 1px 2px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [forms],
};

export default config;
