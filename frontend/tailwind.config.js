/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        navy: { 50: "#f1f4fb", 100: "#dfe5f5", 200: "#bcc8ea", 300: "#8fa1d8", 400: "#5f78c0", 500: "#3d56a3", 600: "#2d4285", 700: "#243469", 800: "#1b2752", 900: "#121a3a", 950: "#0b1129" },
        brand: { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6" },
      },
      keyframes: {
        fadeUp: { "0%": { opacity: 0, transform: "translateY(12px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
      },
      animation: { "fade-up": "fadeUp .5s ease-out both", float: "float 6s ease-in-out infinite" },
    },
  },
  plugins: [],
};
