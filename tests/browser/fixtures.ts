import { test as base } from '@playwright/test';
import { emptyCalendar } from '../../src/lib/calendar-records';
import { seedData } from './api-helpers';
import { productionOrigins, usesDevServer } from './servers';

export { expect } from '@playwright/test';

export const test = base.extend<{ resetCalendar: void }>({
	baseURL: async ({ baseURL }, use, testInfo) => {
		const origin = usesDevServer ? baseURL : productionOrigins[testInfo.parallelIndex];
		if (!origin) throw new Error('No Era test server is configured for this worker.');
		await use(origin);
	},
	resetCalendar: [
		async ({ request }, use) => {
			await seedData(request, emptyCalendar());
			await use();
		},
		{ auto: true }
	]
});
