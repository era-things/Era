import { test, expect } from './fixtures';
import { localToday } from '../../src/lib/calendar';
import { createReminder } from '../../src/lib/reminders';

test('saved edits refresh another tab and failed writes can be retried', async ({
	page,
	context,
	request
}) => {
	await request.patch('/api/widgets/reading', { data: { visibility: 'pinned' } });
	const other = await context.newPage();
	for (const tab of [page, other]) {
		await tab.goto('/today');
		await expect(tab.getByRole('main')).toHaveAttribute('aria-busy', 'false');
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
});

test('pushed updates preserve a draft for a different reminder', async ({ page, request }) => {
	const existing = createReminder('Existing reminder', localToday());
	expect((await request.put('/api/reminders/' + existing.id, { data: existing })).ok()).toBe(true);
	await page.goto('/reminders');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const reminders = page.getByRole('tabpanel', { name: 'Reminders' });
	await reminders.getByText(existing.text, { exact: true }).click();
	const draft = reminders.getByRole('textbox', { name: 'Text', exact: true });
	await draft.fill('Draft in progress');

	const added = createReminder('Added remotely', localToday());
	expect((await request.put('/api/reminders/' + added.id, { data: added })).ok()).toBe(true);
	await expect(reminders.getByText(added.text, { exact: true })).toBeVisible();
	await expect(draft).toHaveValue('Draft in progress');
});

test('live widgets highlight changes and animate their rows and drawers', async ({
	page,
	request
}) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	expect(
		(await request.patch('/api/widgets/reading', { data: { visibility: 'with-data' } })).ok()
	).toBe(true);
	expect(
		(await request.patch('/api/widgets/nutrition', { data: { visibility: 'pinned' } })).ok()
	).toBe(true);
	await page.goto('/today');
	const main = page.getByRole('main');
	await expect(main).toHaveAttribute('aria-busy', 'false');
	await main.evaluate((element) => {
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (keyframes, options) {
			const animation = animate.call(this, keyframes, options);
			if (animation.id) {
				const key = `${animation.id}:${this.getAttribute('aria-label')}`;
				element.dataset.effects = (element.dataset.effects ?? '') + `|${key}|`;
			}
			return animation;
		};
		for (const type of ['introend', 'outroend']) {
			element.addEventListener(
				type,
				(event) => {
					const target = event.target as Element;
					const name = target.matches('.time-widget-row')
						? 'time'
						: target.getAttribute('aria-label');
					element.dataset.motion = (element.dataset.motion ?? '') + `|${type}:${name}|`;
				},
				true
			);
		}
	});
	const day = `/api/days/${localToday()}/widgets`;
	const reading = `${day}/reading`;
	expect((await request.put(reading, { data: { durationMinutes: 25 } })).ok()).toBe(true);
	await expect(main).toHaveAttribute('data-motion', /\|introend:time\|/);
	expect((await request.put(reading, { data: { durationMinutes: 30 } })).ok()).toBe(true);
	await expect(main).toHaveAttribute('data-effects', /remote-value/);
	expect((await request.delete(reading)).ok()).toBe(true);
	await expect(main).toHaveAttribute('data-motion', /\|outroend:time\|/);

	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	await today.getByRole('button', { name: '0 items', exact: true }).click();
	await expect(main).toHaveAttribute('data-motion', /\|introend:null\|/);
	const items = `${day}/nutrition/items`;
	const food = { quantity: 1, kcal: 125, protein: 0, fat: 0, carbs: 0 };
	expect((await request.put(`${items}/meal`, { data: { ...food, name: 'Meal' } })).ok()).toBe(true);
	await expect(main).toHaveAttribute('data-motion', /\|introend:Nutrition items\|/);
	expect((await request.put(`${items}/snack`, { data: { ...food, name: 'Snack' } })).ok()).toBe(
		true
	);
	await expect(main).toHaveAttribute('data-motion', /\|introend:Snack\|/);
	await main.evaluate((element) => delete element.dataset.effects);
	expect((await request.delete(`${items}/meal`)).ok()).toBe(true);
	await expect(main).toHaveAttribute('data-motion', /\|outroend:Meal\|/);
	await expect(main).toHaveAttribute('data-effects', /\|widget-reflow:Snack\|/);
	expect((await request.delete(`${items}/snack`)).ok()).toBe(true);
	await expect(main).toHaveAttribute('data-motion', /\|outroend:Nutrition items\|/);

	const gitHub = `/api/days/${localToday()}/github-activity`;
	const totals = { commits: 1, additions: 20, deletions: 5 };
	expect(
		(
			await request.put(gitHub, { data: { ...totals, repositories: [{ ...totals, name: 'Era' }] } })
		).ok()
	).toBe(true);
	const gitHubWidget = today.getByRole('region', { name: 'GitHub activity' });
	const summary = gitHubWidget.locator('summary');
	const startsCollapsed = await summary.evaluate((element) => {
		const drawer = element.closest('details')!;
		const height = () => getComputedStyle(drawer, '::details-content').blockSize;
		const before = height();
		drawer.querySelector('summary')!.click();
		return drawer.open && before === '0px' && height() === '0px';
	});
	expect(startsCollapsed).toBe(true);
	await expect
		.poll(() =>
			summary.evaluate((element) =>
				parseFloat(getComputedStyle(element.closest('details')!, '::details-content').blockSize)
			)
		)
		.toBeGreaterThan(10);
	await summary.press('Enter');
	await expect(gitHubWidget.getByRole('list', { name: 'Updated repositories' })).toHaveCount(0);
});
