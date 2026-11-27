import adapter from '@sveltejs/adapter-bun';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// Prebundle the lazy timeline dependencies together to keep Vite from
	// invalidating an in-flight chart import when the day editor opens.
	optimizeDeps: {
		include: [
			'@codemirror/commands',
			'@codemirror/lang-markdown',
			'@codemirror/language',
			'@codemirror/state',
			'@codemirror/view',
			'@lezer/highlight',
			'@lezer/markdown',
			'@silkdown/core',
			'echarts/core',
			'echarts/charts',
			'echarts/components',
			'echarts/renderers',
			'emoji-picker-element/picker'
		]
	},
	server: {
		fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/data/**', '**/*.sqlite*'] }
	},
	ssr: { external: ['bun:sqlite'] },
	// The JSON API checks browser origins itself and also accepts bodyless HTTP DELETEs.
	plugins: [sveltekit({ adapter: adapter(), csrf: { trustedOrigins: ['*'] } })]
});
