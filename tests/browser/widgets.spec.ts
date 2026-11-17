import { test, expect } from './fixtures';

test('custom measures share the day add menu and preserve numeric and boolean editing', async ({
	page
}) => {
	await page.goto('/layout');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	for (const [name, type] of [
		['Test water', 'uint'],
		['Test reading', 'boolean']
	]) {
		await page.getByRole('button', { name: '+ New measure', exact: true }).click();
		await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
		await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption(type);
		await page.getByRole('button', { name: 'Create measure', exact: true }).click();
	}
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	for (const name of ['Test water', 'Test reading']) {
		await today.getByRole('button', { name: 'Add widget', exact: true }).click();
		await today.getByRole('button', { name, exact: true }).click();
	}
	const water = today.getByRole('spinbutton', { name: 'Test water', exact: true });
	const reading = today.getByRole('checkbox', { name: 'Test reading', exact: true });
	await expect(water).toHaveValue('0');
	await water.fill('4');
	await today.getByRole('button', { name: 'Increase Test water', exact: true }).click();
	await expect(water).toHaveValue('5');
	await today.getByRole('button', { name: 'Decrease Test water', exact: true }).click();
	await expect(water).toHaveValue('4');
	await reading.check();
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(water).toHaveValue('4');
	await expect(reading).toBeChecked();
	await water.fill('');
	await expect(water).toHaveValue('');
	await today.getByRole('button', { name: 'Remove Test water from day', exact: true }).click();
	await expect(water).toHaveCount(0);
	await expect(reading).toBeChecked();
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	for (const name of ['Test water', 'Test reading']) {
		await page.getByRole('button', { name: 'Delete ' + name, exact: true }).click();
		await page.getByRole('button', { name: 'Delete measure', exact: true }).click();
	}
});
