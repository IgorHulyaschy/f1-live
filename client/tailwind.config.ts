import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS v4 Configuration
 *
 * Note: In Tailwind v4, most theme customization is done via the @theme directive
 * in your CSS file (see src/index.css). This config file is now minimal and only
 * used for content paths and plugins.
 *
 * Theme customization (fonts, colors, shadows, etc.) should be added to src/index.css
 * using the @theme { } block.
 */
export default {
	content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	plugins: []
} satisfies Config;
