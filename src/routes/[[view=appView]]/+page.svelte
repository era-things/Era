<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { beforeNavigate, goto, snapshot } from '$app/navigation';
	import { page } from '$app/state';
	import { APP_VIEWS, appViewForPath, type AppViewId } from '../../lib/app-views';
	import { capturePosition, restorePosition } from '../../lib/timeline-position';
	import { untrack } from 'svelte';
	import { createCalendarSync, type SyncState } from '../../lib/calendar-sync';
	import type { PageData } from './$types';
	import TimelineGrid from '../../lib/components/TimelineGrid.svelte';
	import DayDetail from '../../lib/components/DayDetail.svelte';
	import DayPanel from '../../lib/components/DayPanel.svelte';
	import DayWidgets from '../../lib/components/DayWidgets.svelte';
	import { setWidgetSettings } from '../../lib/widgets';
	import LayoutManager from '../../lib/components/LayoutManager.svelte';
	import RemindersManager from '../../lib/components/RemindersManager.svelte';
	import SettingsPanel from '../../lib/components/SettingsPanel.svelte';
	import {
		createReminder,
		reminderOccursOn,
		reminderOverridesEmoji,
		setReminderCompleted,
		type Reminder
	} from '../../lib/reminders';
	import { removeMeasure, type Measure } from '../../lib/measures';
	import {
		addDays,
		daysInRange,
		eraToday,
		relativeDay,
		yearOf,
		type DateKey
	} from '../../lib/calendar';
	import { normalizeEmoji, type DayEmojis } from '../../lib/day-emojis';
	import {
		parseSavedView,
		VIEW_STORAGE_KEY,
		ZOOM_LEVELS,
		type SavedView,
		type ViewMode,
		type ZoomLevel
	} from '../../lib/view-state';

	let { data }: { data: PageData } = $props();
	let browserToday = $state<DateKey | null>(null);
	let rangeStart = $state<number | null>(null);
	let selection = $state<DateKey | null>(null);
	let restored = $state(false);
	const activeView = $derived(appViewForPath('/' + (page.params.view ?? ''))!);
	let mode = $state<ViewMode>(
		untrack(() => (activeView.section === 'calendar' ? activeView.mode : 'vertical'))
	);
	let zoom = $state<ZoomLevel>(100);
	let syncState = $state<SyncState>({
		data: untrack(() => data.calendar),
		error: '',
		retryable: false,
		remoteRevision: 0
	});
	const sync = createCalendarSync(
		untrack(() => syncState.data),
		(state) => {
			syncState = state;
		}
	);
	const { save, saveData, flush, readExport, previewImport, importBackup } = sync;
	const calendarData = $derived(syncState.data);
	const emojis = $derived(calendarData.emojis),
		reminders = $derived(calendarData.reminders),
		measures = $derived(calendarData.measures);
	const section = $derived(activeView.section);
	const cellSize = $derived((24 * zoom) / 100);
	const zoomIndex = $derived(ZOOM_LEVELS.indexOf(zoom));
	let viewport: HTMLDivElement;
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	const today = $derived(browserToday ?? data.today);
	const firstYear = $derived(rangeStart ?? yearOf(today) - 5);
	const lastYear = $derived(firstYear + 9);
	const selected = $derived(selection ?? today);
	const reminderEmojis = $derived.by(() => {
		const overrides: DayEmojis = {};
		const enabled = reminders.filter((r) => r.overrideEmoji);
		if (!enabled.length) return overrides;
		for (const { key } of daysInRange(firstYear, lastYear)) {
			if (enabled.some((r) => reminderOverridesEmoji(r, key, today))) overrides[key] = '❗';
		}
		return overrides;
	});
	const displayedEmojis = $derived({ ...emojis, ...reminderEmojis });

	let views: Partial<Record<ViewMode, SavedView>> = {};
	let positioning = 0;
	let historyRestored = false;

	function rememberView() {
		if (!restored || !viewport || section !== 'calendar') return;
		const position = capturePosition(viewport);
		if (position) views[mode] = { version: 4, mode, zoom, firstYear, selected, position };
	}

	function saveView() {
		rememberView();
		const view = views[mode];
		if (!view) return;
		try {
			localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(view));
		} catch {
			/* The timeline works when browser storage is unavailable. */
		}
	}

	function applyView(view: SavedView) {
		rangeStart = view.firstYear;
		selection = view.selected;
		mode = view.mode;
		zoom = view.zoom;
	}

	async function positionView(view?: SavedView) {
		const ticket = ++positioning;
		restored = false;
		clearTimeout(saveTimer);
		if (view) applyView(view);
		await tick();
		if (ticket !== positioning) return;
		restorePosition(
			viewport,
			view?.position ?? { day: selected, x: -cellSize / 2, y: -cellSize / 2 }
		);
		restored = true;
		saveView();
	}

	snapshot({
		id: 'timeline-v4',
		capture: () => {
			saveView();
			return { views, mode };
		},
		restore: (value) => {
			historyRestored = true;
			views = value.views;
			mode = activeView.section === 'calendar' ? activeView.mode : value.mode;
			// Hidden calendars have no layout. Position them when opened instead.
			const view = views[mode];
			if (section === 'calendar') void positionView(view);
			else {
				if (view) applyView(view);
				restored = true;
			}
		},
		reset: activateRoute
	});

	beforeNavigate(() => {
		saveView();
		positioning++;
		clearTimeout(saveTimer);
		restored = false;
	});

	function scheduleSave() {
		rememberView();
		clearTimeout(saveTimer);
		saveTimer = setTimeout(saveView, 120);
	}

	$effect(() => {
		firstYear;
		selected;
		mode;
		zoom;
		if (restored) saveView();
	});

	onMount(() => {
		const minuteMs = 60_000;
		let timer: number | undefined;
		const refreshToday = () => {
			const now = new Date();
			browserToday = eraToday(now, data.timeZone);
			window.clearTimeout(timer);
			timer = window.setTimeout(refreshToday, minuteMs - (now.getTime() % minuteMs));
		};
		refreshToday();
		const disconnectSync = sync.connect();
		let saved = null;
		try {
			saved = parseSavedView(localStorage.getItem(VIEW_STORAGE_KEY));
		} catch {
			/* Use today. */
		}
		if (!historyRestored) {
			if (saved) {
				views[saved.mode] = saved;
				applyView(saved);
			}
			activateRoute();
		}
		const resizeObserver = new ResizeObserver(() => {
			if (restored && section === 'calendar' && views[mode]) {
				restorePosition(viewport, views[mode]!.position);
			}
		});
		resizeObserver.observe(viewport);

		window.addEventListener('focus', refreshToday);
		document.addEventListener('visibilitychange', refreshToday);
		window.addEventListener('pagehide', saveView);
		return () => {
			saveView();
			disconnectSync();
			positioning++;
			resizeObserver.disconnect();
			clearTimeout(saveTimer);
			window.clearTimeout(timer);
			window.removeEventListener('focus', refreshToday);
			document.removeEventListener('visibilitychange', refreshToday);
			window.removeEventListener('pagehide', saveView);
		};
	});

	async function changeRange(direction: number) {
		// Preserve month/day and viewport position when browsing another decade.
		const nextYear = yearOf(selected) + direction * 10;
		let next = nextYear + selected.slice(4);
		if (new Date(next + 'T00:00:00Z').toISOString().slice(0, 10) !== next)
			next = nextYear + '-02-28';
		const top = viewport.scrollTop;
		const left = viewport.scrollLeft;
		rangeStart = firstYear + direction * 10;
		selection = next;
		await tick();
		viewport.scrollTop = top;
		viewport.scrollLeft = left;
		saveView();
	}

	async function focusDay(key: DateKey, center = false, focus = true) {
		await tick();
		const element = document.getElementById('day-' + key);
		if (focus) element?.focus({ preventScroll: true });
		// Nearest leaves the viewport untouched while the destination is visible.
		element?.scrollIntoView({
			block: center ? 'center' : 'nearest',
			inline: center ? 'center' : 'nearest',
			behavior: 'instant'
		});
		saveView();
	}

	async function goToToday() {
		if (yearOf(today) < firstYear || yearOf(today) > lastYear) rangeStart = yearOf(today) - 5;
		selection = today;
		await focusDay(today, true);
	}

	async function navigateDay(key: DateKey, offset: number, focus = true) {
		const next = addDays(key, offset);
		if (yearOf(next) < firstYear || yearOf(next) > lastYear) return;
		selection = next;
		await focusDay(next, false, focus);
	}

	function activateRoute() {
		if (activeView.section !== 'calendar') {
			restored = true;
			return;
		}
		mode = activeView.mode;
		const view = views[mode];
		void positionView(
			view && view.firstYear === firstYear && view.zoom === zoom ? { ...view, selected } : undefined
		);
	}

	function showView(id: AppViewId) {
		if (activeView.id === id) return;
		const view = APP_VIEWS.find((view) => view.id === id)!;
		return goto(view.path, { reset: false });
	}
	const showLayout = () => showView('layout');
	const showReminders = () => showView('reminders');

	async function navigateTabs(event: KeyboardEvent) {
		const index = APP_VIEWS.findIndex((view) => view.id === activeView.id);
		const positions = {
			Home: 0,
			End: APP_VIEWS.length - 1,
			ArrowLeft: (index + APP_VIEWS.length - 1) % APP_VIEWS.length,
			ArrowRight: (index + 1) % APP_VIEWS.length
		};
		if (!Object.hasOwn(positions, event.key)) return;
		event.preventDefault();
		const next = APP_VIEWS[positions[event.key as keyof typeof positions]];
		await showView(next.id);
		await tick();
		document.getElementById('tab-' + next.id)?.focus();
	}

	function saveReminder(reminder: Reminder): boolean {
		return save(
			'reminders',
			reminders.some((r) => r.id === reminder.id)
				? reminders.map((r) => (r.id === reminder.id ? reminder : r))
				: [...reminders, reminder]
		);
	}

	function completeReminder(day: DateKey, id: string, completed: boolean) {
		save(
			'reminders',
			reminders.map((r) => (r.id === id ? setReminderCompleted(r, day, completed) : r))
		);
	}

	function saveMeasure(measure: Measure): boolean {
		const previous = measures.definitions.find((m) => m.id === measure.id);
		if (previous && previous.type !== measure.type) return false;
		return save('measures', {
			...measures,
			definitions: previous
				? measures.definitions.map((m) => (m.id === measure.id ? measure : m))
				: [...measures.definitions, measure]
		});
	}

	async function setZoom(next: ZoomLevel) {
		if (zoom === next) return;
		clearTimeout(saveTimer);
		const bounds = viewport.getBoundingClientRect();
		const grid = viewport
			.querySelector('.vertical-days, .horizontal-days')
			?.getBoundingClientRect();
		let anchor: Element | null = null;
		if (grid) {
			const x = Math.max(
				grid.left + 6,
				Math.min(bounds.left + viewport.clientWidth / 2, grid.right - 6)
			);
			const y = Math.max(
				grid.top + 6,
				Math.min(bounds.top + viewport.clientHeight / 2, grid.bottom - 6)
			);
			for (const [dx, dy] of [
				[0, 0],
				[4, 0],
				[0, 4],
				[4, 4],
				[-4, -4]
			]) {
				const candidate = document.elementFromPoint(x + dx, y + dy)?.closest('.day');
				if (candidate?.classList.contains('day') && viewport.contains(candidate)) {
					anchor = candidate;
					break;
				}
			}
		}
		const before = anchor?.getBoundingClientRect();
		zoom = next;
		await tick();
		if (anchor && before) {
			const after = anchor.getBoundingClientRect();
			viewport.scrollTop += after.top - before.top;
			viewport.scrollLeft += after.left - before.left;
		}
		saveView();
	}

	function adjustZoom(direction: number) {
		return setZoom(
			ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, zoomIndex + direction))]
		);
	}

	function setEmoji(day: DateKey, value: string) {
		const emoji = normalizeEmoji(value);
		if (emoji === null) return;
		const next = { ...emojis };
		if (emoji) next[day] = emoji;
		else delete next[day];
		save('emojis', next);
	}
