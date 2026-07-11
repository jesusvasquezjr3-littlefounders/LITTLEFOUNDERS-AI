/**
 * Token implementation of /DESIGN.md — values map 1:1 to its YAML front matter.
 * Do NOT add values here that DESIGN.md doesn't define.
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      base: 'rgb(var(--lf-base) / <alpha-value>)',
      surface: 'rgb(var(--lf-surface) / <alpha-value>)',
      'surface-sunken': 'rgb(var(--lf-surface-sunken) / <alpha-value>)',
      content: 'rgb(var(--lf-content) / <alpha-value>)',
      'content-muted': 'rgb(var(--lf-content-muted) / <alpha-value>)',
      'content-faint': 'rgb(var(--lf-content-faint) / <alpha-value>)',
      outline: 'rgb(var(--lf-outline) / <alpha-value>)',
      primary: 'rgb(var(--lf-primary) / <alpha-value>)',
      'primary-strong': 'rgb(var(--lf-primary-strong) / <alpha-value>)',
      'primary-soft': 'rgb(var(--lf-primary-soft) / <alpha-value>)',
      'on-primary': 'rgb(var(--lf-on-primary) / <alpha-value>)',
      secondary: 'rgb(var(--lf-secondary) / <alpha-value>)',
      'secondary-soft': 'rgb(var(--lf-secondary-soft) / <alpha-value>)',
      'on-secondary': 'rgb(var(--lf-on-secondary) / <alpha-value>)',
      accent: 'rgb(var(--lf-accent) / <alpha-value>)',
      'accent-soft': 'rgb(var(--lf-accent-soft) / <alpha-value>)',
      'on-accent': 'rgb(var(--lf-on-accent) / <alpha-value>)',
      success: 'rgb(var(--lf-success) / <alpha-value>)',
      'success-soft': 'rgb(var(--lf-success-soft) / <alpha-value>)',
      warning: 'rgb(var(--lf-warning) / <alpha-value>)',
      'warning-soft': 'rgb(var(--lf-warning-soft) / <alpha-value>)',
      error: 'rgb(var(--lf-error) / <alpha-value>)',
      'error-soft': 'rgb(var(--lf-error-soft) / <alpha-value>)',
    },
    fontFamily: {
      display: ['Quicksand', 'system-ui', 'sans-serif'],
      body: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
    },
    borderRadius: {
      none: '0',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      clay: 'var(--lf-shadow-clay)',
      'clay-sm': 'var(--lf-shadow-clay-sm)',
      'clay-pressed': 'var(--lf-shadow-clay-pressed)',
      'clay-sunken': 'var(--lf-shadow-clay-sunken)',
    },
    extend: {
      maxWidth: {
        container: '1280px',
      },
      spacing: {
        sidebar: '280px',
      },
    },
  },
  plugins: [],
};
