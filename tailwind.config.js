/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./js/**/*.js"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f7f7f7",
          100: "#efefef",
          200: "#dfdfdf",
          300: "#c8c8c8",
          400: "#a8a8a8",
          500: "#8a8a8a",
          600: "#6f6f6f",
          700: "#565656",
          800: "#3f3f3f",
          900: "#2e2e2e"
        }
      }
    }
  },
  plugins: []
};
