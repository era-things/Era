import { test, expect } from './fixtures';
import { localToday } from '../../src/lib/calendar';
import { emptyCalendar } from '../../src/lib/calendar-records';
import { TIME_WIDGETS, setWidgetValue } from '../../src/lib/widgets';
import { seedData } from './api-helpers';

test('screen time shows the app name or opens a usage-share drawer', async ({ page, request }) => {
	const path = `/api/days/${localToday()}/widgets/phone/automated`;
	const youTube = { package: 'com.youtube', name: 'YouTube', minutes: 45 };
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	const phone = today.getByRole('region', { name: 'Phone screen time', exact: true });
	const total = phone.getByRole('group', { name: 'Phone screen time duration' });
	const summary = phone.locator('summary');
	const drawer = phone.getByRole('list', { name: 'Screen time by app' });
	const minutes = total.getByRole('spinbutton', { name: 'Phone screen time minutes' });

	async function report(apps?: { package: string; name: string; minutes: number }[]) {
		const response = await request.put(path, {
			data: { durationMinutes: 135, ...(apps === undefined ? {} : { apps }) }
		});
		expect(response.status()).toBe(204);
		await page.goto('/today');
		await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	}

	await report();
	await expect(minutes).toHaveValue('15');
	await expect(summary).toHaveCount(0);
	await expect(phone.locator('.app-summary')).toHaveCount(0);

	await report([youTube]);
	await expect(minutes).toHaveValue('15');
	await expect(phone.locator('.app-summary')).toHaveText('YouTube');
	await expect(summary).toHaveCount(0);

	await report([
		{ package: 'com.chrome', name: 'Chrome', minutes: 35 },
		youTube,
		{ package: 'com.telegram', name: 'Telegram', minutes: 25 },
		{ package: 'com.maps', name: 'Maps', minutes: 20 },
		{ package: 'com.camera', name: 'Camera', minutes: 10 }
	]);
	await page.setViewportSize({ width: 390, height: 800 });
	await expect(summary).toContainText(/YouTube\s*33%/);
	await expect(total).toHaveText(/2h\s*15m/);
	await expect(drawer).toHaveCount(0);
	expect((await summary.boundingBox())?.height).toBe(26);
	await summary.press('Enter');
	await expect(drawer.getByRole('listitem')).toHaveCount(5);
	await expect(drawer.getByRole('listitem').first()).toHaveText(/YouTube\s*45m\s*33%/);
	await summary.click();
	await expect(drawer).toHaveCount(0);

	await report([]);
	await expect(summary).toHaveCount(0);
	await expect(phone.locator('.app-summary')).toHaveCount(0);
});

test('time widgets form one block, edit and persist, and support pinning per activity', async ({
	page
}) => {
	const date = localToday();
	let data = setWidgetValue(emptyCalendar(), date, 'sleep', {
		start: 1395,
		end: 405,
		duration: 450
	});
	data = setWidgetValue(data, date, 'weight', 72.5);
	data = setWidgetValue(data, date, 'steps', 8200);
	for (const widget of TIME_WIDGETS) {
		if (widget.id !== 'steam') data = setWidgetValue(data, date, widget.id, widget.sample);
	}
	await seedData(page.request, data);
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	await today.getByRole('button', { name: 'Add widget', exact: true }).click();
	await today.getByRole('button', { name: 'Steam game time', exact: true }).click();

	const steam = (panel: typeof today) =>
		panel.getByRole('region', { name: 'Steam game time', exact: true });
	const hours = steam(today).getByRole('spinbutton', {
		name: 'Steam game time hours',
		exact: true
	});
	const minutes = steam(today).getByRole('spinbutton', {
		name: 'Steam game time minutes',
		exact: true
	});
	await expect(hours).toHaveValue('0');
	await expect(minutes).toHaveValue('00');
	await hours.fill('5');
	await hours.press('Tab');
	await minutes.fill('15');
	await minutes.press('Enter');
	await hours.fill('24');
	await hours.press('Tab');
	expect(await hours.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
	await hours.fill('5');
	await hours.press('Tab');

	const block = today.getByRole('group', { name: 'Hours in a day', exact: true });
	const rows = block.getByRole('region');
	await expect(rows).toHaveCount(TIME_WIDGETS.length + 1);
	await expect(block.getByRole('button')).toHaveCount(0);
	for (const width of [200, 240, 360]) {
		await block.evaluate((el, width) => {
			el.style.flexBasis = `${width}px`;
			el.style.width = `${width}px`;
		}, width);
		const layout = await rows.evaluateAll((elements) =>
			elements.map((el) => {
				const { top, bottom, height, width } = el.getBoundingClientRect();
				return { top, bottom, height, width, overflow: el.scrollWidth > el.clientWidth };
			})
		);
		for (const [index, row] of layout.entries()) {
			expect(row.height).toBe(26);
			expect(row.width).toBe(width);
			expect(row.overflow).toBe(false);
			if (index > 0) expect(row.top).toBe(layout[index - 1].bottom);
		}
	}

	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(hours).toHaveValue('5');
	await expect(minutes).toHaveValue('15');

	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	await page.getByRole('button', { name: 'Pin Steam game time', exact: true }).click();
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	const selected = page.getByRole('complementary', { name: 'Selected day', exact: true });
	await selected.getByRole('button', { name: 'Next day', exact: true }).click();
	await expect(
		steam(selected).getByRole('spinbutton', { name: 'Steam game time hours', exact: true })
	).toHaveValue('0');
	await expect(
		selected.getByRole('region', { name: 'Phone screen time', exact: true })
	).toHaveCount(0);
});
