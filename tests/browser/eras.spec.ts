import { addDays, asDate, yearOf } from '../../src/lib/calendar';
import { emptyCalendar } from '../../src/lib/calendar-records';
import { VIEW_STORAGE_KEY, type SavedView } from '../../src/lib/view-state';
import { seedData } from './api-helpers';
import { test, expect } from './fixtures';

const extendedTimelineTest = test.extend({ timelineDays: 300 });

test('grid range marking can be undone and desktop sidebar width is remembered', async ({
	page,
	request
}) => {
	const { date: today } = await (await request.get('/api/today')).json();
	const [first, middle, last] = [-2, -1, 0].map((offset) => addDays(today, offset));
	await seedData(request, {
		...emptyCalendar(),
		eras: [
			{ id: 'project', name: 'Project', description: '', archived: false, linkedValue: 'none' }
		],
		eraDays: { [middle]: { project: { marked: true } } }
	});
	await page.goto('/eras');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const square = (day: string) => page.locator('#day-' + day);
	await square(first).click({ modifiers: ['Shift'] });
	await square(last).click({ modifiers: ['Shift'] });
	await expect(page.locator('.range-day')).toHaveCount(3);
	const range = page.getByRole('group', { name: 'Mark grid date range' });
	await range.getByRole('button', { name: 'Mark days', exact: true }).click();
	await expect(square(first)).toHaveAttribute('data-era-state', 'marked');
	await expect(square(last)).toHaveAttribute('data-era-state', 'marked');
	await expect
		.poll(async () =>
			Object.keys((await (await request.get('/api/eras/project')).json()).days).sort()
		)
		.toEqual([first, middle, last]);
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(square(first)).not.toHaveAttribute('data-era-state');
	await expect(square(middle)).toHaveAttribute('data-era-state', 'marked');
	await expect
		.poll(async () => Object.keys((await (await request.get('/api/eras/project')).json()).days))
		.toEqual([middle]);
	await page.getByRole('button', { name: 'Mark range' }).click();
	await square(last).click();
	await square(first).click();
	await expect(page.locator('.range-day')).toHaveCount(3);
	await range.getByRole('button', { name: 'Unmark days' }).click();
	await expect(square(middle)).not.toHaveAttribute('data-era-state');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(square(middle)).toHaveAttribute('data-era-state', 'marked');

	const sidebar = page.getByRole('complementary', { name: 'Timeline sidebar' });
	const resize = page.getByRole('separator', { name: 'Resize timeline sidebar' });
	const width = (await sidebar.boundingBox())!.width;
	const grip = (await resize.boundingBox())!;
	await page.mouse.move(grip.x + grip.width / 2, grip.y + 40);
	await page.mouse.down();
	await page.mouse.move(grip.x - 36, grip.y + 40);
	await page.mouse.up();
	const dragged = (await sidebar.boundingBox())!.width;
	expect(dragged).toBeGreaterThan(width);
	await resize.press('ArrowLeft');
	const resized = (await sidebar.boundingBox())!.width;
	expect(resized).toBeGreaterThan(dragged);
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	expect((await sidebar.boundingBox())!.width).toBeCloseTo(resized);
});

test('active eras move to the top of the stack and stay active after reload', async ({
	page,
	request
}) => {
	await seedData(request, {
		...emptyCalendar(),
		eras: [
			{ id: 'first', name: 'First era', description: '', archived: false, linkedValue: 'none' },
			{ id: 'second', name: 'Second era', description: '', archived: false, linkedValue: 'none' }
		]
	});
	await page.goto('/eras');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const stackTab = page.getByRole('tab', { name: 'Eras stack' });
	await stackTab.click();
	const drawer = page.getByRole('tabpanel', { name: 'Eras stack' });
	const titles = drawer.getByRole('article').getByRole('heading');
	const active = drawer
		.getByRole('article', { name: 'Second era' })
		.getByRole('checkbox', { name: 'Active' });
	await expect(titles).toHaveText(['First era', 'Second era']);
	await active.check();
	await expect(titles).toHaveText(['Second era', 'First era']);
	await expect
		.poll(async () => (await (await request.get('/api/eras/second')).json()).autoMarkedThrough)
		.toMatch(/^\d{4}-\d{2}-\d{2}$/);
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await stackTab.click();
	await expect(active).toBeChecked();
	await expect(titles).toHaveText(['Second era', 'First era']);
	await active.uncheck();
	await expect(titles).toHaveText(['First era', 'Second era']);
	await expect
		.poll(async () => (await (await request.get('/api/eras/second')).json()).autoMarkedThrough)
		.toBeUndefined();
});

