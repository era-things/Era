import { test, expect } from '@playwright/test';
import { emptyCalendar } from '../../src/lib/calendar-records';
import { writeData } from './api-helpers';

test('an HTTP agent can discover widgets, create a measure, and populate values visible in the app', async ({
	page,
	request
}) => {
	const before = await (await request.get('/api/data')).json();
	await writeData(request, before, emptyCalendar());
	expect((await request.get('/api/calendar')).status()).toBe(404);
	const definitions = await (await request.get('/api/widgets')).json();
	expect(definitions.widgets.some((item: { id: string }) => item.id === 'reading')).toBe(true);
	expect(
		(await request.patch('/api/widgets/reading', { data: { archived: false, pinned: true } })).ok()
	).toBe(true);
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const date = await page.evaluate(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	});
	const url = `/api/days/${date}/widgets/reading`;
	const crossSite = await request.delete(url, { headers: { origin: 'https://example.com' } });
	expect(crossSite.status()).toBe(403);
	expect((await crossSite.json()).error.code).toBe('cross_site_request');
	for (let i = 0; i < 2; i++)
		expect((await request.put(url, { data: { durationMinutes: 45 } })).ok()).toBe(true);
	const measure = { id: 'api-water', name: 'API water', type: 'uint', palette: 'blue' };
	expect((await request.post('/api/measures', { data: measure })).status()).toBe(201);
	expect(
		(await request.put(`/api/days/${date}/measures/api-water`, { data: { value: 4 } })).ok()
	).toBe(true);
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	await expect(
		today.getByRole('spinbutton', { name: 'Reading time minutes', exact: true })
	).toHaveValue('45');
	await expect(today.getByRole('spinbutton', { name: 'API water', exact: true })).toHaveValue('4');
	const seen: string[] = [];
	page.on('request', (req) => {
		if (req.method() !== 'GET' && req.url().includes('/api/'))
			seen.push(new URL(req.url()).pathname);
	});
	const hours = today.getByRole('spinbutton', { name: 'Reading time hours', exact: true });
	await hours.fill('1');
	await hours.press('Tab');
	await expect
		.poll(async () => (await (await request.get(url)).json()).value.durationMinutes)
		.toBe(105);
	expect(seen).toContain(url);
	expect(seen).not.toContain('/api/calendar');
	const error = await request.put(url, { data: { durationMinutes: -1 } });
	expect(error.status()).toBe(400);
	expect((await error.json()).error.field).toBe('durationMinutes');
	expect((await request.delete(`/api/days/${date}/measures/api-water`)).status()).toBe(204);
	expect((await request.delete('/api/measures/api-water')).status()).toBe(204);
	expect((await request.delete(url)).status()).toBe(204);
	await writeData(request, await (await request.get('/api/data')).json(), emptyCalendar());
});

test('a rejected edit refreshes state without blocking later UI writes', async ({
	page,
	request
}) => {
	await writeData(request, await (await request.get('/api/data')).json(), emptyCalendar());
	await request.patch('/api/widgets/gym', { data: { pinned: true } });
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	const hours = today.getByRole('spinbutton', { name: 'Gym time hours', exact: true });
	await expect(hours).toHaveValue('0');
	// An agent archives Gym after the browser read it, before it has a day entry.
	await request.patch('/api/widgets/gym', { data: { archived: true } });
	await hours.fill('1');
	await hours.press('Tab');
	await expect(page.getByRole('alert')).toContainText('Restore this widget');
	await expect(hours).toHaveCount(0);
	await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	await page.locator('.widget-catalog summary').click();
	await page.getByRole('button', { name: 'Star Gym time', exact: true }).click();
	await expect
		.poll(async () => (await (await request.get('/api/widgets/gym')).json()).settings.archived)
		.toBe(false);
	await writeData(request, await (await request.get('/api/data')).json(), emptyCalendar());
});
