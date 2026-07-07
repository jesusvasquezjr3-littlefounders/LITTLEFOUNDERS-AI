import type { Config } from "tailwindcss";

/**
 * LittleFounders Tailwind Configuration
 * 
 * Design tokens authority: frontend/DESIGN.md (documento Director de Frontend).
 * The HSL variables read here are defined in frontend/src/index.css (:root / .dark).
 * For the corporate visual system, see DESIGN.md §§4.1–4.5.
 * Corp component classes (corp-*) are implemented in index.css and do NOT read
 * from these HSL tokens — they use hard-coded hex values with their own .dark
 * variants. See DESIGN.md §5 for the full component catalog.
 */
export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Duolingo-style success/warning/info
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))',
					light: 'hsl(var(--success-light))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))',
					light: 'hsl(var(--warning-light))'
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))',
					light: 'hsl(var(--info-light))'
				},
				revenue: {
					DEFAULT: 'hsl(var(--revenue))',
					foreground: 'hsl(var(--revenue-foreground))',
					light: 'hsl(var(--revenue-light))'
				},
				customers: {
					DEFAULT: 'hsl(var(--customers))',
					foreground: 'hsl(var(--customers-foreground))',
					light: 'hsl(var(--customers-light))'
				},
				product: {
					DEFAULT: 'hsl(var(--product))',
					foreground: 'hsl(var(--product-foreground))',
					light: 'hsl(var(--product-light))'
				},
				team: {
					DEFAULT: 'hsl(var(--team))',
					foreground: 'hsl(var(--team-foreground))',
					light: 'hsl(var(--team-light))'
				}
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-success': 'var(--gradient-success)',
				'gradient-revenue': 'var(--gradient-revenue)',
				'gradient-customers': 'var(--gradient-customers)',
				'gradient-product': 'var(--gradient-product)',
				'gradient-team': 'var(--gradient-team)',
				'gradient-warning': 'var(--gradient-warning)'
			},
			boxShadow: {
				'soft': 'var(--shadow-soft)',
				'medium': 'var(--shadow-medium)',
				'large': 'var(--shadow-large)',
				'button': 'var(--shadow-button)',
				'button-hover': 'var(--shadow-button-hover)',
				'button-active': 'var(--shadow-button-active)'
			},
			transitionProperty: {
				'fast': 'var(--transition-fast)',
				'smooth': 'var(--transition-smooth)',
				'bounce': 'var(--transition-bounce)',
				'slow': 'var(--transition-slow)'
			},
			borderRadius: {
				'sm': 'var(--radius-sm)',
				'lg': 'var(--radius)',
				'md': 'var(--radius-md)',
				'xl': 'var(--radius-lg)',
				'2xl': 'var(--radius-xl)',
				'full': 'var(--radius-full)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
