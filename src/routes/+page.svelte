<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { PageData } from './$types';
	import TimelineGrid from '../lib/components/TimelineGrid.svelte';
	import DayDetail from '../lib/components/DayDetail.svelte';
	import DayPanel from '../lib/components/DayPanel.svelte';
	import { addDays, localToday, yearOf, type DateKey } from '../lib/calendar';
	import {
		parseSavedView,
		VIEW_STORAGE_KEY,
		ZOOM_LEVELS,
		type ViewMode,
		type ZoomLevel
	} from '../lib/view-state';

	let { data }: { data: PageData } = $props();
	let browserToday = $state<DateKey | null>(null);
	let rangeStart = $state<number | null>(null);
	let selection = $state<DateKey | null>(null);
	let restored = $state(false);
	let mode = $state<ViewMode>('vertical');
	let zoom = $state<ZoomLevel>(100);
	const cellSize = $derived((24 * zoom) / 100);
	const zoomIndex = $derived(ZOOM_LEVELS.indexOf(zoom));
	let viewport: HTMLDivElement;
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	const today = $derived(browserToday ?? data.today);
	const firstYear = $derived(rangeStart ?? yearOf(today) - 5);
	const lastYear = $derived(firstYear + 9);
	const selected = $derived(selection ?? today);

	function saveView() {
		if (!restored || !viewport) return;
		try {
			localStorage.setItem(
				VIEW_STORAGE_KEY,
				JSON.stringify({
					version: 3,
					mode,
					zoom,
					firstYear,
					selected,
					scrollTop: viewport.scrollTop,
					scrollLeft: viewport.scrollLeft
				})
			);
		} catch {
			/* The timeline works when browser storage is unavailable. */
		}
	}

	function scheduleSave() {
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
		let active = true;
		const refreshToday = () => {
			browserToday = localToday();
		};
		refreshToday();
		let saved = null;
		try {
			saved = parseSavedView(localStorage.getItem(VIEW_STORAGE_KEY));
		} catch {
			/* Use today. */
		}
		if (saved) {
			rangeStart = saved.firstYear;
			selection = saved.selected;
			mode = saved.mode;
			zoom = saved.zoom;
		}
		const initialView = saved;
		void tick().then(() => {
			if (!active) return;
			if (initialView) {
				viewport.scrollTop = initialView.scrollTop;
				viewport.scrollLeft = initialView.scrollLeft;
			} else {
				document
					.getElementById('day-' + today)
					?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
			}
			restored = true;
		});
		const timer = window.setInterval(refreshToday, 60_000);
		window.addEventListener('focus', refreshToday);
		window.addEventListener('pagehide', saveView);
		return () => {
			saveView();
			active = false;
			clearTimeout(saveTimer);
			window.clearInterval(timer);
			window.removeEventListener('focus', refreshToday);
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

	async function changeMode(next: ViewMode) {
		if (mode === next) return;
		clearTimeout(saveTimer);
		mode = next;
		await tick();
		document
			.getElementById('day-' + selected)
			?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
		saveView();
	}

	async function navigateTabs(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const next =
			event.key === 'Home'
				? 'horizontal'
				: event.key === 'End'
					? 'vertical'
					: mode === 'horizontal'
						? 'vertical'
						: 'horizontal';
		await changeMode(next);
		document.getElementById('tab-' + next)?.focus();
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
				const candidate = document.elementFromPoint(x + dx, y + dy);
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
</script>

<svelte:head>
	<title>Era</title>
	<meta name="description" content="Personal day timeline." />
</svelte:head>

<main class="app" aria-label="Era timeline" style:--cell={cellSize + 'px'}>
	<header class="toolbar">
		<h1>Era</h1>
		<nav class="range-controls" aria-label="Timeline range">
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
		<div class="view-tabs" role="tablist" aria-label="Timeline view">
			<button
				type="button"
				role="tab"
				id="tab-horizontal"
				onkeydown={navigateTabs}
				aria-selected={mode === 'horizontal'}
				aria-controls="timeline-panel"
				tabindex={mode === 'horizontal' ? 0 : -1}
				onclick={() => changeMode('horizontal')}>Weekdays</button
			>
			<button
				type="button"
				role="tab"
				id="tab-vertical"
				onkeydown={navigateTabs}
				aria-selected={mode === 'vertical'}
				aria-controls="timeline-panel"
				tabindex={mode === 'vertical' ? 0 : -1}
				onclick={() => changeMode('vertical')}>Grid</button
			>
		</div>
		<div class="zoom-controls" role="group" aria-label="Timeline zoom">
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
		<button class="today-button" type="button" onclick={goToToday}>Today</button>
	</header>
	{#if mode === 'horizontal'}<DayDetail {selected} {today} />{/if}
	<div class={['view-workspace', { 'with-day-panel': mode === 'vertical' }]}>
		<div
			class={['timeline-scroll', mode]}
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
				onSelect={(key) => (selection = key)}
				onNavigate={navigateDay}
			/>
		</div>
		{#if mode === 'vertical'}
			<DayPanel
				{selected}
				{today}
				{firstYear}
				{lastYear}
				onNavigate={(key, offset) => navigateDay(key, offset, false)}
			/>
		{/if}
	</div>
</main>
