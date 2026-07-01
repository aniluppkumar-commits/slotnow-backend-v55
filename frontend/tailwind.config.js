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
          DEFAULT: '#1D2E5B',
          soft: '#4C5D82',
          muted: '#8896B4',
        },
        cream: {
          DEFAULT: '#F5F6F8',
          100: '#FFFFFF',
          200: '#EEF0F5',
          300: '#DEE2EC',
        },
        // Primary brand navy blue (from mobile logo "Slot")
        forest: {
          DEFAULT: '#1E3A8A',
          dark: '#152B65',
          soft: '#3B4E86',
          faint: '#EEF2FF',
        },
        // Accent orange (from mobile logo "Now" + Continue button)
        accent: {
          DEFAULT: '#F97316',
          dark: '#EA580C',
          soft: '#FDBA74',
          faint: '#FFF7ED',
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
