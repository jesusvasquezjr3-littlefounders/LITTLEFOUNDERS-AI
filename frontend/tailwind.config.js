/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // DESIGN.md is a skeleton — DO NOT add custom tokens here until the
    // mockup-derived spec lands. Tailwind defaults only.
    extend: {},
  },
  plugins: [],
};
