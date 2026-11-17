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
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const panel = page.getByRole('complementary', { name: 'Today', exact: true });
	const block = panel.getByRole('group', { name: 'Hours in a day' });
	await expect(block.getByRole('region')).toHaveCount(TIME_WIDGETS.length + 1);
	for (const [name, width] of [
		['desktop', 1280],
		['mobile', 390]
	] as const) {
		await page.setViewportSize({ width, height: 800 });
		const path = testInfo.outputPath(`time-widgets-${name}.png`);
		await panel.screenshot({ path, animations: 'disabled' });
		console.log(`Screenshot ${path}`);
	}
});
