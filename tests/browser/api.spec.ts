import { test, expect } from './fixtures';
import { localToday } from '../../src/lib/calendar';

test('an HTTP agent can discover widgets, create a measure, and populate values visible in the app', async ({
	page,
	request
}) => {
	const definitions = await (await request.get('/api/widgets')).json();
	expect(definitions.widgets.some((item: { id: string }) => item.id === 'reading')).toBe(true);
	expect(
		(await request.patch('/api/widgets/reading', { data: { archived: false, pinned: true } })).ok()
	).toBe(true);
	const date = localToday();
	const url = `/api/days/${date}/widgets/reading`;
	const crossSite = await request.delete(url, { headers: { origin: 'https://example.com' } });
	expect(crossSite.status()).toBe(403);
	expect((await crossSite.json()).error.code).toBe('cross_site_request');
	expect((await request.put(url, { data: { durationMinutes: 45 } })).ok()).toBe(true);
	const measure = { id: 'api-water', name: 'API water', type: 'uint', palette: 'blue' };
	expect((await request.post('/api/measures', { data: measure })).status()).toBe(201);
	expect(
		(await request.put(`/api/days/${date}/measures/api-water`, { data: { value: 4 } })).ok()
	).toBe(true);
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
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
	expect((await request.delete(`/api/days/${date}/measures/api-water`)).status()).toBe(204);
	expect((await request.delete('/api/measures/api-water')).status()).toBe(204);
	expect((await request.delete(url)).status()).toBe(204);
});

test('a rejected edit refreshes state without blocking later UI writes', async ({
	page,
	request
}) => {
	await request.patch('/api/widgets/gym', { data: { pinned: true } });
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
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
});
