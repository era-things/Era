import { expect, test } from '@playwright/test';
import { usesDevServer } from './servers';

test('the favicon matches the server environment', async ({ page }) => {
	await page.goto('/');
	const favicon = page.locator('link[rel="icon"]');
	await expect(favicon).toHaveCount(1);

	const url = await favicon.evaluate((link: HTMLLinkElement) => link.href);
	expect(new URL(url).pathname).toBe(usesDevServer ? '/favicon-dev.svg' : '/favicon.svg');
	const response = await page.request.get(url);
	expect(response.ok()).toBe(true);
	expect(response.headers()['content-type']).toContain('image/svg+xml');
});
