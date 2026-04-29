/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dhl: {
          red: '#D40511',
          yellow: '#FFCC00',
          'red-dark': '#b00410',
          'yellow-dark': '#e6b800',
        },
      },
    },
  },
  plugins: [],
};
