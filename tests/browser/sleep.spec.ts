import { test, expect } from './fixtures';
import { localToday } from '../../src/lib/calendar';

test('sleep quality appears at the right edge only when reported', async ({ page, request }) => {
	const path = `/api/days/${localToday()}/widgets/sleep/automated`;
	const times = { startTime: '21:00', wakeUpTime: '08:00' };
	const report = async (score?: number) => {
		const response = await request.put(path, {
			data:
				score === undefined
					? times
					: {
							...times,
							metrics: { asleepMinutes: 600, awakeMinutes: 45, score }
						}
		});
		expect(response.status()).toBe(204);
		await page.goto('/today');
		await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	};
	const panel = page.getByRole('complementary', { name: 'Today', exact: true });
	const row = panel.getByRole('region', { name: 'Sleep', exact: true });
	const meter = row.getByRole('meter', { name: 'Sleep quality score' });
	await report(83);
	await expect(meter).toHaveText('83%');
	await report(100);
	await expect(meter).toHaveText('100%');
	await row.evaluate((element) => {
		element.style.width = '200px';
	});
	const bounds = (await row.boundingBox())!;
	const scoreBounds = (await meter.boundingBox())!;
	const wakeBounds = (await row
		.getByRole('textbox', { name: 'Sleep wake-up time' })
		.boundingBox())!;
	expect(bounds.height).toBe(26);
	expect(scoreBounds.x).toBeGreaterThanOrEqual(wakeBounds.x + wakeBounds.width);
	expect(scoreBounds.x + scoreBounds.width).toBe(bounds.x + bounds.width - 1);
	expect(await row.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(200);
	await report(0);
	await expect(meter).toHaveText('0%');
	await report();
	await expect(meter).toHaveCount(0);
	await expect(row).toHaveCSS('padding-inline-end', '7px');
	await expect(row).toHaveCSS('gap', '8px');
});

test('full-row sleep edits, pinning and records survive reload', async ({ page }) => {
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	await today.getByRole('button', { name: 'Add widget', exact: true }).click();
	await today.getByRole('button', { name: 'Sleep', exact: true }).click();
	const widget = today.getByRole('region', { name: 'Sleep', exact: true });
	const start = widget.getByRole('textbox', { name: 'Sleep start time' });
	const end = widget.getByRole('textbox', { name: 'Sleep wake-up time' });
	const hours = widget.getByRole('spinbutton', { name: 'Sleep hours' });
	const minutes = widget.getByRole('spinbutton', { name: 'Sleep minutes' });
	async function edit(field: typeof start, text: string) {
		await field.fill(text);
		await field.press('Tab');
	}
	await expect(start).toHaveValue('');
	await expect(hours).toHaveValue('7');
	await expect(minutes).toHaveValue('30');
	await edit(start, '2315');
	await expect(start).toHaveValue('23:15');
	await expect(end).toHaveValue('06:45');
	await edit(end, '700');
	await expect(end).toHaveValue('07:00');
	await expect(hours).toHaveValue('7');
	await expect(minutes).toHaveValue('45');
	const startBox = (await start.boundingBox())!;
	const endBox = (await end.boundingBox())!;
	const durationBox = (await widget.getByRole('group', { name: 'Sleep duration' }).boundingBox())!;
	expect(endBox.y).toBe(startBox.y);
	expect(endBox.x).toBeGreaterThan(startBox.x + startBox.width);
	expect(startBox.x).toBeGreaterThanOrEqual(durationBox.x + durationBox.width);
	expect(
		Math.abs(startBox.y + startBox.height / 2 - (durationBox.y + durationBox.height / 2))
	).toBeLessThan(1);
	expect((await widget.boundingBox())!.height).toBe(26);
	expect((await widget.boundingBox())!.width).toBe(
		(await today.locator('.day-widgets').boundingBox())!.width
	);
	expect(await widget.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
	for (const name of ['Weight', 'Steps']) {
		await today.getByRole('button', { name: 'Add widget', exact: true }).click();
		const choice = today.getByRole('button', { name, exact: true });
		if (await choice.count()) await choice.click();
		else await today.getByRole('button', { name: 'Add widget', exact: true }).click();
	}
	expect((await widget.boundingBox())!.width).toBe(
		(await today.locator('.day-widgets').boundingBox())!.width
	);
	await edit(hours, '8');
	await expect(end).toHaveValue('08:00');
	await edit(minutes, '15');
	await expect(end).toHaveValue('07:30');
	await edit(start, '22:15');
	await expect(hours).toHaveValue('9');
	await edit(end, '06:00');
	await expect(hours).toHaveValue('7');
	await expect(minutes).toHaveValue('45');
	await edit(start, '24:00');
	expect(await start.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
	await edit(start, '22:15');
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(start).toHaveValue('22:15');
	await expect(end).toHaveValue('06:00');
	await expect(hours).toHaveValue('7');
	await expect(minutes).toHaveValue('45');
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	const preview = page.getByRole('group', { name: 'Sleep appearance', exact: true });
	await expect(preview.getByText('Lunar seal', { exact: true })).toBeVisible();
	await preview.getByRole('button', { name: 'Next Sleep appearance' }).click();
	await expect(preview.getByText('Simple', { exact: true })).toBeVisible();
	await preview.getByRole('button', { name: 'Next Sleep appearance' }).click();
	await expect(preview.getByText('Lunar seal', { exact: true })).toBeVisible();
	const pin = page.getByRole('button', { name: 'Pin Sleep', exact: true });
	await pin.click();
	await expect(pin).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	const selected = page.getByRole('complementary', { name: 'Selected day', exact: true });
	await selected.getByRole('button', { name: 'Next day', exact: true }).click();
	await expect(selected.getByRole('region', { name: 'Sleep', exact: true })).toBeVisible();
	await expect(selected.getByRole('textbox', { name: 'Sleep start time' })).toHaveValue('');
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	await pin.click();
});
