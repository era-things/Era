import { test, expect } from './fixtures';
import { emptyCalendar } from '../../src/lib/calendar-records';
import { localToday } from '../../src/lib/calendar';
import { serializeDataExport } from '../../src/lib/data-export';

test('Settings imports an Era backup and displays restored daily data', async ({ page }) => {
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
	data.notes[localToday()] = 'Restored from backup';

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
	await expect(settings.getByRole('status')).toHaveText('Data and settings imported.');
	await chooseFile(serializeDataExport(emptyCalendar()));
	await expect(settings.getByRole('alert')).toContainText('Import requires an empty database.');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	await expect(today.getByRole('textbox', { name: 'Notes', exact: true })).toContainText(
		'Restored from backup'
	);
});
