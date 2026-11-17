import { defineConfig } from '@playwright/test';

const mode = process.env.ERA_VERIFY_MODE;
const dev = mode === 'browser' || mode === 'scenario';
const warm = dev && process.env.ERA_VERIFY_WARM === '1';
const baseURL = process.env.ERA_VERIFY_URL ?? 'http://127.0.0.1:41689';
const bun = process.env.ERA_VERIFY_BUN
	? process.platform === 'win32'
		? '"%ERA_VERIFY_BUN%"'
		: '"$ERA_VERIFY_BUN"'
	: 'bun';

export default defineConfig({
	testDir: mode === 'scenario' ? './tests/scenarios' : './tests/browser',
	outputDir: `test-results/${mode === 'scenario' ? 'scenarios' : dev ? 'focused' : 'production'}`,
	workers: 1,
	globalSetup: warm ? './tests/browser/reset-warm-server.ts' : undefined,
	reporter: mode ? 'dot' : undefined,
	expect: { timeout: 10000 },
	use: {
		baseURL,
		channel: 'chrome',
		viewport: { width: 1280, height: 800 },
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure'
	},
	webServer: warm
		? undefined
		: dev
			? {
					command: `${bun} --bun scripts/verify-server.ts`,
					url: baseURL + process.env.ERA_VERIFY_HEALTH,
					timeout: 15000
				}
			: {
					command: `${bun} build/index.js`,
					url: baseURL,
					env: {
						ERA_DB: ':memory:',
						PORT: new URL(baseURL).port,
						HOST: '127.0.0.1',
						ORIGIN: baseURL
					},
					timeout: 15000
				}
});