test('number and boolean linked values can be edited without losing a previous type', async ({
	page,
	request
}) => {
	const { date: today } = await (await request.get('/api/today')).json();
	const [low, middle, high] = [-5, -4, -3].map((offset) => addDays(today, offset));
	await seedData(request, {
		...emptyCalendar(),
		eras: [
			{ id: 'training', name: 'Training', description: '', archived: false, linkedValue: 'number' }
		],
		eraDays: {
			[low]: { training: { marked: true, values: { number: 2 } } },
			[middle]: { training: { marked: true, values: { number: 6 } } },
			[high]: { training: { marked: true, values: { number: 10 } } }
		}
	});
	await page.goto('/eras?era=training');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const square = (date: string) => page.locator('#day-' + date);
	const stackTab = page.getByRole('tab', { name: 'Eras stack' });
	const dayTab = page.getByRole('tab', { name: 'Selected day' });
	const drawer = page.getByRole('tabpanel', { name: 'Eras stack' });
	const day = page.getByRole('complementary', { name: 'Selected day' });
	const tags = day.getByRole('group', { name: 'Day eras' });
	const measures = day.getByRole('region', { name: 'Custom measurements' });
	const value = measures.getByRole('spinbutton', { name: 'Training' });
	await expect(drawer.getByTitle('Total', { exact: true }).locator('dd')).toHaveText('18');
	await expect(drawer.getByTitle('Average', { exact: true }).locator('dd')).toHaveText('6');
	await expect(drawer.getByTitle('Minimum–maximum').locator('dd')).toHaveText('2–10');
	await expect(square(low)).toHaveAttribute('data-era-state', 'marked');
	await expect(square(middle)).toHaveCSS('--era-fill', / 50%/);
	await expect(square(high)).toHaveAttribute('data-era-state', 'bold');
	await square(middle).click();
	await page.getByRole('button', { name: 'Open day' }).click();
	await expect(tags.getByRole('link', { name: 'Training' })).toBeVisible();
	await expect(tags.locator('input')).toHaveCount(0);
	await value.fill('8');
	await value.press('Tab');
	await expect(square(middle)).toHaveCSS('--era-fill', / 75%/);

	async function changeType(kind: string) {
		await stackTab.click();
		await drawer.getByRole('button', { name: 'Edit', exact: true }).click();
		await drawer.getByLabel('Linked value').selectOption(kind);
		await drawer.getByRole('button', { name: 'Save changes' }).click();
		await dayTab.click();
	}
	await changeType('boolean');
	const checkbox = measures.getByRole('checkbox', { name: 'Training' });
	await expect(checkbox).toHaveCount(0);
	await day.getByRole('button', { name: 'Add widget', exact: true }).click();
	await day.getByRole('button', { name: 'Training', exact: true }).click();
	await expect(square(middle)).toHaveAttribute('data-era-state', 'marked');
	await checkbox.check();
	await expect(square(middle)).toHaveAttribute('data-era-state', 'bold');
	await checkbox.uncheck();
	await expect(square(middle)).toHaveAttribute('data-era-state', 'marked');
	await changeType('number');
	await expect(value).toHaveValue('8');
	await expect(checkbox).toHaveCount(0);
	await expect(square(middle)).toHaveCSS('--era-fill', / 75%/);
	await expect
		.poll(async () => (await (await request.get('/api/eras/training')).json()).days[middle].values)
		.toEqual({ boolean: false, number: 8 });

	await measures.getByRole('button', { name: 'Remove Training from day' }).click();
	await expect(value).toHaveCount(0);
	await expect(tags.getByRole('link', { name: 'Training' })).toBeVisible();
	await day.getByRole('button', { name: 'Add widget', exact: true }).click();
	await day.getByRole('button', { name: 'Training', exact: true }).click();
	await expect(value).toHaveValue('');
	await value.fill('-1.5');
	await value.press('Tab');
	await expect
		.poll(async () => (await (await request.get('/api/eras/training')).json()).days[middle].values)
		.toEqual({ boolean: false, number: -1.5 });
});

