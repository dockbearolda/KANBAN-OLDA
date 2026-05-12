/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: '#FAF7F2',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
      },
      keyframes: {
        'pp-fade': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pp-pop': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'pp-fade': 'pp-fade 150ms ease-out',
        'pp-pop': 'pp-pop 150ms ease-out',
      },
    },
  },
  plugins: [],
};
