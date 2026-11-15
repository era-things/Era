import { changes } from '../../src/lib/calendar-records';
import { test, expect } from '@playwright/test';

test('nutrition rows support inline editing, persistence and quantity deletion', async ({
	page
}, testInfo) => {
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Measures', exact: true }).click();
	await page.getByRole('button', { name: 'Pin Nutrition', exact: true, pressed: false }).click();
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
	const controls = today.getByRole('group', { name: 'Quantity controls for Lunch' });
	await expect(controls).toBeVisible();
	await totals.click();
	await expect(controls).toHaveCount(0);
	await expect(quantity).toHaveAttribute('aria-expanded', 'false');
	await quantity.click();
	await quantity.press('Tab');
	await expect(
		today.getByRole('button', { name: 'Decrease quantity of Lunch', exact: true })
	).toBeFocused();
	await expect(controls).toBeVisible();
	await page.keyboard.press('Tab');
	await expect(
		today.getByRole('button', { name: 'Increase quantity of Lunch', exact: true })
	).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(today.getByRole('textbox', { name: 'Name of Lunch', exact: true })).toBeFocused();
	await expect(controls).toHaveCount(0);
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await today.getByText('Items 1', { exact: true }).click();
	await expect(kcal).toHaveValue('100');
	await expect(quantity).toHaveText('×2');
	await expect(today.getByRole('columnheader', { name: 'Protein', exact: true })).toBeVisible();
	await page.getByRole('tab', { name: 'Measures', exact: true }).click();
	await page.getByRole('button', { name: 'Pin Nutrition', exact: true, pressed: true }).click();
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(today.getByText('Items 1', { exact: true })).toBeVisible();
	await page.getByRole('tab', { name: 'Measures', exact: true }).click();
	await page.getByRole('button', { name: 'Pin Nutrition', exact: true, pressed: false }).click();
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

test('copy a previous nutrition item with fresh identity and quantity one', async ({
	page
}, testInfo) => {
	{
		const key = (offset: number) => {
			const date = new Date();
			date.setDate(date.getDate() + offset);
			return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
		};
		const item = {
			id: 'source',
			name: 'Porridge',
			quantity: 3,
			kcal: 250,
			protein: 12,
			fat: 6,
			carbs: 35
		};
		const before = await (await page.request.get('/api/calendar')).json();
		const next = {
			...before,
			nutrition: {
				pinned: true,
				days: {
					[key(-2)]: [{ ...item, id: 'older', quantity: 2 }],
					[key(-1)]: [item],
					[key(1)]: [{ ...item, id: 'future', name: 'Future food' }]
				}
			}
		};
		expect((await page.request.post('/api/calendar', { data: changes(before, next) })).ok()).toBe(
			true
		);
	}
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	await today.getByText('Items 0', { exact: true }).click();
	const history = today.getByRole('button', { name: 'Add previous item', exact: true });
	await history.click();
	const menu = today.getByRole('dialog', { name: 'Previous nutrition items' });
	await expect(menu.getByRole('button')).toHaveCount(1);
	await page.screenshot({ path: testInfo.outputPath('nutrition-history.png') });
	const search = menu.getByRole('searchbox', { name: 'Find previous item' });
	await search.fill('other');
	await expect(menu).toContainText('No matching items');
	await search.fill('porr');
	await menu.getByRole('button', { name: /Porridge/ }).click();
	await expect(menu).toHaveCount(0);
	await expect(
		today.getByRole('button', { name: 'Quantity of Porridge, currently 1', exact: true })
	).toBeVisible();
	for (const [label, value] of [
		['kcal', '250'],
		['Protein', '12'],
		['Fat', '6'],
		['Carbs', '35']
	]) {
		await expect(
			today.getByRole('spinbutton', { name: `${label} of Porridge`, exact: true })
		).toHaveValue(value);
	}
	const days = (await (await page.request.get('/api/calendar')).json()).nutrition.days;
	const copied = Object.values(days)
		.flat()
		.find(
			(item: any) => item.id !== 'source' && item.id !== 'older' && item.id !== 'future'
		) as any;
	expect(copied.quantity).toBe(1);
	expect(days[Object.keys(days).sort()[1]][0].quantity).toBe(3);
	await history.click();
	await today.getByRole('heading', { name: 'Nutrition', exact: true }).click();
	await expect(menu).toHaveCount(0);
	await history.click();
	await search.press('Escape');
	await expect(menu).toHaveCount(0);
	await expect(history).toBeFocused();
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await today.getByText('Items 1', { exact: true }).click();
	await expect(
		today.getByRole('spinbutton', { name: 'kcal of Porridge', exact: true })
	).toHaveValue('250');
});