extendedTimelineTest(
	'on desktop the grid sits left of the sidebar and linked days scroll in the Eras tab',
	async ({ page, request }) => {
		const { date: today } = await (await request.get('/api/today')).json();
		await seedData(request, {
			...emptyCalendar(),
			eras: [
				{
					id: 'project',
					name: 'Pet Project',
					description: '',
					archived: false,
					linkedValue: 'none'
				}
			],
			eraDays: Object.fromEntries(
				Array.from({ length: 30 }, (_, offset) => [
					addDays(today, -offset),
					{ project: { marked: true } }
				])
			)
		});
		const view: SavedView = {
			version: 4,
			mode: 'horizontal',
			zoom: 200,
			firstYear: yearOf(today) - 5,
			selected: today,
			position: { day: today, x: -24, y: -24 }
		};
		await page.setViewportSize({ width: 1280, height: 540 });
		await page.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), {
			key: VIEW_STORAGE_KEY,
			view
		});
		await page.goto('/eras?era=project');
		await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
		const timeline = page.locator('#timeline-panel');
		const dimensions = await timeline.evaluate((element) => ({
			verticalOverflow: element.scrollHeight - element.clientHeight,
			horizontalOverflow: element.scrollWidth - element.clientWidth
		}));
		expect(dimensions.verticalOverflow).toBe(0);
		expect(dimensions.horizontalOverflow).toBeGreaterThan(0);
		const selector = page.getByRole('navigation', { name: 'Eras', exact: true });
		const selectorHeight = await selector.evaluate((element) => ({
			visible: element.clientHeight,
			content: element.scrollHeight
		}));
		expect(selectorHeight.visible).toBeGreaterThan(0);
		expect(selectorHeight.content).toBe(selectorHeight.visible);
		const editor = page.getByRole('complementary', { name: 'Selected day' });
		const stackTab = page.getByRole('tab', { name: 'Eras stack' });
		const drawer = page.getByRole('tabpanel', { name: 'Eras stack' });
		const gridBounds = (await timeline.boundingBox())!;
		const sidebarBounds = (await page
			.getByRole('complementary', { name: 'Timeline sidebar' })
			.boundingBox())!;
		expect(gridBounds.x + gridBounds.width).toBeLessThan(sidebarBounds.x);
		expect(gridBounds.y).toBeGreaterThan(sidebarBounds.y);
		await expect(drawer).toHaveCSS('overflow-y', 'auto');
		await expect(editor).toBeHidden();
		const list = drawer.getByRole('list', { name: 'Linked days' });
		const days = drawer.getByRole('button', { name: 'Days 30', exact: true });
		await expect(days).toHaveAttribute('aria-expanded', 'false');
		await expect(list).toHaveCount(0);
		await days.click();
		await expect(days).toHaveAttribute('aria-expanded', 'true');
		await expect(list).toHaveCSS('overflow-y', 'auto');
		const timelineTop = (await timeline.boundingBox())!.y;
		expect(
			await list.evaluate((element) => {
				element.scrollTop = element.scrollHeight;
				return element.scrollTop;
			})
		).toBeGreaterThan(0);
		expect((await timeline.boundingBox())!.y).toBe(timelineTop);
		const oldest = list.getByRole('link').last();
		await oldest.click();
		await expect(editor.locator('time')).toHaveAttribute('datetime', addDays(today, -29));
		await expect(editor.locator('time')).toBeInViewport();
		await expect(stackTab).toHaveAttribute('aria-selected', 'false');
		await stackTab.click();
		await days.click();
		await expect(list).toHaveCount(0);
	}
);

