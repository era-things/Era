import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('Markdown notes render formatting, toggle tasks and export Markdown', async ({
	page,
	context
}, testInfo) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	const note = today.getByRole('textbox', { name: 'Notes', exact: true });
	await expect(note).toBeVisible();
	const markdown =
		'# Heading\n\n**Bold** and *italic* with [link](https://example.com)\n\n- [ ] Task\n\n```js\nconst x = 1;\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |';
	await page.evaluate((text) => navigator.clipboard.writeText(text), markdown);
	await note.click();
	await note.press('Control+V');
	await expect(note.locator('.sd-h1')).toHaveText('Heading');
	await expect(note.locator('.sd-strong')).toHaveText('Bold');
	await expect(note.locator('.sd-em')).toHaveText('italic');
	await expect(note.locator('.sd-link')).toHaveAttribute('data-href', 'https://example.com');
	await expect(note.locator('.sd-code-block').filter({ hasText: 'const x = 1;' })).toHaveCount(1);
	await expect(note.getByRole('table')).toHaveCount(0);
	await expect(note).toContainText('| A | B |');
	await note.getByRole('checkbox', { name: 'Mark task done' }).click();
	await expect(note.getByRole('checkbox', { name: 'Mark task open' })).toBeChecked();
	await page.getByRole('tab', { name: 'Settings', exact: true }).click();
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export data', exact: true }).click()
	]);
	const path = testInfo.outputPath('notes-export.json');
	await download.saveAs(path);
	const exported = JSON.parse(await readFile(path, 'utf8'));
	const saved = Object.values(exported.notes)[0] as string;
	expect(saved).toBe(markdown.replace('- [ ] Task', '- [x] Task'));
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(note.locator('.sd-h1')).toContainText('Heading');
	await expect(note.getByRole('checkbox', { name: 'Mark task open' })).toBeChecked();
	// Reveal syntax only on the current line, leaving other lines rendered.
	await note.press('Control+Home');
	await expect(note.locator('.sd-h1')).toHaveText('# Heading');
	await page.getByRole('tab', { name: 'Today', exact: true }).focus();
	await expect(note.locator('.sd-h1')).toHaveText('Heading');
	await note.focus();
	await expect(note.locator('.sd-h1')).toHaveText('# Heading');
	await note.press('ArrowDown');
	await expect(note.locator('.sd-h1')).toHaveText('Heading');
	await page.screenshot({ path: testInfo.outputPath('silkdown-notes.png') });
	await note.fill('Keyboard bold');
	await note.press('Control+a');
	await note.press('Control+b');
	await expect(note.locator('.sd-strong')).toHaveText('**Keyboard bold**');
	await note.press('Control+z');
	await expect(note).toHaveText('Keyboard bold');
	await note.press('Control+y');
	await expect(note.locator('.sd-strong')).toHaveText('**Keyboard bold**');
});

test('Lists render bullets and support continuation, nesting and exiting', async ({
	page
}, testInfo) => {
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const note = page
		.getByRole('complementary', { name: 'Today', exact: true })
		.getByRole('textbox', { name: 'Notes', exact: true });
	const saved = async () =>
		Object.values((await (await page.request.get('/api/calendar')).json()).notes)[0] ?? '';
	await note.fill('- First');
	await note.press('Control+End');
	await note.press('Enter');
	await note.pressSequentially('Second');
	await expect.poll(saved).toBe('- First\n- Second');
	await expect(note.locator('.sd-list-bullet')).toHaveCount(1);
	await note.press('Tab');
	await expect.poll(saved).toBe('- First\n  - Second');
	await note.press('Shift+Tab');
	await expect.poll(saved).toBe('- First\n- Second');
	await note.press('Enter');
	await note.press('Enter');
	await expect.poll(saved).toBe('- First\n- Second\n');
	await expect(note.locator('.sd-list-bullet')).toHaveCount(2);
	await note.fill('1. First');
	await note.press('Control+End');
	await note.press('Enter');
	await note.pressSequentially('Second');
	await expect.poll(saved).toBe('1. First\n2. Second');
	await note.fill('- First\n  * Nested\n+ Third\n\n- [ ] Task\n\n');
	await note.press('Control+End');
	await expect(note.locator('.sd-list-bullet')).toHaveCount(3);
	await expect(note.getByRole('checkbox', { name: 'Mark task done' })).toBeVisible();
	await note.press('Control+Home');
	await expect(note.locator('.sd-mark').first()).toHaveText('-');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(note.locator('.sd-list-bullet')).toHaveCount(3);
	await expect(note.locator('.sd-mark')).toHaveCount(0);
	await note.focus();
	await expect(note.locator('.sd-list-bullet')).toHaveCount(2);
	await expect(note.locator('.sd-mark').first()).toHaveText('-');
	await page.screenshot({ path: testInfo.outputPath('lists.png') });
});
