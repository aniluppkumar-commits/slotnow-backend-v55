/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
        deva: ['"Noto Sans Devanagari"', 'Manrope', 'sans-serif'],
      },
      colors: {
        ink: {
          DEFAULT: '#1A1A1A',
          soft: '#5E5E5E',
          muted: '#A3A3A3',
        },
        cream: {
          DEFAULT: '#F9F8F6',
          100: '#FDFBF7',
          200: '#F3F0E9',
          300: '#E5E2DA',
        },
        forest: {
          DEFAULT: '#2C3E35',
          dark: '#1E2A24',
          soft: '#4A5D4E',
          faint: '#F1F3ED',
        },
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
