import { expect, test as base, type Page } from '@playwright/test';
import { emptyCalendar } from '../../src/lib/calendar-records';
import { seedData } from './api-helpers';
import { productionOrigins, usesDevServer } from './servers';

export { expect } from '@playwright/test';

export const test = base.extend<{ resetCalendar: void; timelineDays: number | 'full' }>({
	timelineDays: [100, { option: true }],
	baseURL: async ({ baseURL }, use, testInfo) => {
		const origin = usesDevServer ? baseURL : productionOrigins[testInfo.parallelIndex];
		if (!origin) throw new Error('No Era test server is configured for this worker.');
		await use(origin);
	},
	context: async ({ context, baseURL, timelineDays }, use) => {
		if (timelineDays !== 100) {
			await context.addCookies([
				{ name: 'era-verify-timeline', value: String(timelineDays), url: baseURL }
			]);
		}
		await use(context);
	},
	resetCalendar: [
		async ({ request }, use) => {
			await seedData(request, emptyCalendar());
			await use();
		},
		{ auto: true }
	]
});

export function widgetVisibility(page: Page, name: string) {
	return page.getByRole('button', { name: name + ' visibility:' });
}

export async function pinWidget(page: Page, name: string) {
	const visibility = widgetVisibility(page, name);
	await expect(visibility).toHaveText('Available');
	await visibility.click();
	await visibility.click();
	await expect(visibility).toHaveText('Pinned');
}
