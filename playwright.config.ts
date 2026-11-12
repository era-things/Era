import { defineConfig } from '@playwright/test';
export default defineConfig({
	testDir: './tests/browser',
	workers: 1,
	expect: { timeout: 10000 },
	use: {
		baseURL: 'http://127.0.0.1:41689',
		channel: 'chrome',
		viewport: { width: 1280, height: 800 }
	},
	webServer: {
		command: 'bun run start',
		url: 'http://127.0.0.1:41689',
		env: { ERA_DB: ':memory:', PORT: '41689', HOST: '127.0.0.1' },
		timeout: 90000
	}
});
