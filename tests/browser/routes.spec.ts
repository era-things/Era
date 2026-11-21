import { test, expect } from './fixtures';

const views = [
	['Grid', '/'],
	['Weekdays', '/weekdays'],
	['Today', '/today'],
	['Layout', '/layout'],
	['Reminders', '/reminders'],
	['Settings', '/settings']
] as const;

test('each view opens directly and Today survives reload at its own URL', async ({ page }) => {
	for (const [label, path] of views) {
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
		await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		if (label === 'Today') {
			await page.reload();
			await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
			await expect(page).toHaveURL(path);
			await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute(
				'aria-selected',
				'true'
			);
		}
		if (label === 'Grid') await expect(page.locator('.vertical-days')).toBeVisible();
		if (label === 'Weekdays') await expect(page.locator('.horizontal-days')).toBeVisible();
	}
	expect((await page.request.get('/unknown-view')).status()).toBe(404);
	expect((await page.request.get('/%74oday')).status()).toBe(200);
});

test('Today advances at 04:00 in an open tab', async ({ page }) => {
	await page.clock.install({ time: new Date('2027-01-01T00:55:00Z') });
	await page.clock.pauseAt(new Date('2027-01-01T00:59:59Z'));
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	await expect(today.locator('time')).toHaveAttribute('datetime', '2026-12-31');
	await page.clock.runFor(999);
	await expect(today.locator('time')).toHaveAttribute('datetime', '2026-12-31');
	await page.clock.runFor(1);
	await expect(today.locator('time')).toHaveAttribute('datetime', '2027-01-01');
});

test('tab links create history entries and keyboard navigation follows the URL', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	for (const [label, path] of views.slice(2)) {
		const tab = page.getByRole('tab', { name: label, exact: true });
		await expect(tab).toHaveAttribute('href', path);
		await tab.click();
		await expect(page).toHaveURL(path);
		await expect(tab).toHaveAttribute('aria-selected', 'true');
	}
	await page.goBack();
	await expect(page).toHaveURL('/reminders');
	await expect(page.getByRole('tab', { name: 'Reminders', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await page.goForward();
	await expect(page).toHaveURL('/settings');
	const settings = page.getByRole('tab', { name: 'Settings', exact: true });
	await settings.focus();
	await settings.press('Home');
	await expect(page).toHaveURL('/weekdays');
	await expect(page.getByRole('tab', { name: 'Weekdays', exact: true })).toBeFocused();
	await page.getByRole('tab', { name: 'Weekdays', exact: true }).press('End');
	await expect(page).toHaveURL('/settings');
	const historyLength = await page.evaluate(() => history.length);
	await settings.click();
	expect(await page.evaluate(() => history.length)).toBe(historyLength);
});
