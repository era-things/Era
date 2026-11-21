import { test, expect, widgetVisibility } from './fixtures';
import { localToday } from '../../src/lib/calendar';

test('switching to With data hides an empty Reading widget and preserves the attachment', async ({
	page,
	request
}) => {
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	const reading = today.getByRole('region', { name: 'Reading time', exact: true });
	await today.getByRole('button', { name: 'Add widget', exact: true }).click();
	await today.getByRole('button', { name: 'Reading time', exact: true }).click();
	await expect(reading).toBeVisible();

	const layout = page.getByRole('tab', { name: 'Layout', exact: true });
	const todayTab = page.getByRole('tab', { name: 'Today', exact: true });
	await layout.click();
	await widgetVisibility(page, 'Reading time').click();
	await expect(widgetVisibility(page, 'Reading time')).toHaveText('With data');
	await todayTab.click();
	await expect(reading).toHaveCount(0);

	const url = `/api/days/${localToday()}/widgets/reading`;
	await expect
		.poll(async () => (await (await request.get(url)).json()).visible)
		.toBe(false);
	expect(await (await request.get(url)).json()).toMatchObject({
		attached: true,
		value: { durationMinutes: 0 }
	});
	expect((await request.put(url, { data: { durationMinutes: 25 } })).ok()).toBe(true);
	await page.reload();
	await expect(reading).toBeVisible();
});

test('the visibility button cycles in place and hidden widgets can be restored', async ({ page }) => {
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	const tomorrow = page.getByRole('complementary', { name: 'Tomorrow', exact: true });
	const weight = today.getByRole('spinbutton', { name: 'Weight (kg)', exact: true });
	const tomorrowWeight = tomorrow.getByRole('spinbutton', { name: 'Weight (kg)', exact: true });
	await today.getByRole('button', { name: 'Add widget', exact: true }).click();
	await today.getByRole('button', { name: 'Weight', exact: true }).click();
	await weight.fill('72.5');

	const layout = page.getByRole('tab', { name: 'Layout', exact: true });
	const todayTab = page.getByRole('tab', { name: 'Today', exact: true });
	await layout.click();
	const appearance = page.getByRole('group', { name: 'Weight appearance', exact: true });
	await appearance.getByRole('button', { name: 'Next Weight appearance' }).click();
	const visibility = widgetVisibility(page, 'Weight');
	await expect(visibility).toHaveText('Available');
	await visibility.press('Enter');
	await expect(visibility).toHaveText('With data');
	await expect(visibility).toBeFocused();
	await todayTab.click();
	await expect(weight).toHaveValue('72.5');
	await expect(tomorrowWeight).toHaveCount(0);
	const add = tomorrow.getByRole('button', { name: 'Add widget', exact: true });
	await add.click();
	await expect(tomorrow.getByRole('button', { name: 'Weight', exact: true })).toHaveCount(0);

	await layout.click();
	await visibility.click();
	await expect(visibility).toHaveText('Pinned');
	await todayTab.click();
	await expect(tomorrowWeight).toBeVisible();
	await layout.click();
	await visibility.click();
	await expect(visibility).toHaveText('Available');
	await page.getByRole('button', { name: 'Hide Weight', exact: true }).click();

	const hidden = page.locator('.hidden-widgets');
	const summary = hidden.locator('summary');
	await expect(summary).toHaveText('Hidden widgets 1');
	await expect(summary).toBeFocused();
	await expect(hidden).not.toHaveAttribute('open', '');
	await expect(visibility).toHaveCount(0);
	await summary.press('Enter');
	await expect(hidden.getByRole('button', { name: 'Restore Weight', exact: true })).toBeVisible();

	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(hidden).not.toHaveAttribute('open', '');
	await todayTab.click();
	await expect(weight).toHaveCount(0);
	await expect(tomorrowWeight).toHaveCount(0);
	if ((await add.getAttribute('aria-expanded')) === 'false') await add.click();
	await expect(tomorrow.getByRole('button', { name: 'Weight', exact: true })).toHaveCount(0);

	await layout.click();
	await summary.click();
	await hidden.getByRole('button', { name: 'Restore Weight', exact: true }).click();
	await expect(hidden).toHaveCount(0);
	await expect(visibility).toBeFocused();
	await expect(visibility).toHaveText('Available');
	await expect(appearance.getByText('Display', { exact: true })).toBeVisible();
	await todayTab.click();
	await expect(weight).toHaveValue('72.5');
	if ((await add.getAttribute('aria-expanded')) === 'false') await add.click();
	await expect(tomorrow.getByRole('button', { name: 'Weight', exact: true })).toBeVisible();
});
