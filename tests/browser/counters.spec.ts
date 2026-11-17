import { test, expect } from './fixtures';

test('built-in weight and steps share a row, persist, and retain values when unpinned', async ({
	page
}) => {
	await page.goto('/layout');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	for (const name of ['Nutrition', 'Weight', 'Steps'])
		await page.getByRole('button', { name: 'Pin ' + name, exact: true }).click();
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	const weight = today.getByRole('spinbutton', { name: 'Weight (kg)', exact: true });
	const steps = today.getByRole('spinbutton', { name: 'Steps', exact: true });
	await weight.fill('72.65');
	await steps.fill('8200');
	await steps.fill('1.5');
	expect(await steps.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
	await steps.fill('8200');
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(weight).toHaveValue('72.65');
	await expect(steps).toHaveValue('8200');
	for (const width of [1280, 390]) {
		await page.setViewportSize({ width, height: 800 });
		const cards = today.locator('.counter-widget');
		const a = await cards.nth(0).boundingBox();
		const b = await cards.nth(1).boundingBox();
		const nutrition = await today.locator('.full-widget').boundingBox();
		expect(a!.y).toBe(b!.y);
		expect(a!.height).toBe(b!.height);
		expect(a!.x + a!.width).toBeLessThan(b!.x);
		expect(nutrition!.width).toBeGreaterThan(a!.width);
		expect(nutrition!.y + nutrition!.height).toBeLessThanOrEqual(a!.y);
		expect(await today.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
	}
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	const preview = page.getByRole('img', { name: 'Weight appearance preview' });
	const previousSkin = page.getByRole('button', { name: 'Previous Weight appearance' });
	const nextSkin = page.getByRole('button', { name: 'Next Weight appearance' });
	const previewBounds = await preview.boundingBox();
	const previousBounds = await previousSkin.boundingBox();
	const nextBounds = await nextSkin.boundingBox();
	expect(previousBounds!.y).toBeGreaterThanOrEqual(previewBounds!.y + previewBounds!.height);
	expect(previousBounds!.y).toBe(nextBounds!.y);
	await expect(preview.locator('.weight-scale')).toHaveCount(1);
	await expect(page.getByRole('img', { name: 'Nutrition appearance preview' })).toContainText(
		'1,850'
	);
	await expect(
		page.getByRole('img', { name: 'Steps appearance preview' }).locator('input')
	).toHaveValue('8200');
	await expect(preview.locator('[inert]')).toHaveCount(1);
	const outgoingSlide = await preview.locator('.preview-slide').elementHandle();
	await page.getByRole('button', { name: 'Previous Weight appearance' }).click();
	const exitPosition = await outgoingSlide!.evaluate((slide) => {
		const animation = slide.getAnimations()[0];
		if (!animation) throw new Error('Expected the outgoing skin to animate');
		animation.pause();
		animation.currentTime = Number(animation.effect!.getTiming().duration) * 0.99;
		const widget = slide.querySelector('.counter-widget')!.getBoundingClientRect();
		const stage = slide.closest('.preview-stage')!.getBoundingClientRect();
		const result = {
			left: widget.left,
			right: widget.right,
			stageLeft: stage.left,
			stageRight: stage.right
		};
		animation.finish();
		return result;
	});
	expect(
		exitPosition.left >= exitPosition.stageRight || exitPosition.right <= exitPosition.stageLeft
	).toBe(true);
	await expect(preview.locator('.weight-scale')).toHaveCount(0);
	await expect(preview.locator('svg')).toBeVisible();
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(page.getByRole('group', { name: 'Weight appearance', exact: true })).toContainText(
		'Simple'
	);
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(today.locator('.weight-scale')).toHaveCount(0);
	await expect(weight.locator('..').locator('..').locator('svg')).toBeVisible();
	await expect(weight).toHaveValue('72.65');
	await expect(steps).toHaveValue('8200');
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	await page.getByRole('button', { name: 'Next Weight appearance' }).click();
	await expect(preview.locator('.weight-scale')).toHaveCount(1);
	await nextSkin.click();
	await expect(preview.locator('.weight-display')).toHaveCount(1);
	await expect(preview.locator('.weight-scale')).toHaveCount(0);
	await expect(preview.locator('input')).toHaveValue('72.5');
	await page.getByRole('button', { name: 'Next Steps appearance' }).click();
	const stepsPreview = page.getByRole('img', { name: 'Steps appearance preview' });
	await expect(stepsPreview.locator('.steps-pedometer')).toHaveCount(1);
	await expect(stepsPreview.locator('.steps-pedometer svg')).toHaveCSS(
		'color',
		'rgb(224, 231, 227)'
	);
	await expect(stepsPreview.locator('.preview-slide')).toHaveCount(1);
	await expect(stepsPreview.locator('input')).toHaveValue('8200');
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(today.locator('.weight-display')).toHaveCount(1);
	await expect(today.locator('.steps-pedometer')).toHaveCount(1);
	await expect(steps).toHaveValue('8200');
	expect((await today.locator('.steps-pedometer').boundingBox())!.height).toBe(52);
	await steps.focus();
	await expect(steps).toHaveCSS('outline-style', 'none');
	await expect(today.locator('.steps-pedometer .counter-readout')).toHaveCSS(
		'outline-width',
		'2px'
	);
	await steps.fill('1.5');
	await expect(today.locator('.steps-pedometer .counter-readout')).toHaveCSS(
		'outline-color',
		'rgb(160, 45, 45)'
	);
	await steps.fill('8200');
	await expect(weight).toHaveValue('72.65');
	expect((await today.locator('.weight-display').boundingBox())!.height).toBe(52);
	await weight.focus();
	await expect(weight).toHaveCSS('outline-style', 'none');
	await expect(today.locator('.weight-display')).toHaveCSS('outline-width', '2px');
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	await previousSkin.click();
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(today.locator('.weight-scale')).toHaveCount(1);
	await expect(weight).toHaveValue('72.65');
	await weight.focus();
	await expect(weight).toHaveCSS('outline-style', 'none');
	await expect(today.locator('.weight-scale .counter-readout')).toHaveCSS('outline-width', '2px');
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	await page.getByRole('button', { name: 'Pin Weight', exact: true, pressed: true }).click();
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(weight).toHaveValue('72.65');
	await expect(steps).toHaveValue('8200');
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	await page.getByRole('button', { name: 'Pin Weight', exact: true, pressed: false }).click();
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	const selected = page.getByRole('complementary', { name: 'Selected day', exact: true });
	await expect(selected.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveValue('72.65');
	await selected.getByRole('spinbutton', { name: 'Weight (kg)' }).fill('');
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(weight).toHaveValue('');
	await expect(steps).toHaveValue('8200');
});

test('unpinned built-ins are added per day and pinned ones appear on empty days', async ({
	page
}) => {
	await page.goto('/today');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const today = page.getByRole('complementary', { name: 'Today', exact: true });
	await expect(today.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveCount(0);
	await expect(today.getByRole('spinbutton', { name: 'Steps', exact: true })).toHaveCount(0);
	await expect(today.getByRole('heading', { name: 'Nutrition', exact: true })).toHaveCount(0);
	for (const name of ['Nutrition', 'Weight', 'Steps']) {
		await today.getByRole('button', { name: 'Add widget', exact: true }).click();
		await today.getByRole('button', { name, exact: true }).click();
	}
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(today.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveValue('');
	await expect(today.getByRole('spinbutton', { name: 'Steps', exact: true })).toHaveValue('0');
	await expect(today.getByRole('button', { name: '0 items', exact: true })).toBeVisible();
	await today.getByRole('button', { name: 'Add widget', exact: true }).click();
	for (const name of ['Nutrition', 'Weight', 'Steps'])
		await expect(today.getByRole('button', { name, exact: true })).toHaveCount(0);
	await today.getByRole('button', { name: 'Add widget', exact: true }).click();
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	const selected = page.getByRole('complementary', { name: 'Selected day', exact: true });
	await selected.getByRole('button', { name: 'Next day', exact: true }).click();
	await expect(selected.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveCount(0);
	await expect(selected.getByRole('heading', { name: 'Nutrition', exact: true })).toHaveCount(0);
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	for (const name of ['Nutrition', 'Weight', 'Steps']) {
		const pin = page.getByRole('button', { name: 'Pin ' + name, exact: true });
		await expect(pin).toHaveAttribute('aria-pressed', 'false');
		await pin.click();
	}
	const cards = page.locator('.built-in-row');
	const nutritionCard = await cards.nth(0).boundingBox();
	const weightCard = await cards.nth(1).boundingBox();
	const stepsCard = await cards.nth(2).boundingBox();
	expect(nutritionCard!.y).toBe(weightCard!.y);
	expect(weightCard!.height).toBeLessThan(nutritionCard!.height);
	expect(stepsCard!.height).toBeLessThan(nutritionCard!.height);
	expect(stepsCard!.x).toBe(weightCard!.x);
	expect(stepsCard!.y - (weightCard!.y + weightCard!.height)).toBeCloseTo(12, 0);
	await page.goto('/');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(selected.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveValue('');
	await expect(selected.getByRole('spinbutton', { name: 'Steps', exact: true })).toHaveValue('0');
	await expect(selected.getByRole('button', { name: '0 items', exact: true })).toBeVisible();
	await page.getByRole('tab', { name: 'Layout', exact: true }).click();
	for (const name of ['Nutrition', 'Weight', 'Steps'])
		await page.getByRole('button', { name: 'Pin ' + name, exact: true }).click();
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	await expect(selected.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveCount(0);
	await expect(selected.getByRole('heading', { name: 'Nutrition', exact: true })).toHaveCount(0);
	await selected.getByRole('button', { name: 'Previous day', exact: true }).click();
	await expect(selected.getByRole('spinbutton', { name: 'Weight (kg)' })).toHaveValue('');
	await expect(selected.getByRole('button', { name: '0 items', exact: true })).toBeVisible();
});
