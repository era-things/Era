import { writeData } from './api-helpers';
import { test, expect } from '@playwright/test';
import { emptyCalendar } from '../../src/lib/calendar-records';

test.afterEach(async ({ request }) => {
	const current = await (await request.get('/api/data')).json();
	await writeData(request, current, emptyCalendar());
});

test('catalog stars and archives persist, filter day choices, and preserve saved widgets', async ({
	page
}, testInfo) => {
	const before = await (await page.request.get('/api/data')).json();
	await writeData(page.request, before, emptyCalendar());
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	await today.getByRole('button', { name: 'Add widget', exact: true }).click();
	await today.getByRole('button', { name: 'Weight', exact: true }).click();
	await today.getByRole('spinbutton', { name: 'Weight (kg)', exact: true }).fill('72.5');
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	const catalog = page.locator('.widget-catalog');
	const normal = page.getByRole('region', { name: 'Widgets', exact: true });
	await expect(catalog).not.toHaveAttribute('open', '');
	await normal
		.getByRole('group', { name: 'Weight appearance', exact: true })
		.getByRole('button', { name: 'Next Weight appearance' })
		.click();
	await normal.getByRole('button', { name: 'Pin Weight', exact: true }).click();
	await normal.getByRole('button', { name: 'Archive Weight', exact: true }).click();
	await expect(normal.getByRole('button', { name: 'Pin Weight', exact: true })).toHaveCount(0);
	await expect(catalog.locator('summary')).toBeFocused();
	await catalog.locator('summary').press('Enter');
	await expect(catalog.getByRole('button', { name: 'Star Weight', exact: true })).toBeVisible();
	await expect(catalog.getByRole('button', { name: 'Pin Weight', exact: true })).toHaveCount(0);
	await expect(catalog.getByText('Display', { exact: true })).toBeVisible();
	// Move more than one card to exercise layout observers after dynamic insertion.
	await normal.getByRole('button', { name: 'Archive Steam game time', exact: true }).click();
	await expect(
		catalog.getByRole('button', { name: 'Star Steam game time', exact: true })
	).toBeVisible();
	const cards = catalog.locator('.built-in-row');
	await expect(cards).toHaveCount(2);
	await page.screenshot({ path: testInfo.outputPath('widget-catalog.png') });
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	await expect(catalog).not.toHaveAttribute('open', '');
	await expect(normal.getByRole('button', { name: 'Pin Weight', exact: true })).toHaveCount(0);
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(today.getByRole('spinbutton', { name: 'Weight (kg)', exact: true })).toHaveValue(
		'72.5'
	);
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	const selected = page.getByRole('complementary', { name: 'Selected day', exact: true });
	await selected.getByRole('button', { name: 'Next day', exact: true }).click();
	await expect(selected.getByRole('spinbutton', { name: 'Weight (kg)', exact: true })).toHaveCount(
		0
	);
	await selected.getByRole('button', { name: 'Add widget', exact: true }).click();
	await expect(selected.getByRole('button', { name: 'Weight', exact: true })).toHaveCount(0);
	await expect(selected.getByRole('button', { name: 'Steam game time', exact: true })).toHaveCount(
		0
	);
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	await catalog.locator('summary').click();
	await catalog.getByRole('button', { name: 'Star Weight', exact: true }).click();
	await expect(catalog.getByRole('button', { name: 'Star Weight', exact: true })).toHaveCount(0);
	await expect(normal.getByRole('button', { name: 'Pin Weight', exact: true })).toBeFocused();
	await expect(normal.getByRole('button', { name: 'Pin Weight', exact: true })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(normal.getByText('Display', { exact: true })).toBeVisible();
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	// The day menu may still be open from the earlier check.
	const add = selected.getByRole('button', { name: 'Add widget', exact: true });
	if ((await add.getAttribute('aria-expanded')) === 'false') await add.click();
	await expect(selected.getByRole('button', { name: 'Weight', exact: true })).toBeVisible();
	await selected.getByRole('button', { name: 'Weight', exact: true }).click();
	await expect(selected.getByRole('spinbutton', { name: 'Weight (kg)', exact: true })).toHaveValue(
		''
	);
});
