import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    container: {
        center: true,
        padding: "1rem", // 16px
        screens: {
            "2xl": "1400px",
        },
    },
  	extend: {
  		colors: {
            border: "hsl(var(--border))",
            input: "hsl(var(--input))",
            ring: "hsl(var(--ring))",
            background: "hsl(var(--background))",
            foreground: "hsl(var(--foreground))",
            primary: {
                DEFAULT: "hsl(var(--primary))",
                foreground: "hsl(var(--primary-foreground))",
            },
            secondary: {
                DEFAULT: "hsl(var(--secondary))",
                foreground: "hsl(var(--secondary-foreground))",
            },
            destructive: {
                DEFAULT: "hsl(var(--destructive))",
                foreground: "hsl(var(--destructive-foreground))",
            },
            success: {
                DEFAULT: "hsl(var(--success))",
                foreground: "hsl(var(--success-foreground))",
            },
            warning: {
                DEFAULT: "hsl(var(--warning))",
                foreground: "hsl(var(--warning-foreground))",
            },
            muted: {
                DEFAULT: "hsl(var(--muted))",
                foreground: "hsl(var(--muted-foreground))",
            },
            accent: {
                DEFAULT: "hsl(var(--accent))",
                foreground: "hsl(var(--accent-foreground))",
            },
            popover: {
                DEFAULT: "hsl(var(--popover))",
                foreground: "hsl(var(--popover-foreground))",
            },
            card: {
                DEFAULT: "hsl(var(--card))",
                foreground: "hsl(var(--card-foreground))",
            },
            'status-green-subtle': 'hsl(var(--status-green-subtle))',
            'status-green-subtle-foreground': 'hsl(var(--status-green-subtle-foreground))',
            'status-yellow-subtle': 'hsl(var(--status-yellow-subtle))',
            'status-yellow-subtle-foreground': 'hsl(var(--status-yellow-subtle-foreground))',
            'status-red-subtle': 'hsl(var(--status-red-subtle))',
            'status-red-subtle-foreground': 'hsl(var(--status-red-subtle-foreground))',
  		},
  		borderRadius: {
            xl: `calc(var(--radius) + 4px)`, // 12px
            lg: `var(--radius)`, // 8px
            md: `calc(var(--radius) - 2px)`, // 6px
            sm: `calc(var(--radius) - 4px)`, // 4px
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
  			},
            shimmer: {
                '100%': {
                    transform: 'translateX(100%)',
                },
            },
            'load-glow': {
                '0%, 100%': { textShadow: 'none' },
                '50%': { textShadow: '0 0 8px hsl(var(--primary) / 0.5), 0 0 2px hsl(var(--primary) / 0.8)' },
            },
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
            'shimmer': 'shimmer 1.5s infinite',
            'load-glow': 'load-glow 2.5s ease-in-out 1',
  		},
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
    plugin(function({ addVariant }) {
        addVariant('ios', '.ios &');
    }),
  ],
};
export default config;