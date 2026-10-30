<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { PageData } from './$types';
	import TimelineGrid from '../lib/components/TimelineGrid.svelte';
	import DayDetail from '../lib/components/DayDetail.svelte';
	import { addDays, localToday, yearOf, type DateKey } from '../lib/calendar';
	import { parseSavedView, VIEW_STORAGE_KEY, type ViewMode } from '../lib/view-state';

	let { data }: { data: PageData } = $props();
	let browserToday = $state<DateKey | null>(null);
	let rangeStart = $state<number | null>(null);
	let selection = $state<DateKey | null>(null);
	let restored = $state(false);
	let mode = $state<ViewMode>('vertical');
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

	async function focusDay(key: DateKey, center = false) {
		await tick();
		const element = document.getElementById('day-' + key);
		element?.focus({ preventScroll: true });
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

	async function navigateDay(key: DateKey, offset: number) {
		const next = addDays(key, offset);
		if (yearOf(next) < firstYear || yearOf(next) > lastYear) return;
		selection = next;
		await focusDay(next);
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
</script>

<svelte:head>
	<title>Era</title>
	<meta name="description" content="Personal day timeline." />
</svelte:head>

<main class="app" aria-label="Era timeline">
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
		<button class="today-button" type="button" onclick={goToToday}>Today</button>
	</header>
	<DayDetail {selected} {today} />
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
			onSelect={(key) => (selection = key)}
			onNavigate={navigateDay}
		/>
	</div>
</main>
