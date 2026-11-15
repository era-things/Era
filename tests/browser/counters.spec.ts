import { test, expect } from '@playwright/test';
import { changes } from '../../src/lib/calendar-records';

test('built-in weight and steps share a row, persist, and retain values when unpinned', async ({
	page
}, testInfo) => {
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Measures', exact: true }).click();
	for (const name of ['Nutrition', 'Weight', 'Steps'])
		await page.getByRole('button', { name: 'Pin ' + name, exact: true }).click();
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	const weight = today.getByRole('spinbutton', { name: 'Weight (kg)', exact: true });
	const steps = today.getByRole('spinbutton', { name: 'Steps', exact: true });
	await weight.fill('72.65');
	await steps.fill('8200');
	await steps.fill('1.5');
	expect(await steps.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
	await steps.fill('8200');
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(weight).toHaveValue('72.65');
	await expect(steps).toHaveValue('8200');
	for (const width of [1280, 390]) {
		await page.setViewportSize({ width, height: 800 });
		const cards = today.locator('.compact-widget');
		const a = await cards.nth(0).boundingBox();
		const b = await cards.nth(1).boundingBox();
		const nutrition = await today.locator('.full-widget').boundingBox();
		expect(a!.y).toBe(b!.y);
		expect(a!.x + a!.width).toBeLessThan(b!.x);
		expect(nutrition!.width).toBeGreaterThan(a!.width);
		expect(nutrition!.y + nutrition!.height).toBeLessThanOrEqual(a!.y);
		expect(await today.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
	}
	await page.screenshot({ path: testInfo.outputPath('compact-counters-mobile.png') });
	await page.getByRole('tab', { name: 'Measures', exact: true }).click();
	await page.getByRole('button', { name: 'Pin Weight', exact: true, pressed: true }).click();
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(weight).toHaveValue('72.65');
	await expect(steps).toHaveValue('8200');
	await page.getByRole('tab', { name: 'Measures', exact: true }).click();
	await page.getByRole('button', { name: 'Pin Weight', exact: true, pressed: false }).click();
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	const selected = page.getByRole('complementary', { name: 'Selected day', exact: true });
	await expect(selected.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveValue('72.65');
	await selected.getByRole('spinbutton', { name: 'Weight (kg)' }).fill('');
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(weight).toHaveValue('');
	await expect(steps).toHaveValue('8200');
});

test('unpinned built-ins are added per day and pinned ones appear on empty days', async ({
	page
}, testInfo) => {
	const before = await (await page.request.get('/api/calendar')).json();
	const next = {
		...before,
		nutrition: { pinned: false, days: {} },
		counters: { pinned: { weight: false, steps: false }, days: {} }
	};
	expect((await page.request.post('/api/calendar', { data: changes(before, next) })).ok()).toBe(
		true
	);
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	await expect(today.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveCount(0);
	await expect(today.getByRole('spinbutton', { name: 'Steps', exact: true })).toHaveCount(0);
	await expect(today.getByRole('heading', { name: 'Nutrition', exact: true })).toHaveCount(0);
	for (const name of ['Nutrition', 'Weight', 'Steps']) {
		await today.getByRole('button', { name: 'Add measure', exact: true }).click();
		await today.getByRole('button', { name, exact: true }).click();
	}
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(today.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveValue('');
	await expect(today.getByRole('spinbutton', { name: 'Steps', exact: true })).toHaveValue('0');
	await expect(today.getByText('Items 0', { exact: true })).toBeVisible();
	await today.getByRole('button', { name: 'Add measure', exact: true }).click();
	for (const name of ['Nutrition', 'Weight', 'Steps'])
		await expect(today.getByRole('button', { name, exact: true })).toHaveCount(0);
	await today.getByRole('button', { name: 'Add measure', exact: true }).click();
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	const selected = page.getByRole('complementary', { name: 'Selected day', exact: true });
	await selected.getByRole('button', { name: 'Next day', exact: true }).click();
	await expect(selected.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveCount(0);
	await expect(selected.getByRole('heading', { name: 'Nutrition', exact: true })).toHaveCount(0);
	await page.getByRole('tab', { name: 'Measures', exact: true }).click();
	for (const name of ['Nutrition', 'Weight', 'Steps']) {
		const pin = page.getByRole('button', { name: 'Pin ' + name, exact: true });
		await expect(pin).toHaveAttribute('aria-pressed', 'false');
		await pin.click();
	}
	await page.screenshot({ path: testInfo.outputPath('pin-settings.png') });
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	await expect(selected.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveValue('');
	await expect(selected.getByRole('spinbutton', { name: 'Steps', exact: true })).toHaveValue('0');
	await expect(selected.getByText('Items 0', { exact: true })).toBeVisible();
	await page.getByRole('tab', { name: 'Measures', exact: true }).click();
	for (const name of ['Nutrition', 'Weight', 'Steps'])
		await page.getByRole('button', { name: 'Pin ' + name, exact: true }).click();
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	await expect(selected.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveCount(0);
	await expect(selected.getByRole('heading', { name: 'Nutrition', exact: true })).toHaveCount(0);
	await selected.getByRole('button', { name: 'Previous day', exact: true }).click();
	await expect(selected.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveValue('');
	await expect(selected.getByText('Items 0', { exact: true })).toBeVisible();
});
