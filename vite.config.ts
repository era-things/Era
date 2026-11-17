import adapter from '@sveltejs/adapter-bun';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/data/**', '**/*.sqlite*'] }
	},
	ssr: { external: ['bun:sqlite'] },
	// The JSON API checks browser origins itself and also accepts bodyless HTTP DELETEs.
	plugins: [sveltekit({ adapter: adapter(), csrf: { trustedOrigins: ['*'] } })]
});
