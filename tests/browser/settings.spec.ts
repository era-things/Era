import { test, expect } from './fixtures';
import { emptyCalendar } from '../../src/lib/calendar-records';
import { eraToday } from '../../src/lib/calendar';
import { serializeDataExport } from '../../src/lib/data-export';

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
