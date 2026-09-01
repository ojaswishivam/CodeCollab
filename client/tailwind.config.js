/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        dark: {
          950: "#07070a",
          900: "#0c0c10",
          850: "#111117",
          800: "#171720",
          700: "#1f1f2c",
          600: "#2d2d3f",
        },
      },
    },
  },
  plugins: [],
};
