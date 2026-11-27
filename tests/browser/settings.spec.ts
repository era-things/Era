import { test, expect } from './fixtures';
import { emptyCalendar } from '../../src/lib/calendar-records';
import { addDays, eraToday } from '../../src/lib/calendar';
import { serializeDataExport } from '../../src/lib/data-export';
import { DEFAULT_TIMELINE_COLOR } from '../../src/lib/timeline-color';

test('the saved grid color alternates by year in Grid and Eras', async ({ page, request }) => {
	const today = '2026-02-12';
	await page.clock.setFixedTime(new Date(today + 'T12:00:00Z'));
	const priorYear = '2025-12-31';
	const currentYear = '2026-01-01';
	const yesterday = addDays(today, -1);
	const tomorrow = addDays(today, 1);
	const square = (date: string) => page.locator('#day-' + date);
	const background = (date: string) =>
		square(date).evaluate((element) => getComputedStyle(element).backgroundColor);

	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const original = await background(priorYear);
	const current = await background(currentYear);
	expect(current).not.toBe(original);
	expect(await background('2026-02-01')).toBe(current);
	await expect(square(yesterday)).toHaveCSS('border-top-width', '0px');
	await expect(square(today)).toHaveCSS('background-color', 'rgb(35, 105, 91)');
	await expect(square(tomorrow)).toHaveCSS('border-top-width', '1px');
	expect(await background(tomorrow)).not.toBe(await background(yesterday));

	await page.getByRole('tab', { name: 'Settings' }).click();
	const picker = page.getByLabel('Grid color');
	await expect(picker).toHaveValue(DEFAULT_TIMELINE_COLOR);
	await picker.fill('#406c99');
	await expect
		.poll(async () => (await (await request.get('/api/data')).json()).timelineColor)
		.toBe('#406c99');
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(picker).toHaveValue('#406c99');
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const updated = await background(priorYear);
	const alternate = await background(currentYear);
	expect(updated).not.toBe(original);
	expect(alternate).not.toBe(updated);
	await page.getByRole('tab', { name: 'Eras', exact: true }).click();
	await expect(square(priorYear)).toHaveCSS('background-color', updated);
	await expect(square(currentYear)).toHaveCSS('background-color', alternate);
	await expect(square(yesterday)).toHaveCSS('border-top-width', '0px');
	await expect(square(tomorrow)).toHaveCSS('border-top-width', '1px');

	await page.getByRole('tab', { name: 'Settings' }).click();
	await page.getByRole('button', { name: 'Reset grid color' }).click();
	await expect(picker).toHaveValue(DEFAULT_TIMELINE_COLOR);
	await expect
		.poll(async () => (await (await request.get('/api/data')).json()).timelineColor)
		.toBe(DEFAULT_TIMELINE_COLOR);
});

test('Settings previews an import and merges only the supplied daily values', async ({
	page,
	request
}) => {
	const day = eraToday();
	const widgets = `/api/days/${day}/widgets`;
	expect((await request.put(`${widgets}/steps/automated`, { data: { value: 100 } })).ok()).toBe(
		true
	);
	expect(
		(await request.put(`${widgets}/phone/automated`, { data: { durationMinutes: 120 } })).ok()
	).toBe(true);
	await page.goto('/settings');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const settings = page.getByRole('tabpanel', { name: 'Settings', exact: true });
	const importButton = settings.getByRole('button', { name: 'Import data', exact: true });
	const exportButton = settings.getByRole('button', { name: 'Export data', exact: true });
	const title = page.getByRole('heading', { name: 'Era', exact: true });
	await expect(exportButton).toBeVisible();
	await expect(importButton).toBeVisible();
	await expect(title).toBeVisible();
	for (const width of [1280, 390]) {
		await page.setViewportSize({ width, height: 800 });
		expect((await exportButton.boundingBox())?.x).toBe((await title.boundingBox())?.x);
		expect((await importButton.boundingBox())?.y).toBe((await exportButton.boundingBox())?.y);
	}
	const data = emptyCalendar();
	data.notes[day] = 'Restored from backup';
	data.automated[day] = { steps: 300 };

	async function chooseFile(contents: string) {
		const [chooser] = await Promise.all([page.waitForEvent('filechooser'), importButton.click()]);
		await chooser.setFiles({
			name: 'era-backup.json',
			mimeType: 'application/json',
			buffer: Buffer.from(contents)
		});
	}

	await chooseFile('invalid JSON');
	await expect(settings.getByRole('alert')).toContainText('not valid JSON');
	await chooseFile(serializeDataExport(data));
	const summary = settings.getByRole('group', { name: 'Import summary' });
	await expect(summary).toContainText(
		'Import data for 1 day. Existing values will be overwritten on 1 day.'
	);
	await summary.getByRole('button', { name: 'Cancel' }).click();
	await expect(summary).toHaveCount(0);
	expect((await (await request.get('/api/data')).json()).automated[day]).toEqual({
		steps: 100,
		phone: 120
	});
	await chooseFile(serializeDataExport(data));
	await summary.getByRole('button', { name: 'Confirm import' }).click();
	await expect(settings.getByRole('status')).toHaveText('Data imported.');
	expect((await (await request.get('/api/data')).json()).automated[day]).toEqual({
		steps: 300,
		phone: 120
	});
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	await expect(today.getByRole('textbox', { name: 'Notes', exact: true })).toContainText(
		'Restored from backup'
	);
});
