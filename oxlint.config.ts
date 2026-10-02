import { defineConfig } from 'oxlint';

export default defineConfig({
	plugins: ['typescript', 'unicorn', 'oxc', 'import', 'react', 'jsx-a11y', 'promise', 'node'],
	categories: {
		correctness: 'error',
		suspicious: 'error',
		perf: 'warn'
	},
	ignorePatterns: [
		'**/dist/**',
		'**/node_modules/**',
		'client/shots/output/**',
		'test-results/**',
		'playwright-report/**',
		'server/migrations/**',
		'.claude/**',
		'.agents/**',
		'tools/oxlint/anti-slop/**'
	],
	jsPlugins: [
		{ name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' },
		'@shadcn/lint'
	],
	rules: {
		'typescript/no-explicit-any': 'error',
		'typescript/consistent-type-imports': 'error',
		'typescript/no-non-null-assertion': 'error',
		'import/no-cycle': 'error',
		'import/no-duplicates': 'error',
		'react/react-in-jsx-scope': 'off',
		'react/jsx-key': 'error',
		'react/exhaustive-deps': 'error',
		'react/rules-of-hooks': 'error',
		'no-console': ['error', { allow: ['warn', 'error'] }],
		eqeqeq: 'error',

		'oxc/no-accumulating-spread': 'error',
		'anti-slop/no-array-filter-map': 'error',
		'anti-slop/no-reduce-accumulator-copy': 'error',
		'anti-slop/no-chained-type-assertions': 'error',
		'anti-slop/no-conditional-empty-object-spread': 'error',
		'anti-slop/no-known-value-widening': 'error',
		'anti-slop/no-module-mocking': 'error',
		'anti-slop/no-object-parameters': 'error',
		'anti-slop/no-reflect-apply': 'error',
		'anti-slop/no-reflect-get': 'error',
		'anti-slop/no-runtime-typeof': 'error',
		'anti-slop/no-shape-in-symbol-names': 'error',
		'anti-slop/no-unknown-parameters': 'error',
		'anti-slop/no-unknown-returns': 'error',
		'anti-slop/no-unknown-type-aliases': 'error',
		'anti-slop/no-unsafe-dictionary-type': 'error',
		'anti-slop/no-widen-then-assert': 'error',
		'anti-slop/require-readable-spacing': 'error',
		'anti-slop/require-safety-comment-for-type-assertion': 'error',

		'shadcn/no-restyle': ['error', { allow: ['layout'] }],
		'shadcn/no-raw-colors': 'error',
		'shadcn/no-arbitrary-values': ['error', { allow: ['layout'] }],
		'shadcn/no-inline-styles': 'error',
		'shadcn/no-unknown-classes': 'error',
		'shadcn/require-static-classes': 'error'
	},
	overrides: [
		{
			// shadcn/ui primitives own their appearance.
			files: ['client/src/components/ui/**'],
			rules: {
				'shadcn/no-restyle': 'off',
				'shadcn/no-arbitrary-values': 'off',
				'shadcn/require-static-classes': 'off'
			}
		}
	]
});
