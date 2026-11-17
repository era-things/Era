import { test, expect } from '@playwright/test';
import { emptyCalendar } from '../../src/lib/calendar-records';
import { writeData } from './api-helpers';

test('saved edits refresh another tab and failed writes can be retried', async ({
	page,
	context,
	request
}) => {
	await writeData(request, await (await request.get('/api/data')).json(), emptyCalendar());
	await request.patch('/api/widgets/reading', { data: { pinned: true } });
	const other = await context.newPage();
	for (const tab of [page, other]) {
		await tab.goto('/');
		await expect(tab.getByRole('main')).toHaveAttribute('aria-busy', 'false');
		await tab.getByRole('tab', { name: 'Today', exact: true }).click();
	}
	const minutes = (tab: typeof page) =>
		tab
			.getByRole('complementary', { name: 'Today', exact: true })
			.getByRole('spinbutton', { name: 'Reading time minutes', exact: true });
	await minutes(page).fill('25');
	await minutes(page).press('Tab');
	await expect(minutes(other)).toHaveValue('25');

	let failNextWrite = true;
	await other.route('**/api/days/*/widgets/reading', async (route) => {
		if (route.request().method() === 'PUT' && failNextWrite) {
			failNextWrite = false;
			await route.fulfill({ status: 503, json: { error: { message: 'Temporary save failure' } } });
		} else await route.continue();
	});
	await minutes(other).fill('40');
	await minutes(other).press('Tab');
	await expect(other.getByRole('alert')).toContainText('Temporary save failure');
	await other.getByRole('button', { name: 'Retry', exact: true }).click();
	await expect(other.getByRole('alert')).toHaveCount(0);
	await expect(minutes(page)).toHaveValue('40');
	await other.close();
	await writeData(request, await (await request.get('/api/data')).json(), emptyCalendar());
});
