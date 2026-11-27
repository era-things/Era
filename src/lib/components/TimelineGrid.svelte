<script lang="ts">
	import {
		asDate,
		daysBetween,
		daysInRange,
		weekdayOffset,
		yearOf,
		type DateKey
	} from '../calendar';
	import type { ViewMode } from '../view-state';
	import type { DayEmojis } from '../day-emojis';
	import type { Era, EraDays } from '../eras';
	import { timelineEraColors } from '../timeline-eras';
	import DaySquare from './DaySquare.svelte';

	let {
		firstYear,
		lastYear,
		dayLimit,
		today,
		selected,
		mode,
		cellSize,
		emojis,
		eras,
		eraDays,
		markRange,
		onSelect,
		onNavigate
	}: {
		firstYear: number;
		lastYear: number;
		dayLimit?: number;
		today: DateKey;
		selected: DateKey;
		mode: ViewMode;
		cellSize: number;
		emojis: DayEmojis;
		eras?: Era[];
		eraDays: EraDays;
		markRange?: readonly [DateKey, DateKey];
		onSelect: (key: DateKey, extend?: boolean) => void;
		onNavigate: (key: DateKey, offset: number) => void;
	} = $props();
	let verticalGrid = $state<HTMLDivElement>();
	let verticalColumns = $state(28);
	const range = $derived(daysInRange(firstYear, lastYear));
	const days = $derived.by(() => {
		if (dayLimit === undefined || dayLimit >= range.length) return range;
		const center = Math.floor(dayLimit / 2);
		const selectedIndex = daysBetween(range[0].key, selected);
		const todayIndex = daysBetween(range[0].key, today);
		const recentStart = Math.max(0, Math.min(todayIndex - center, range.length - dayLimit));
		const start =
			selectedIndex >= recentStart && selectedIndex < recentStart + dayLimit
				? recentStart
				: Math.max(0, Math.min(selectedIndex - center, range.length - dayLimit));
		return range.slice(start, start + dayLimit);
	});
	const firstVisibleYear = $derived(yearOf(days[0].key));
	const lastVisibleYear = $derived(yearOf(days[days.length - 1].key));
	const padding = $derived(weekdayOffset(days[0].key));
	const weekCount = $derived(Math.ceil((padding + days.length) / 7));
	const years = $derived(
		Array.from({ length: lastVisibleYear - firstVisibleYear + 1 }, (_, index) => ({
			year: firstVisibleYear + index,
			offset: Math.max(
				0,
				daysBetween(days[0].key, String(firstVisibleYear + index).padStart(4, '0') + '-01-01')
			)
		}))
	);
	const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
	const months = $derived.by(() => {
		const first = days[0].key;
		const last = days[days.length - 1].key;
		const month = asDate(first);
		month.setUTCDate(1);
		const labels: { date: DateKey; column: number; label?: string; year?: number }[] = [];
		for (let date = month.toISOString().slice(0, 10); date <= last;) {
			const offset = Math.max(0, daysBetween(first, date));
			const january = month.getUTCMonth() === 0;
			labels.push({
				date,
				column: Math.floor((padding + offset) / 7) + 1,
				label: january ? undefined : monthFormat.format(month),
				year: offset === 0 || january ? month.getUTCFullYear() : undefined
			});
			month.setUTCMonth(month.getUTCMonth() + 1);
			date = month.toISOString().slice(0, 10);
		}
		return labels;
	});
	const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const eraColors = $derived(eras?.length ? timelineEraColors(eras, eraDays) : undefined);

	$effect(() => {
		cellSize;
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
			{#each months as entry (entry.date)}
				<div class="horizontal-month-marker" style:grid-column={entry.column}>
					{#if entry.year !== undefined}
						<h2 class:current-year={entry.year === yearOf(today)}>{entry.year}</h2>
					{/if}
					{#if entry.label}<time datetime={entry.date.slice(0, 7)}>{entry.label}</time>{/if}
				</div>
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
					emoji={emojis[day.key] ?? ''}
					eraColors={eraColors?.[day.key]}
					inRange={markRange && day.key >= markRange[0] && day.key <= markRange[1]}
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
					emoji={emojis[day.key] ?? ''}
					{onSelect}
					{onNavigate}
					horizontalStep={1}
					verticalStep={verticalColumns}
				/>
			{/each}
		</div>
	</div>
{/if}
