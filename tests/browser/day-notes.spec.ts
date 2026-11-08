import { test, expect } from '@playwright/test';

test('day notes save while typing, remain isolated and survive navigation and reload', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
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
