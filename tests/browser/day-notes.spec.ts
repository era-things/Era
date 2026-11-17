import { writeData } from './api-helpers';
import { test, expect } from '@playwright/test';
import { setWidgetSettings } from '../../src/lib/widgets';

test('day notes save while typing, remain isolated and survive navigation and reload', async ({
	page
}) => {
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	const note = today.getByRole('textbox', { name: 'Notes', exact: true });
	const text = 'First line\nSecond line';
	await note.fill(text);
	await expect(
		page
			.getByRole('complementary', { name: 'Tomorrow', exact: true })
			.getByRole('textbox', { name: 'Notes', exact: true })
	).toHaveText('Note');
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	const selected = page.getByRole('complementary', { name: 'Selected day', exact: true });
	const selectedNote = selected.getByRole('textbox', { name: 'Notes', exact: true });
	await expect(selectedNote.locator('.cm-line')).toHaveText(['First line', 'Second line']);
	await selected.getByRole('button', { name: 'Next day', exact: true }).click();
	await expect(selectedNote).toHaveText('Note');
	await selected.getByRole('button', { name: 'Previous day', exact: true }).click();
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(selectedNote.locator('.cm-line')).toHaveText(['First line', 'Second line']);
	await selectedNote.fill('');
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(selectedNote).toHaveText('Note');
});

test('Layout configures Note pinning and empty day attachments', async ({ page }) => {
	const before = await (await page.request.get('/api/data')).json();
	const next = {
		...before,
		layout: setWidgetSettings(before.layout, 'note', { pinned: true }),
		notes: {}
	};
	await writeData(page.request, before, next);
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	const tomorrow = page.getByRole('complementary', { name: 'Tomorrow', exact: true });
	const yesterday = page.getByRole('complementary', { name: 'Yesterday', exact: true });
	await today.getByRole('textbox', { name: 'Notes', exact: true }).fill('Keep this note');
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	await expect(page.getByRole('tabpanel', { name: 'Layout', exact: true })).toBeVisible();
	await expect(page.getByRole('img', { name: 'Note appearance preview' })).toContainText(
		'A walk after lunch.'
	);
	const pin = page.getByRole('button', { name: 'Pin Note', exact: true });
	await expect(pin).toHaveAttribute('aria-pressed', 'true');
	await pin.click();
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(today.getByRole('textbox', { name: 'Notes', exact: true })).toHaveText(
		'Keep this note'
	);
	await expect(tomorrow.getByRole('textbox', { name: 'Notes', exact: true })).toHaveCount(0);
	await tomorrow.getByRole('button', { name: 'Add widget', exact: true }).click();
	await tomorrow.getByRole('button', { name: 'Note', exact: true }).click();
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(tomorrow.getByRole('textbox', { name: 'Notes', exact: true })).toHaveText('Note');
	await expect(yesterday.getByRole('textbox', { name: 'Notes', exact: true })).toHaveCount(0);
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	await expect(pin).toHaveAttribute('aria-pressed', 'false');
	await pin.click();
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(yesterday.getByRole('textbox', { name: 'Notes', exact: true })).toHaveText('Note');
	await expect(today.getByRole('textbox', { name: 'Notes', exact: true })).toHaveText(
		'Keep this note'
	);
});
