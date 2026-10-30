<script lang="ts">
	import { daysBetween, daysInRange, weekdayOffset, yearOf, type DateKey } from '../calendar';
	import type { ViewMode } from '../view-state';
	import DaySquare from './DaySquare.svelte';

	let {
		firstYear,
		lastYear,
		today,
		selected,
		mode,
		onSelect,
		onNavigate
	}: {
		firstYear: number;
		lastYear: number;
		today: DateKey;
		selected: DateKey;
		mode: ViewMode;
		onSelect: (key: DateKey) => void;
		onNavigate: (key: DateKey, offset: number) => void;
	} = $props();
	let verticalGrid = $state<HTMLDivElement>();
	let verticalColumns = $state(28);
	const days = $derived(daysInRange(firstYear, lastYear));
	const padding = $derived(weekdayOffset(days[0].key));
	const weekCount = $derived(Math.ceil((padding + days.length) / 7));
	const years = $derived(
		Array.from({ length: lastYear - firstYear + 1 }, (_, index) => ({
			year: firstYear + index,
			offset: daysBetween(days[0].key, firstYear + index + '-01-01')
		}))
	);
	const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	$effect(() => {
		if (!verticalGrid) return;
		const grid = verticalGrid;
		const updateColumns = () => {
			verticalColumns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
		};
		updateColumns();
		const observer = new ResizeObserver(updateColumns);
		observer.observe(grid);
		return () => observer.disconnect();
	});
</script>

{#if mode === 'horizontal'}
	<div class="horizontal-timeline">
		<div
			class="horizontal-years"
			style:grid-template-columns={'repeat(' + weekCount + ', var(--cell))'}
		>
			{#each years as entry (entry.year)}
				<h2
					class:current-year={entry.year === yearOf(today)}
					style:grid-column={Math.floor((padding + entry.offset) / 7) + 1}
				>
					{entry.year}
				</h2>
			{/each}
		</div>
		<div class="weekday-labels" aria-hidden="true">
			{#each weekdays as weekday}<span>{weekday}</span>{/each}
		</div>
		<div
			class="horizontal-days"
			role="group"
			aria-label="Days aligned by weekday"
			style:grid-template-columns={'repeat(' + weekCount + ', var(--cell))'}
		>
			{#each Array(padding) as _, index (index)}<span aria-hidden="true"></span>{/each}
			{#each days as day (day.key)}
				<DaySquare
					{day}
					{today}
					{selected}
					{onSelect}
					{onNavigate}
					horizontalStep={7}
					verticalStep={1}
				/>
			{/each}
		</div>
	</div>
{:else}
	<div class="vertical-timeline">
		<div class="vertical-years">
			{#each years as entry (entry.year)}
				<h2
					class:current-year={entry.year === yearOf(today)}
					style:top={'calc(' +
						Math.floor(entry.offset / verticalColumns) +
						' * (var(--cell) + var(--gap)))'}
				>
					{entry.year}
				</h2>
			{/each}
		</div>
		<div
			class="vertical-days"
			bind:this={verticalGrid}
			role="group"
			aria-label="Days in date order"
		>
			{#each days as day (day.key)}
				<DaySquare
					{day}
					{today}
					{selected}
					{onSelect}
					{onNavigate}
					horizontalStep={1}
					verticalStep={verticalColumns}
				/>
			{/each}
		</div>
	</div>
{/if}
