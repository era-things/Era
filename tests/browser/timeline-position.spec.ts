import { test, expect, type Page } from '@playwright/test';
import { addDays, localToday } from '../../src/lib/calendar';

async function ready(page: Page) {
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
}

async function position(page: Page) {
	return page
		.locator('#timeline-panel')
		.evaluate((el) => ({ top: el.scrollTop, left: el.scrollLeft }));
}

async function navigate(page: Page, href: string) {
	await page.evaluate((href) => {
		const link = document.createElement('a');
		link.href = href;
		link.textContent = 'Navigate';
		document.body.append(link);
		link.click();
		link.remove();
	}, href);
	await expect(page).toHaveURL(new RegExp(href.replace('?', '\\?') + '$'));
	await ready(page);
}

test('the first visible grid frame is positioned at today, including slow hydration', async ({
	page
}) => {
	await page.addInitScript(() => {
		function sample() {
			const panel = document.getElementById('timeline-panel');
			if (panel && getComputedStyle(panel).visibility === 'visible' && panel.clientHeight) {
				const viewport = panel.getBoundingClientRect();
				const today = panel.querySelector('.day.today')?.getBoundingClientRect();
				panel.dataset.firstFrameShowsToday = String(
					!!today &&
						today.top >= viewport.top &&
						today.bottom <= viewport.bottom &&
						today.left >= viewport.left &&
						today.right <= viewport.right
				);
				return;
			}
			requestAnimationFrame(sample);
		}
		requestAnimationFrame(sample);
	});
	let delayedScripts = 0;
	await page.route('**/*', async (route) => {
		if (route.request().resourceType() === 'script') {
			delayedScripts++;
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
		await route.continue();
	});
	await page.goto('/');
	await ready(page);
	expect(delayedScripts).toBeGreaterThan(0);
	await expect(page.locator('#timeline-panel')).toHaveAttribute(
		'data-first-frame-shows-today',
		'true'
	);
});

test('grid and weekdays retain their positions across tabs and reloads', async ({ page }) => {
	await page.goto('/');
	await ready(page);
	await page.locator('#timeline-panel').evaluate((el) => {
		el.scrollTop += 230;
	});
	const grid = await position(page);
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	await ready(page);
	expect(await position(page)).toEqual(grid);
	await page.getByRole('tab', { name: 'Weekdays', exact: true }).click();
	await ready(page);
	await page.locator('#timeline-panel').evaluate((el) => {
		el.scrollLeft += 270;
	});
	const weekdays = await position(page);
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	await ready(page);
	expect(await position(page)).toEqual(grid);
	await page.getByRole('tab', { name: 'Weekdays', exact: true }).click();
	await ready(page);
	expect(await position(page)).toEqual(weekdays);
	await page.reload();
	await ready(page);
	expect(await position(page)).toEqual(weekdays);
});

test('resizing and reloading with a different width preserves the visible date', async ({
	page
}) => {
	await page.goto('/');
	await ready(page);
	const anchor = page.locator(`#day-${addDays(localToday(), -730)}`);
	await anchor.evaluate(async (day) => {
		day.scrollIntoView({ block: 'center', inline: 'center' });
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	});
	await expect(anchor).toBeInViewport();
	await expect(page.locator('.day.today')).not.toBeInViewport();
	await page.setViewportSize({ width: 1000, height: 650 });
	await expect(anchor).toBeInViewport();
	await page.reload();
	await ready(page);
	await expect(anchor).toBeInViewport();
});

test('back and forward restore each history entry instead of the latest stored position', async ({
	page
}) => {
	await page.goto('/?visit=one');
	await ready(page);
	await page.locator('#timeline-panel').evaluate((el) => {
		el.scrollTop += 180;
	});
	const first = await position(page);
	await navigate(page, '/?visit=two');
	await page.locator('#timeline-panel').evaluate((el) => {
		el.scrollTop += 310;
	});
	const second = await position(page);
	await page.goBack();
	await expect(page).toHaveURL(/visit=one$/);
	await ready(page);
	expect(await position(page)).toEqual(first);
	await page.goForward();
	await expect(page).toHaveURL(/visit=two$/);
	await ready(page);
	expect(await position(page)).toEqual(second);
});

test('history restores a hidden calendar without losing its saved position', async ({ page }) => {
	await page.goto('/?visit=hidden');
	await ready(page);
	await page.locator('#timeline-panel').evaluate((el) => {
		el.scrollTop += 200;
	});
	const grid = await position(page);
	await page.getByRole('tab', { name: 'Today', exact: true }).click();
	await expect(page).toHaveURL(/\/today$/);
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	await ready(page);
	await page.getByRole('button', { name: 'Next ten years', exact: true }).click();
	await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
	await page.goBack();
	await expect(page).toHaveURL(/\/today$/);
	await ready(page);
	await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await page.getByRole('tab', { name: 'Grid', exact: true }).click();
	await ready(page);
	expect(await position(page)).toEqual(grid);
});

test('today remains reachable after zooming and browsing decades', async ({ page }) => {
	await page.goto('/');
	await ready(page);
	await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
	await page.getByRole('button', { name: 'Next ten years', exact: true }).click();
	await page.getByRole('button', { name: 'Today', exact: true }).click();
	await expect(page.locator('.day.today')).toBeInViewport();
	await page.reload();
	await ready(page);
	await expect(page.locator('.day.today')).toBeInViewport();
});

test('initial positioning still works when browser storage is unavailable', async ({ page }) => {
	await page.addInitScript(() => {
		Storage.prototype.getItem = () => {
			throw new Error('Storage unavailable');
		};
		Storage.prototype.setItem = () => {
			throw new Error('Storage unavailable');
		};
	});
	await page.goto('/');
	await ready(page);
	await expect(page.locator('.day.today')).toBeInViewport();
});
