/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./public/**/*.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"EB Garamond"', 'serif'],
        serif: ['"EB Garamond"', 'Georgia', 'serif']
      },
      colors: {
        paper: '#faf9f7',
        ink: '#1a1a1a',
        mute: '#6b6b6b',
        line: '#e6e3df'
      }
    },
  },
  plugins: [],
}
