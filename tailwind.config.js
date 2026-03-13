/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}', // Target only your source files
    '!./node_modules', // Explicitly exclude node_modules
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}

