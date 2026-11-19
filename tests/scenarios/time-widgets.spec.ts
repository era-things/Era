import { expect, test } from '@playwright/test';
import { localToday } from '../../src/lib/calendar';
import { emptyCalendar } from '../../src/lib/calendar-records';
import { TIME_WIDGETS, setWidgetValue, widgetFor } from '../../src/lib/widgets';
import { seedData } from '../browser/api-helpers';

test('capture populated and empty time widgets on Today', async ({ page }, testInfo) => {
	const today = localToday();
	let data = setWidgetValue(emptyCalendar(), today, 'sleep', widgetFor('sleep').sample);
	for (const widget of TIME_WIDGETS) {
		data = setWidgetValue(data, today, widget.id, widget.id === 'gym' ? null : widget.sample);
	}
	await seedData(page.request, data);
	const sleepReport = await page.request.put(`/api/days/${today}/widgets/sleep/automated`, {
		data: {
			startTime: '23:15',
			wakeUpTime: '06:45',
			metrics: { asleepMinutes: 419, awakeMinutes: 21, score: 83 }
		}
	});
	expect(sleepReport.status()).toBe(204);
	const phoneReport = await page.request.put(`/api/days/${today}/widgets/phone/automated`, {
		data: {
			durationMinutes: 135,
			apps: [
				{ package: 'youtube', name: 'YouTube', minutes: 45 },
				{ package: 'chrome', name: 'Chrome', minutes: 35 },
				{ package: 'telegram', name: 'Telegram', minutes: 25 },
				{ package: 'maps', name: 'Maps', minutes: 20 },
				{ package: 'camera', name: 'Camera', minutes: 10 }
			]
		}
	});
	expect(phoneReport.status()).toBe(204);
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const panel = page.getByRole('complementary', { name: 'Today', exact: true });
	const block = panel.getByRole('group', { name: 'Hours in a day' });
	await expect(block.getByRole('region')).toHaveCount(TIME_WIDGETS.length + 1);
	await expect(block.getByRole('meter', { name: 'Sleep quality score' })).toHaveText('83%');
	const phone = block.getByRole('region', { name: 'Phone screen time', exact: true });
	const summary = phone.locator('summary');
	for (const [name, width] of [
		['desktop', 1280],
		['mobile', 390]
	] as const) {
		await page.setViewportSize({ width, height: 800 });
		const path = testInfo.outputPath(`time-widgets-${name}.png`);
		await panel.screenshot({ path, animations: 'disabled' });
		console.log(`Screenshot ${path}`);
		await summary.click();
		const drawer = testInfo.outputPath(`screen-time-drawer-${name}.png`);
		await panel.screenshot({ path: drawer, animations: 'disabled' });
		console.log(`Screenshot ${drawer}`);
		await summary.click();
	}
});
