<script lang="ts">
	import { formatDate, relativeDay, yearOf, type CalendarDay, type DateKey } from '../calendar';
	import { eraOverlapFill, type EraDayColor } from '../timeline-eras';
	let {
		day,
		today,
		selected,
		emoji = '',
		eraColors,
		inRange = false,
		horizontalStep,
		verticalStep,
		onSelect,
		onNavigate
	}: {
		day: CalendarDay;
		today: DateKey;
		selected: DateKey;
		emoji?: string;
		eraColors?: EraDayColor[];
		horizontalStep: number;
		verticalStep: number;
		inRange?: boolean;
		onSelect: (key: DateKey, extend?: boolean) => void;
		onNavigate: (key: DateKey, offset: number) => void;
	} = $props();
	const dateLabel = $derived(formatDate(day.key));
	const future = $derived(day.key > today);
	const overlap = $derived(eraColors !== undefined && eraColors.length > 1);
	const eraColor = $derived(eraColors?.[0]);
	const eraState = $derived(
		!eraColor
			? undefined
			: overlap
				? 'overlap'
				: eraColor.intensity === 0
					? 'marked'
					: eraColor.intensity === 1
						? 'bold'
						: 'graded'
	);
	const eraDetail = $derived(eraColors?.map(({ detail }) => detail).join(' · '));
	const overlapFill = $derived(
		overlap && eraColors ? eraOverlapFill(eraColors, future) : undefined
	);

	function navigate(event: KeyboardEvent) {
		const offsets: Record<string, number> = {
			ArrowUp: -verticalStep,
			ArrowDown: verticalStep,
			ArrowLeft: -horizontalStep,
			ArrowRight: horizontalStep
		};
		if (event.key in offsets) {
			event.preventDefault();
			onNavigate(day.key, offsets[event.key]);
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			onNavigate(yearOf(day.key) + (event.key === 'Home' ? '-01-01' : '-12-31'), 0);
		}
	}
</script>

<button
	type="button"
	id={'day-' + day.key}
	class={[
		'day',
		{
			future,
			'dark-year': yearOf(day.key) % 2 === 0,
			today: day.key === today,
			selected: day.key === selected,
			'range-day': inRange,
			'has-emoji': Boolean(emoji)
		}
	]}
	data-era-state={eraState}
	style:--era-fill={overlap ? undefined : eraColor?.color}
	style:--era-overlap-fill={overlapFill}
	aria-label={dateLabel +
		' · ' +
		relativeDay(day.key, today) +
		(emoji ? ' · ' + emoji : '') +
		(eraDetail ? ' · ' + eraDetail : '')}
	aria-pressed={day.key === selected}
	aria-current={day.key === today ? 'date' : undefined}
	title={dateLabel + (eraDetail ? ' · ' + eraDetail : '')}
	tabindex={day.key === selected ? 0 : -1}
	onclick={(event) => onSelect(day.key, event.shiftKey)}
	onkeydown={navigate}
	>{#if emoji}<span class="day-emoji" aria-hidden="true">{emoji}</span>{/if}</button
>