extendedTimelineTest(
	'the sidebar tabs switch between day editing and overlapping era filters',
	async ({ page, request }) => {
		const { date: today } = await (await request.get('/api/today')).json();
		const newest = addDays(today, -35);
		const marked = addDays(newest, -1);
		const gap = addDays(newest, -2);
		const older = addDays(newest, -95);
		const unrelated = addDays(newest, 1);
		const future = addDays(today, 1);
		await seedData(request, {
			...emptyCalendar(),
			timelineColor: '#406c99',
			emojis: { [marked]: '🏋️' },
			notes: {
				[marked]: 'The **second chapter** begins.\n\n' + 'More notes for this day. '.repeat(12)
			},
			eras: [
				{
					id: 'project',
					name: 'Pet Project',
					description: 'Work on the demo',
					archived: false,
					autoMarkedThrough: today,
					palette: 'violet',
					linkedValue: 'hours'
				},
				{
					id: 'winter',
					name: 'Winter Arc',
					description: 'Keep a winter routine',
					archived: false,
					palette: 'teal',
					linkedValue: 'none'
				},
				{
					id: 'summer',
					name: 'Summer training and weekend projects',
					description: '',
					archived: false,
					linkedValue: 'none'
				},
				{
					id: 'study',
					name: 'Study',
					description: '',
					archived: true,
					linkedValue: 'boolean'
				}
			],
			eraDays: {
				[newest]: { project: { values: { hours: 0 } } },
				[marked]: { project: { marked: true }, winter: { marked: true } },
				[gap]: { winter: { marked: true } },
				[older]: {
					project: { marked: true, values: { hours: 95 } },
					winter: { marked: true },
					study: { values: { boolean: true } }
				},
				[addDays(older, 1)]: { study: { values: { boolean: false } } }
			}
		});
		await page.goto('/eras');
		await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
		const grid = page.getByRole('group', { name: 'Days aligned by weekday' });
		await expect(grid.getByRole('button')).toHaveCount(300);
		const square = (date: string) => grid.locator('#day-' + date);
		const background = (date: string) =>
			square(date).evaluate((cell) => getComputedStyle(cell).backgroundColor);
		const unrelatedColor = await background(unrelated);
		const futureColor = await background(future);
		const sidebar = page.getByRole('complementary', { name: 'Timeline sidebar' });
		const dayTab = sidebar.getByRole('tab', { name: 'Selected day' });
		const stackTab = sidebar.getByRole('tab', { name: 'Eras stack' });
		const drawer = sidebar.getByRole('tabpanel', { name: 'Eras stack' });
		const day = page.getByRole('complementary', { name: 'Selected day' });
		const selectedDay = sidebar.locator('.panel-date time');
		const selector = page.getByRole('navigation', { name: 'Eras', exact: true });
		await expect(dayTab).toHaveAttribute('aria-selected', 'true');
		await expect(day).toBeVisible();
		await expect(drawer).toBeHidden();
		await expect(selector).toBeVisible();
		const selectedDate = await selectedDay.getAttribute('datetime');
		await dayTab.press('ArrowRight');
		await expect(stackTab).toBeFocused();
		await expect(drawer).toBeVisible();
		await expect(day).toBeHidden();
		const reset = selector.getByRole('button', { name: 'Default' });
		const project = selector.getByRole('button', { name: 'Pet Project' });
		const winter = selector.getByRole('button', { name: 'Winter Arc' });
		await expect(reset).toHaveAttribute('aria-pressed', 'true');
		const cards = drawer.getByRole('article');
		const projectCard = drawer.getByRole('article', { name: 'Pet Project' });
		const winterCard = drawer.getByRole('article', { name: 'Winter Arc' });
		const studyCard = drawer.getByRole('article', { name: 'Study' });
		await expect(cards).toHaveCount(3);
		await expect(studyCard).toBeHidden();
		await drawer.getByText('Archived (1)', { exact: true }).click();
		await expect(cards).toHaveCount(4);
		await expect(studyCard.getByTitle('Days on / days logged').locator('dd')).toHaveText('1 / 2');
		const timeStats = projectCard.locator('.era-stats');
		await expect(timeStats.locator('dd')).toHaveText(['1h 35m', '0h 32m', '0h 48m']);
		await expect(timeStats.locator('svg')).toHaveCount(3);
		await expect(timeStats.getByTitle('Average per linked day')).toBeVisible();
		await expect(timeStats.getByTitle('Average per logged day')).toBeVisible();
		const loggedStat = timeStats.getByRole('button', { name: /Average per logged day/ });
		await loggedStat.focus();
		await expect(timeStats.getByText('Average across 2 logged days')).toBeVisible();
		await loggedStat.press('Escape');
		await expect(timeStats.getByText('Average across 2 logged days')).toBeHidden();
		const span = new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC'
		}).formatRange(asDate(older), asDate(newest));
		await expect(projectCard.getByText(span, { exact: true })).toHaveCount(0);
		await expect(projectCard.getByText('Work on the demo')).toBeVisible();
		await expect(winterCard.getByText('Keep a winter routine')).toBeVisible();
		const projectBounds = (await projectCard.boundingBox())!;
		expect((await winterCard.boundingBox())!.y).toBeGreaterThan(
			projectBounds.y + projectBounds.height
		);
		const timeline = page.locator('#timeline-panel');
		const year = timeline.locator('.horizontal-years h2').first();
		const month = timeline.locator('.horizontal-month-marker time').nth(1);
		const dayPreview = page.getByRole('group', { name: 'Day preview' });
		const markRange = page.getByRole('button', { name: 'Mark range', exact: true });
		const viewport = (await timeline.boundingBox())!;
		const selectorBounds = (await selector.boundingBox())!;
		const yearBounds = (await year.boundingBox())!;
		const monthBounds = (await month.boundingBox())!;
		const daysBounds = (await grid.boundingBox())!;
		const sidebarBounds = (await sidebar.boundingBox())!;
		const previewBounds = (await dayPreview.boundingBox())!;
		const markBounds = (await markRange.boundingBox())!;
		expect(viewport.x).toBeGreaterThan(0);
		expect(viewport.x + viewport.width).toBeLessThan(sidebarBounds.x);
		expect(markBounds.x).toBeCloseTo(viewport.x);
		expect(markBounds.x + markBounds.width).toBeLessThan(selectorBounds.x);
		expect(selectorBounds.x + selectorBounds.width).toBeLessThan(previewBounds.x);
		await expect(markRange.locator('svg')).toBeVisible();
		await expect(markRange).toHaveText('');
		expect(previewBounds.x + previewBounds.width).toBeCloseTo(viewport.x + viewport.width);
		expect(markBounds.y + markBounds.height / 2).toBeCloseTo(
			selectorBounds.y + selectorBounds.height / 2
		);
		expect(selectorBounds.x + selectorBounds.width).toBeLessThanOrEqual(
			viewport.x + viewport.width + 1
		);
		expect(yearBounds.y).toBeGreaterThanOrEqual(selectorBounds.y + selectorBounds.height);
		expect(Math.abs(monthBounds.y - yearBounds.y)).toBeLessThan(2);
		expect(yearBounds.y + yearBounds.height).toBeLessThanOrEqual(daysBounds.y);
		await expect(year).toHaveCSS('font-size', '9px');
		await expect(month).toHaveCSS('font-size', '8px');
		await expect(year).toHaveCSS('opacity', '0.63');
		await expect(timeline.locator('.horizontal-month-marker time[datetime$="-01"]')).toHaveCount(0);
		const monthDate = (await month.getAttribute('datetime')) + '-01';
		const firstDay = (await square(monthDate).boundingBox())!;
		expect(
			Math.abs(monthBounds.x + monthBounds.width / 2 - firstDay.x - firstDay.width / 2)
		).toBeLessThan(1);
		await page.setViewportSize({ width: 390, height: 800 });
		const mobileGrid = (await timeline.boundingBox())!;
		expect((await sidebar.boundingBox())!.y).toBeGreaterThanOrEqual(
			mobileGrid.y + mobileGrid.height
		);
		const moreEras = selector.getByRole('button', { name: /more eras/ });
		await expect(moreEras).toBeVisible();
		const revealWinter = async () => {
			if (!(await winter.isVisible())) await moreEras.click();
			await expect(winter).toBeVisible();
		};
		await expect(reset).toBeVisible();
		await expect(project).toBeVisible();
		const mobileSelector = (await selector.boundingBox())!;
		const mobileMark = (await markRange.boundingBox())!;
		const mobilePreview = (await dayPreview.boundingBox())!;
		expect(mobileMark.x + mobileMark.width).toBeLessThan(mobileSelector.x);
		expect(mobileSelector.x + mobileSelector.width).toBeLessThan(mobilePreview.x);
		expect(mobileMark.y + mobileMark.height / 2).toBeCloseTo(
			mobileSelector.y + mobileSelector.height / 2
		);
		expect(
			new Set(
				await selector
					.getByRole('button')
					.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().top))
			).size
		).toBe(1);
		await expect(square(newest)).toHaveCSS('background-color', 'rgb(180, 155, 209)');
		await expect(square(gap)).toHaveCSS('background-color', 'rgb(132, 189, 182)');
		const halves = 'conic-gradient(from 45deg, #b49bd1 0deg 180deg, #84bdb6 180deg 360deg)';
		await expect(square(marked)).toHaveCSS('--era-overlap-fill', halves);
		await expect(square(marked)).toHaveCSS('background-image', /^conic-gradient/);
		await expect(square(marked)).toHaveAccessibleName(/Pet Project · Winter Arc$/);
		await expect(square(older)).toHaveCSS(
			'--era-overlap-fill',
			/conic-gradient\(from 45deg, color-mix\([^)]+\) 0deg 116\.56\d*deg, #84bdb6 116\.56\d*deg 243\.43\d*deg, #397440 243\.43\d*deg 360deg\)/
		);
		await expect(square(older)).toHaveCSS('background-image', /^conic-gradient/);
		await expect(square(older)).toHaveAccessibleName(
			/Pet Project \(1h 35m\) · Winter Arc · Study \(On\)$/
		);
		const projectDays = projectCard.getByRole('button', { name: 'Days 3' });
		await projectDays.click();
		await expect(projectCard.getByRole('list', { name: 'Linked days' })).toBeVisible();
		await expect(projectCard.locator('.history-month h3')).toHaveCount(
			new Set([newest, marked, older].map((date) => date.slice(0, 7))).size
		);
		const storyDay = projectCard.locator(`a[href$="&day=${marked}"]`);
		await expect(storyDay).toContainText('🏋️');
		const preview = storyDay.locator('.note-preview');
		await expect(preview).toContainText('The second chapter begins. More notes');
		await expect(preview).toHaveCSS('white-space', 'nowrap');
		await expect(preview).toHaveCSS('text-overflow', 'ellipsis');
		await expect(winterCard.getByRole('button', { name: 'Days 3' })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
		await projectDays.click();

		const pressedAfterClick = await project.evaluate(async (chip) => {
			chip.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
			await new Promise(requestAnimationFrame);
			return chip.getAttribute('aria-pressed');
		});
		expect(pressedAfterClick).toBe('false');
		await expect(page).toHaveURL('/eras');
		await expect(selectedDay).toHaveAttribute('datetime', selectedDate!);
		await expect(project).toHaveAttribute('aria-pressed', 'false');
		await expect(projectCard).toBeVisible();
		await expect(cards).toHaveCount(4);
		await expect(reset).toHaveAttribute('aria-pressed', 'false');
		await revealWinter();
		await expect(winter).toHaveAttribute('aria-pressed', 'true');
		await expect(square(marked)).toHaveCSS('background-color', 'rgb(132, 189, 182)');
		await expect(square(marked)).toHaveCSS('background-image', 'none');
		await expect(square(newest)).not.toHaveAttribute('data-era-state');

		const summer = selector.getByRole('button', { name: 'Summer training and weekend projects' });
		const archived = selector.getByRole('button', { name: 'Archived' });
		if (!(await summer.isVisible())) await moreEras.click();
		await summer.click();
		await archived.click();
		await selector.getByRole('button', { name: 'Study' }).click();
		await revealWinter();
		await expect(selector.getByRole('button', { pressed: true })).toHaveCount(1);
		await expect(cards).toHaveCount(4);
		await expect(drawer.getByRole('heading', { name: 'Winter Arc' })).toBeVisible();
		await expect(square(newest)).not.toHaveAttribute('data-era-state');
		await expect(square(marked)).toHaveAccessibleName(/Winter Arc$/);
		await expect(square(unrelated)).toHaveCSS('background-color', unrelatedColor);
		await expect(square(future)).toHaveCSS('background-color', futureColor);
		await expect(selectedDay).toHaveAttribute('datetime', selectedDate!);

		await reset.click();
		await archived.click();
		await expect(reset).toHaveAttribute('aria-pressed', 'true');
		await expect(square(marked)).toHaveCSS('--era-overlap-fill', halves);
		await project.click();
		await expect(project).toHaveAttribute('aria-pressed', 'false');
		const stopWatching = await page.locator('#timeline-panel').evaluateHandle((panel) => {
			let hidGrid = false;
			const observer = new MutationObserver((records) => {
				hidGrid ||=
					records.some((record) => record.oldValue?.includes('hidden')) ||
					getComputedStyle(panel).visibility === 'hidden';
			});
			observer.observe(panel, { attributeFilter: ['style'], attributeOldValue: true });
			return () => {
				observer.disconnect();
				return hidGrid;
			};
		});
		await project.dblclick({ delay: 150 });
		await expect(page).toHaveURL('/eras');
		await expect(selectedDay).toHaveAttribute('datetime', selectedDate!);
		await expect(selector.getByRole('button', { pressed: true })).toHaveCount(1);
		await expect(project).toHaveAttribute('aria-pressed', 'true');
		await revealWinter();
		await expect(winter).toHaveAttribute('aria-pressed', 'false');
		await expect(drawer.getByRole('heading', { name: 'Pet Project' })).toBeVisible();
		await expect(square(newest)).toHaveAccessibleName(/Pet Project \(0h 00m\)$/);
		await expect(square(newest)).toHaveCSS('background-color', 'rgb(180, 155, 209)');
		await expect(square(marked)).toHaveCSS('background-color', 'rgb(180, 155, 209)');
		await expect(square(marked)).toHaveCSS('background-image', 'none');
		expect(await stopWatching.evaluate((stop) => stop())).toBe(false);
		await stopWatching.dispose();
		await expect(square(gap)).not.toHaveAttribute('data-era-state');
		await expect(square(unrelated)).toHaveCSS('background-color', unrelatedColor);
		await expect(square(older)).toHaveAccessibleName(/Pet Project \(1h 35m\)$/);
		await square(marked).hover();
		await expect(page.getByRole('group', { name: 'Day preview' })).toContainText('Winter Arc');
		await square(marked).click();
		await expect(stackTab).toHaveAttribute('aria-selected', 'true');
		await expect(selectedDay).toHaveAttribute('datetime', marked);
		await sidebar.getByRole('button', { name: 'Open day' }).click();
		await expect(dayTab).toHaveAttribute('aria-selected', 'true');
		await expect(selector).toBeVisible();
		await expect(day.locator('time')).toHaveAttribute('datetime', marked);
		await day.getByRole('textbox', { name: 'Notes' }).fill('Edited from Eras');
		await expect
			.poll(async () => (await (await request.get('/api/data')).json()).notes[marked])
			.toBe('Edited from Eras');

		await stackTab.click();
		await project.click();
		await expect(selector.getByRole('button', { pressed: true })).toHaveCount(0);
		await expect(cards).toHaveCount(4);
		await expect(square(marked)).not.toHaveAttribute('data-era-state');
		await revealWinter();
		await winter.press('Shift+Enter');
		await expect(square(gap)).toHaveCSS('background-color', 'rgb(132, 189, 182)');
		await expect(square(newest)).not.toHaveAttribute('data-era-state');
		await reset.click();
		await expect(page).toHaveURL('/eras');
		await expect(square(marked)).toHaveCSS('--era-overlap-fill', halves);
		await dayTab.click();
		await expect(drawer).toBeHidden();
		await expect(grid).toBeVisible();
		await expect(day).toBeVisible();
		await stackTab.click();
		await projectCard.getByRole('button', { name: 'Show on grid' }).click();
		await expect(square(newest)).toHaveAttribute('data-era-state', 'marked');

		await projectCard.getByRole('button', { name: /^Days / }).click();
		await projectCard
			.getByRole('list', { name: 'Linked days' })
			.locator(`a[href="/eras?era=project&day=${older}"]`)
			.click();
		await expect(page).toHaveURL('/eras?era=project&day=' + older);
		await expect(day.locator('time')).toHaveAttribute('datetime', older);
		await page.goBack();
		await expect(square(older)).toHaveAttribute('data-era-state', 'graded');
		await expect(drawer.getByRole('heading', { name: 'Pet Project' })).toBeVisible();
	}
);

