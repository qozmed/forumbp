/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: '0.75rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.25rem',
        xl: '1.5rem',
      },
      colors: {
        // Monochrome Palette
        gray: {
          750: '#262626', // Neutral dark
          850: '#171717', // Neutral darker
          900: '#0a0a0a', // Almost black
          950: '#000000', // Pure black
        },
        // Replacing Cyan/Accent with White/Gray scales
        accent: {
          DEFAULT: '#ffffff',
          hover: '#e5e5e5',
          dim: '#525252',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}