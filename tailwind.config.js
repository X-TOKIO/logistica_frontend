/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        background: 'var(--color-background)',
        text: 'var(--color-text)',
        muted: 'var(--color-text-muted)',
        card: 'var(--color-card)',
        sidebar: 'var(--color-sidebar)',
        divider: 'var(--color-divider)',
        surface: 'var(--color-surface)',
      },
      fontFamily: {
        sans: ['Public Sans', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