test('overlapping eras, daily time, range marking, and archive round-trip', async ({
	page,
	request
}) => {
	const { date: today } = await (await request.get('/api/today')).json();
	const yesterday = addDays(today, -1);
	const tomorrow = addDays(today, 1);
	await page.goto('/eras');
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	const stackTab = page.getByRole('tab', { name: 'Eras stack' });
	await stackTab.click();
	const stack = page.getByRole('tabpanel', { name: 'Eras stack' });
	const projectCard = stack.getByRole('article', { name: 'Pet Project' });
	const winterCard = stack.getByRole('article', { name: 'Winter Arc' });

	await page.getByRole('button', { name: 'New era' }).click();
	const create = page.getByRole('button', { name: 'Create era' });
	await expect(create).toBeDisabled();
	await expect(create).toHaveCSS('color', 'rgb(98, 110, 102)');
	await page.getByLabel('Name', { exact: true }).fill('Pet Project');
	const description = page.getByRole('textbox', { name: 'Description', exact: true });
	await description.fill('Ship a **playable** demo');
	await expect(page.getByLabel('Linked value')).toHaveValue('none');
	await page.getByLabel('Linked value').selectOption('hours');
	await page.getByRole('radio', { name: 'Violet' }).check();
	await expect(create).toHaveCSS('background-color', 'rgb(35, 105, 91)');
	await create.click();
	await expect(page.getByRole('heading', { name: 'Pet Project' })).toBeVisible();
	await expect(projectCard.locator('.sd-strong')).toHaveText('playable');
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await description.fill('Finish the demo');
	await expect(page.getByRole('radio', { name: 'Violet' })).toBeChecked();
	await page.getByRole('radio', { name: 'Blue' }).check();
	await page.getByRole('button', { name: 'Save changes' }).click();

	await page.getByRole('button', { name: 'New era' }).click();
	await page.getByLabel('Name', { exact: true }).fill('Winter Arc');
	await page.getByRole('button', { name: 'Create era' }).click();
	await expect(page.getByRole('heading', { name: 'Winter Arc' })).toBeVisible();
	await winterCard.getByRole('button', { name: 'Mark date range' }).click();
	await page.getByLabel('From', { exact: true }).fill(yesterday);
	await page.getByLabel('Through', { exact: true }).fill(tomorrow);
	await page.getByRole('button', { name: 'Mark days' }).click();
	const history = winterCard.getByRole('region', { name: 'Era history' });
	const list = history.getByRole('list', { name: 'Linked days' });
	await history.getByRole('button', { name: 'Days 3' }).click();
	await expect(list.getByRole('link')).toHaveCount(3);
	const dateColumns = await list
		.locator('time')
		.evaluateAll((dates) =>
			dates.map((date) => [...date.children].map((part) => part.getBoundingClientRect().x))
		);
	expect(dateColumns[0]).toHaveLength(4);
	expect(dateColumns[1]).toEqual(dateColumns[0]);
	expect(dateColumns[2]).toEqual(dateColumns[0]);
	await list.locator(`a[href$="&day=${yesterday}"]`).click();
	await expect(page).toHaveURL(new RegExp(`/eras\\?era=[^&]+&day=${yesterday}$`));
	const day = page.getByRole('complementary', { name: 'Selected day' });
	await expect(day.locator('time')).toHaveAttribute('datetime', yesterday);
	await expect(day.getByRole('link', { name: 'Winter Arc' })).toBeVisible();

	await day.getByRole('button', { name: 'Add widget', exact: true }).click();
	await day.getByRole('button', { name: 'Pet Project timer' }).click();
	await expect(day.getByRole('link', { name: 'Pet Project' })).toHaveCount(0);
	const hours = day.getByRole('spinbutton', { name: 'Pet Project hours' });
	await expect(hours).toBeFocused();
	await hours.fill('2');
	await hours.press('Enter');
	await expect(day.getByRole('link', { name: 'Pet Project' })).toBeVisible();
	await expect(day.locator('.tag').filter({ hasText: 'Pet Project' })).toHaveCSS(
		'border-inline-start-width',
		'0px'
	);
	await expect(
		day.getByRole('region', { name: 'Pet Project timer' }).locator('.time-widget')
	).toHaveCSS('background-color', 'rgb(229, 237, 246)');
	await day.getByRole('button', { name: '+ Era' }).click();
	await day.getByRole('button', { name: 'Pet Project', exact: true }).click();
	await expect(day.getByRole('link', { name: 'Pet Project' })).toHaveCount(1);
	await day.getByRole('button', { name: 'Remove Pet Project timer' }).click();
	await expect(day.getByRole('link', { name: 'Pet Project' })).toBeVisible();
	await day.getByRole('button', { name: 'Unmark Pet Project' }).click();
	await expect(day.getByRole('link', { name: 'Pet Project' })).toHaveCount(0);

	await day.getByRole('button', { name: 'Add widget', exact: true }).click();
	await day.getByRole('button', { name: 'Pet Project timer' }).click();
	const minutes = day.getByRole('spinbutton', { name: 'Pet Project minutes' });
	await minutes.fill('35');
	await minutes.press('Enter');
	await day.getByRole('link', { name: 'Pet Project' }).click();
	const projectHistory = projectCard.getByRole('region', { name: 'Era history' });
	await expect(projectHistory.getByTitle('Total time').locator('dd')).toHaveText('0h 35m');
	await expect(page.getByText('Finish the demo')).toBeVisible();
	await projectCard.getByRole('button', { name: 'Archive', exact: true }).click();
	await expect(projectCard).toBeHidden();
	await stack.getByText('Archived (1)', { exact: true }).click();
	await expect(projectCard.getByRole('button', { name: 'Restore' })).toBeVisible();
	const selector = page.getByRole('navigation', { name: 'Eras', exact: true });
	const archivedEra = selector.getByRole('button', { name: 'Pet Project' });
	await expect(archivedEra).toHaveAttribute('aria-pressed', 'true');
	const eraPath = new URL(page.url()).search;
	const id = new URLSearchParams(eraPath).get('era');
	await expect
		.poll(async () => (await request.get('/api/eras/' + id)).json())
		.toMatchObject({ archived: true, palette: 'blue' });
	await page.reload();
	await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false');
	await expect(projectCard).toBeHidden();
	await stack.getByText('Archived (1)', { exact: true }).click();
	await expect(projectHistory.getByTitle('Total time').locator('dd')).toHaveText('0h 35m');
	await projectHistory.getByRole('button', { name: /^Days / }).click();
	await projectHistory.getByRole('list', { name: 'Linked days' }).getByRole('link').click();
	await expect(day.getByRole('link', { name: 'Pet Project' })).toBeVisible();
	await day.getByRole('button', { name: 'Remove Pet Project timer' }).click();
	await expect(day.getByRole('link', { name: 'Pet Project' })).toHaveCount(0);
	await expect(day.getByRole('link', { name: 'Winter Arc' })).toBeVisible();
	await day.getByRole('button', { name: 'Add widget', exact: true }).click();
	await expect(day.getByRole('button', { name: 'Pet Project timer', exact: true })).toHaveCount(0);
	await stackTab.click();
	await selector.getByRole('button', { name: 'Default' }).click();
	await expect(archivedEra).toHaveCount(0);
	await selector.getByRole('button', { name: 'Archived' }).click();
	await expect(archivedEra).toHaveAttribute('aria-pressed', 'true');
	await archivedEra.dblclick();
	await projectCard.getByRole('button', { name: 'Restore' }).click();
	await expect(projectCard.getByRole('button', { name: 'Archive', exact: true })).toBeVisible();
	await expect
		.poll(async () => (await (await request.get('/api/eras/' + id)).json()).archived)
		.toBe(false);
});
