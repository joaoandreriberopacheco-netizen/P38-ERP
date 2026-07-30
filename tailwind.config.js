/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	screens: {
  		sm: '640px',
  		md: '768px',
  		lg: '1024px',
  		xl: '1280px',
  		'2xl': '1536px',
  		/* Semânticos P38: phone < md · tablet md–lg · desktop ≥ lg */
  		tablet: '768px',
  		desktop: '1024px',
  	},
  	extend: {
  		fontFamily: {
  			sans: ['Inter', '"DIN 1451"', 'DINish', 'system-ui', 'sans-serif'],
  			inter: ['Inter', 'system-ui', 'sans-serif'],
  			'din-1451': ['"DIN 1451"', 'DINish', 'Barlow Condensed', 'system-ui', 'sans-serif'],
  			din1451: ['"DIN 1451"', 'DINish', 'Barlow Condensed', 'system-ui', 'sans-serif'],
  			outfit: ['Outfit', 'system-ui', 'sans-serif'],
  			labotrat: ['Outfit', 'system-ui', 'sans-serif'],
  			gothic: ['"Century Gothic"', 'CenturyGothic', 'AppleGothic', '"Didact Gothic"', 'Futura', 'sans-serif'],
  		},
  		fontSize: {
  			/* Piso 14px (1rem com html=14px); lg+ proporcional */
  			xs: ['1rem', { lineHeight: '1.25' }],
  			sm: ['1rem', { lineHeight: '1.375' }],
  			base: ['1rem', { lineHeight: '1.5' }],
  			lg: ['1.125rem', { lineHeight: '1.375' }],
  			xl: ['1.25rem', { lineHeight: '1.375' }],
  			'2xl': ['1.5rem', { lineHeight: '1.25' }],
  			'3xl': ['1.875rem', { lineHeight: '1.2' }],
  			'4xl': ['2.25rem', { lineHeight: '1.1' }],
  			'5xl': ['3rem', { lineHeight: '1' }],
  			'6xl': ['3.75rem', { lineHeight: '1' }],
  			'7xl': ['4.5rem', { lineHeight: '1' }],
  			'8xl': ['6rem', { lineHeight: '1' }],
  			'9xl': ['8rem', { lineHeight: '1' }],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
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
  			p38: {
  				olive: 'hsl(var(--p38-olive))',
  				lime: 'hsl(var(--p38-lime))',
  				'citrus-yellow': 'hsl(var(--p38-citrus-yellow))',
  				'citrus-orange': 'hsl(var(--p38-citrus-orange))',
  				mediterranean: 'hsl(var(--p38-mediterranean))',
  			}
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
  plugins: [
    require("tailwindcss-animate"),
    function ({ addVariant }) {
      // Mobile: telemóvel OU tablet retrato
      addVariant('mobile-layout', '@media (max-width: 767px), ((max-width: 1023px) and (orientation: portrait))');
      // Desktop: monitor OU tablet paisagem
      addVariant('desktop-layout', '@media (min-width: 1024px), ((min-width: 768px) and (orientation: landscape))');
      addVariant('tablet-landscape', '@media (min-width: 768px) and (max-width: 1023px) and (orientation: landscape)');
      addVariant('tablet-portrait', '@media (min-width: 768px) and (max-width: 1023px) and (orientation: portrait)');
    },
  ],
}