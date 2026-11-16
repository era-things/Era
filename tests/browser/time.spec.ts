import { test, expect } from '@playwright/test';
import { changes, emptyCalendar } from '../../src/lib/calendar-records';

test('time widgets form one block, edit and persist, and support pinning per activity', async ({
	page
}, testInfo) => {
	const before = await (await page.request.get('/api/calendar')).json();
	expect(
		(await page.request.post('/api/calendar', { data: changes(before, emptyCalendar()) })).ok()
	).toBe(true);
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	const names = ['Phone screen time', 'Gym time', 'Reading time', 'Movie time', 'Steam game time'];
	for (const name of ['Sleep', ...names, 'Weight', 'Steps']) {
		await today.getByRole('button', { name: 'Add widget', exact: true }).click();
		await today.getByRole('button', { name, exact: true }).click();
	}
	const block = today.getByRole('group', { name: 'Hours in a day', exact: true });
	await expect(block.getByRole('region')).toHaveCount(6);
	await expect(block.getByRole('button')).toHaveCount(0);
	for (const [index, name] of names.entries()) {
		const row = block.getByRole('region', { name, exact: true });
		const hours = row.getByRole('spinbutton', { name: name + ' hours', exact: true });
		const minutes = row.getByRole('spinbutton', { name: name + ' minutes', exact: true });
		await expect(hours).toHaveValue('0');
		await expect(minutes).toHaveValue('00');
		await hours.fill(String(index + 1));
		await hours.press('Tab');
		await minutes.fill('15');
		await minutes.press('Enter');
		await expect(minutes).toHaveValue('15');
		await expect(row.locator('svg')).toBeVisible();
		if (index === 0) {
			await hours.fill('24');
			await hours.press('Tab');
			expect(await hours.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
			await hours.fill('1');
			await hours.press('Tab');
		}
	}
	const gymHours = block.getByRole('spinbutton', { name: 'Gym time hours', exact: true });
	await gymHours.fill('');
	await gymHours.press('Tab');
	await expect(
		block.getByRole('spinbutton', { name: 'Gym time minutes', exact: true })
	).toHaveValue('');
	for (const width of [200, 240, 360]) {
		await block.evaluate((el, width) => {
			el.style.flexBasis = `${width}px`;
			el.style.width = `${width}px`;
		}, width);
		const rows = await block.getByRole('region').all();
		let bottom: number | undefined;
		for (const row of rows) {
			const bounds = (await row.boundingBox())!;
			expect(bounds.height).toBe(26);
			expect(bounds.width).toBe(width);
			if (bottom !== undefined) expect(bounds.y).toBe(bottom);
			bottom = bounds.y + bounds.height;
			expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
		}
	}
	await block.evaluate((el) => {
		el.style.removeProperty('width');
		el.style.removeProperty('flex-basis');
	});
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	for (const [index, name] of names.entries()) {
		await expect(block.getByRole('spinbutton', { name: name + ' hours', exact: true })).toHaveValue(
			index === 1 ? '' : String(index + 1)
		);
		await expect(
			block.getByRole('spinbutton', { name: name + ' minutes', exact: true })
		).toHaveValue(index === 1 ? '' : '15');
	}
	await page.screenshot({ path: testInfo.outputPath('time-widgets.png') });
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	for (const name of names)
		await expect(
			page.getByRole('group', { name: name + ' appearance', exact: true })
		).toBeVisible();
	await page.getByRole('button', { name: 'Pin Steam game time', exact: true }).click();
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	const selected = page.getByRole('complementary', { name: 'Selected day', exact: true });
	await selected.getByRole('button', { name: 'Next day', exact: true }).click();
	await expect(
		selected.getByRole('region', { name: 'Steam game time', exact: true })
	).toBeVisible();
	await expect(
		selected.getByRole('spinbutton', { name: 'Steam game time hours', exact: true })
	).toHaveValue('0');
	await expect(
		selected.getByRole('region', { name: 'Phone screen time', exact: true })
	).toHaveCount(0);
	await selected.getByRole('button', { name: 'Previous day', exact: true }).click();
	await expect(
		selected.getByRole('spinbutton', { name: 'Steam game time hours', exact: true })
	).toHaveValue('5');
});