</script>

<svelte:head>
	<title>Era</title>
	<meta name="description" content="Personal day timeline." />
</svelte:head>

{#snippet dayEditor(day: DateKey, label: string, navigation = false)}
	<DayPanel
		selected={day}
		{today}
		{firstYear}
		{lastYear}
		{label}
		onNavigate={navigation ? (key, offset) => navigateDay(key, offset, false) : undefined}
		emoji={emojis[day] ?? ''}
		onEmojiChange={(value) => setEmoji(day, value)}
		reminders={reminders.filter((reminder) => reminderOccursOn(reminder, day))}
		onManageReminders={showReminders}
		onCompleteReminder={(id, completed) => completeReminder(day, id, completed)}
		onAddReminder={(text) => saveReminder(createReminder(text, day))}
	>
		<DayWidgets
			data={calendarData}
			{day}
			remoteRevision={(section === 'today' && day === today) ||
			(section === 'calendar' && mode === 'vertical' && day === selected)
				? syncState.remoteRevision
				: 0}
			onmanage={showLayout}
			onchange={(data) => saveData({ ...calendarData, ...data })}
		/>
	</DayPanel>
{/snippet}

<main class="app" aria-label="Era timeline" aria-busy={!restored} style:--cell={cellSize + 'px'}>
	<header class="toolbar">
		<h1>Era</h1>
		<nav class="range-controls" aria-label="Timeline range" hidden={section !== 'calendar'}>
			<button
				type="button"
				aria-label="Previous ten years"
				title="Previous ten years"
				disabled={firstYear <= 1910}
				onclick={() => changeRange(-1)}>←</button
			>
			<span class="range-label" aria-live="polite">{firstYear}–{lastYear}</span>
			<button
				type="button"
				aria-label="Next ten years"
				title="Next ten years"
				disabled={firstYear >= 2090}
				onclick={() => changeRange(1)}>→</button
			>
		</nav>
		<div class="view-tabs" role="tablist" aria-label="View" data-sveltekit-reset="false">
			{#each APP_VIEWS as view (view.id)}
				<a
					href={view.path}
					role="tab"
					id={'tab-' + view.id}
					onkeydown={navigateTabs}
					aria-selected={activeView.id === view.id}
					aria-controls={view.section === 'calendar' ? 'timeline-panel' : view.id + '-panel'}
					tabindex={activeView.id === view.id ? 0 : -1}
					onclick={(event) => {
						if (
							activeView.id === view.id &&
							!event.ctrlKey &&
							!event.metaKey &&
							!event.shiftKey &&
							!event.altKey
						)
							event.preventDefault();
					}}>{view.label}</a
				>
			{/each}
		</div>
		<div
			class="zoom-controls"
			role="group"
			aria-label="Timeline zoom"
			hidden={section !== 'calendar'}
		>
			<button
				type="button"
				aria-label="Zoom out"
				title="Zoom out"
				disabled={zoomIndex === 0}
				onclick={() => adjustZoom(-1)}>−</button
			>
			<button
				type="button"
				class="zoom-readout"
				aria-label="Reset zoom to 100%"
				title="Reset zoom to 100%"
				onclick={() => setZoom(100)}>{zoom}%</button
			>
			<button
				type="button"
				aria-label="Zoom in"
				title="Zoom in"
				disabled={zoomIndex === ZOOM_LEVELS.length - 1}
				onclick={() => adjustZoom(1)}>+</button
			>
		</div>
		<button class="today-button" type="button" onclick={goToToday} hidden={section !== 'calendar'}
			>Today</button
		>
	</header>
	{#if syncState.error}<p role="alert">
			{syncState.error}
			{#if syncState.retryable}<button onclick={flush}>Retry</button>{:else}<button
					onclick={sync.dismiss}>Dismiss</button
				>{/if}
		</p>{/if}
	<div class="calendar-content" hidden={section !== 'calendar'}>
		{#if mode === 'horizontal'}<DayDetail {selected} {today} />{/if}
		<div class={['view-workspace', { 'with-day-panel': mode === 'vertical' }]}>
			<div
				class={['timeline-scroll', mode]}
				style:visibility={restored ? 'visible' : 'hidden'}
				id="timeline-panel"
				bind:this={viewport}
				onscroll={scheduleSave}
				role="tabpanel"
				aria-labelledby={'tab-' + mode}
			>
				<TimelineGrid
					{firstYear}
					{lastYear}
					{today}
					{selected}
					{mode}
					{cellSize}
					emojis={displayedEmojis}
					onSelect={(key) => (selection = key)}
					onNavigate={navigateDay}
				/>
			</div>
			{#if mode === 'vertical'}
				{@render dayEditor(selected, 'Selected day', true)}
			{/if}
		</div>
	</div>
	{#if section === 'today'}
		<div class="today-view" id="today-panel" role="tabpanel" aria-labelledby="tab-today">
			<div class="today-workspace">
				{#each [-1, 0, 1] as offset (offset)}
					{@const day = addDays(today, offset)}
					{@render dayEditor(day, relativeDay(day, today))}
				{/each}
			</div>
		</div>
	{/if}
	{#if section === 'layout'}
		<LayoutManager
			layout={calendarData.layout}
			measures={measures.definitions}
			onsettings={(id, patch) => save('layout', setWidgetSettings(calendarData.layout, id, patch))}
			onsave={saveMeasure}
			ondelete={(id) => save('measures', removeMeasure(measures, id))}
		/>
	{/if}
	{#if section === 'reminders'}
		<RemindersManager
			{reminders}
			{selected}
			{today}
			onsave={saveReminder}
			ondelete={(id) =>
				save(
					'reminders',
					reminders.filter((r) => r.id !== id)
				)}
		/>
	{/if}
	{#if section === 'settings'}
		<SettingsPanel {today} {readExport} {previewImport} {importBackup} />
	{/if}
</main>
