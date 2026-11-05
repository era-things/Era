import { test, expect } from '@playwright/test';

test('nutrition rows support inline editing, persistence and quantity deletion', async ({
	page
}, testInfo) => {
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Measures', exact: true }).click();
	await page.getByRole('checkbox', { name: 'Nutrition', exact: true }).check();
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	await today.getByText('Items 0', { exact: true }).click();
	await today.getByRole('button', { name: 'Add item', exact: true }).click();
	const name = today.getByRole('textbox', { name: 'Name of new item', exact: true });
	await expect(name).toBeFocused();
	await name.fill('Lunch');
	await name.press('Enter');
	const kcal = today.getByRole('spinbutton', { name: 'kcal of Lunch', exact: true });
	await kcal.fill('100');
	await kcal.press('Tab');
	const protein = today.getByRole('spinbutton', { name: 'Protein of Lunch', exact: true });
	await protein.fill('12.5');
	await protein.press('Enter');
	await kcal.fill('999');
	await kcal.press('Escape');
	await expect(kcal).toHaveValue('100');
	await protein.fill('-1');
	await protein.press('Tab');
	await expect(protein).toHaveValue('12.5');
	const totals = today.locator('dl[aria-label="Day nutrition totals"]');
	await expect(totals).toContainText('100');
	const quantity = today.getByRole('button', { name: /Quantity of Lunch, currently/ });
	await quantity.click();
	await today.getByRole('button', { name: 'Increase quantity of Lunch', exact: true }).click();
	await expect(quantity).toHaveText('×2');
	await expect(kcal).toHaveValue('100');
	await expect(totals).toContainText('200');
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await today.getByText('Items 1', { exact: true }).click();
	await expect(kcal).toHaveValue('100');
	await expect(quantity).toHaveText('×2');
	await expect(today.getByRole('columnheader', { name: 'Protein', exact: true })).toBeVisible();
	await page.getByRole('tab', { name: 'Measures', exact: true }).click();
	await page.getByRole('checkbox', { name: 'Nutrition', exact: true }).uncheck();
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(today.getByRole('table', { name: 'Nutrition items' })).toHaveCount(0);
	await page.getByRole('tab', { name: 'Measures', exact: true }).click();
	await page.getByRole('checkbox', { name: 'Nutrition', exact: true }).check();
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	const selected = page.getByRole('complementary', { name: 'Selected day', exact: true });
	await selected.getByText('Items 1', { exact: true }).click();
	await expect(
		selected.getByRole('spinbutton', { name: 'kcal of Lunch', exact: true })
	).toHaveValue('100');
	await page.screenshot({ path: testInfo.outputPath('nutrition-grid.png') });
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await today.getByText('Items 1', { exact: true }).click();
	await quantity.click();
	await today.getByRole('button', { name: 'Decrease quantity of Lunch', exact: true }).click();
	await expect(quantity).toHaveText('×1');
	await expect(kcal).toHaveValue('100');
	await today.getByRole('button', { name: 'Remove Lunch', exact: true }).click();
	await expect(today.getByText('Items 0', { exact: true })).toBeVisible();
	await expect(totals).not.toContainText('100');
});
