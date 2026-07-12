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
      band: 'rgb(var(--lf-band) / <alpha-value>)',
      inverse: 'rgb(var(--lf-inverse) / <alpha-value>)',
      'inverse-surface': 'rgb(var(--lf-inverse-surface) / <alpha-value>)',
      'on-inverse': 'rgb(var(--lf-on-inverse) / <alpha-value>)',
      'on-inverse-muted': 'rgb(var(--lf-on-inverse-muted) / <alpha-value>)',
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
      'accent-strong': 'rgb(var(--lf-accent-strong) / <alpha-value>)',
      'accent-soft': 'rgb(var(--lf-accent-soft) / <alpha-value>)',
      'on-accent': 'rgb(var(--lf-on-accent) / <alpha-value>)',
      delight: 'rgb(var(--lf-delight) / <alpha-value>)',
      'delight-soft': 'rgb(var(--lf-delight-soft) / <alpha-value>)',
      'on-delight': 'rgb(var(--lf-on-delight) / <alpha-value>)',
      success: 'rgb(var(--lf-success) / <alpha-value>)',
      'success-soft': 'rgb(var(--lf-success-soft) / <alpha-value>)',
      'success-strong': 'rgb(var(--lf-success-strong) / <alpha-value>)',
      'on-success': 'rgb(var(--lf-on-success) / <alpha-value>)',
      warning: 'rgb(var(--lf-warning) / <alpha-value>)',
      'warning-soft': 'rgb(var(--lf-warning-soft) / <alpha-value>)',
      'warning-strong': 'rgb(var(--lf-warning-strong) / <alpha-value>)',
      'on-warning': 'rgb(var(--lf-on-warning) / <alpha-value>)',
      error: 'rgb(var(--lf-error) / <alpha-value>)',
      'error-soft': 'rgb(var(--lf-error-soft) / <alpha-value>)',
      'error-strong': 'rgb(var(--lf-error-strong) / <alpha-value>)',
      'on-error': 'rgb(var(--lf-on-error) / <alpha-value>)',
    },
    fontFamily: {
      display: ['Figtree', 'system-ui', 'sans-serif'],
      body: ['Figtree', 'system-ui', 'sans-serif'],
    },
    borderRadius: {
      none: '0',
      sm: '10px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      glass: 'var(--lf-shadow-glass)',
      'glass-sm': 'var(--lf-shadow-glass-sm)',
      pop: 'var(--lf-shadow-pop)',
    },
    extend: {
      maxWidth: {
        container: '1200px',
      },
      spacing: {
        sidebar: '280px',
        'sidebar-sm': '88px',
      },
    },
  },
  plugins: [],
};
