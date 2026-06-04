/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rowa: {
          blue: '#4B5DB8',
          'blue-light': '#6B7DD8',
          'blue-dark': '#3A4A9A',
          pink: '#F08090',
          'pink-light': '#F5A0AE',
          'pink-dark': '#D06070',
          bg: '#F8F9FF',
          text: '#1A1A2E',
          muted: '#6B7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Thai', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
