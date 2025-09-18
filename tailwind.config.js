/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        binbird: {
          red: "#ff5757",
          black: "#000000",
          white: "#ffffff",
        },
      },
    },
  },
  plugins: [],
}
