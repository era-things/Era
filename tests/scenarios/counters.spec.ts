import { expect, test } from '@playwright/test';
import { eraToday } from '../../src/lib/calendar';
import { emptyCalendar } from '../../src/lib/calendar-records';
import { setWidgetSettings, setWidgetValue, widgetFor } from '../../src/lib/widgets';
import { seedData } from '../browser/api-helpers';

test('capture compact counters and their appearance previews', async ({ page }, testInfo) => {
	const today = eraToday();
	let data = setWidgetValue(emptyCalendar(), today, 'nutrition', [
		...widgetFor('nutrition').sample
	]);
	data = setWidgetValue(data, today, 'weight', widgetFor('weight').sample);
	data = setWidgetValue(data, today, 'steps', widgetFor('steps').sample);
	data.layout = setWidgetSettings(data.layout, 'steps', { skin: 'pedometer' });
	await seedData(page.request, data);
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const panel = page.getByRole('complementary', { name: 'Today', exact: true });
	await expect(panel.getByRole('spinbutton', { name: 'Weight (kg)' })).toBeVisible();
	await expect(panel.getByRole('spinbutton', { name: 'Steps', exact: true })).toBeVisible();
	for (const [name, width] of [
		['desktop', 1280],
		['mobile', 390]
	] as const) {
		await page.setViewportSize({ width, height: 800 });
		const path = testInfo.outputPath(`counters-${name}.png`);
		await panel.screenshot({ path, animations: 'disabled' });
		console.log(`Screenshot ${path}`);
	}
	await page.goto('/layout');
	const layout = page.getByRole('tabpanel', { name: 'Layout', exact: true });
	await expect(layout.getByRole('img', { name: 'Weight appearance preview' })).toBeVisible();
	const path = testInfo.outputPath('counter-previews-mobile.png');
	await layout
		.getByRole('region', { name: 'Widgets', exact: true })
		.screenshot({ path, animations: 'disabled' });
	console.log(`Screenshot ${path}`);
});
