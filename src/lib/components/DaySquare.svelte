<script lang="ts">
	import { formatDate, relativeDay, yearOf, type CalendarDay, type DateKey } from '../calendar';
	let {
		day,
		today,
		selected,
		emoji = '',
		horizontalStep,
		verticalStep,
		onSelect,
		onNavigate
	}: {
		day: CalendarDay;
		today: DateKey;
		selected: DateKey;
		emoji?: string;
		horizontalStep: number;
		verticalStep: number;
		onSelect: (key: DateKey) => void;
		onNavigate: (key: DateKey, offset: number) => void;
	} = $props();
	const colors = ['#829e91', '#a0a47f', '#a38b7f', '#8998af', '#a08da5'];

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
			past: day.key < today,
			today: day.key === today,
			selected: day.key === selected,
			'has-emoji': Boolean(emoji)
		}
	]}
	style:--year-color={colors[yearOf(day.key) % colors.length]}
	aria-label={formatDate(day.key) +
		' · ' +
		relativeDay(day.key, today) +
		(emoji ? ' · ' + emoji : '')}
	aria-pressed={day.key === selected}
	aria-current={day.key === today ? 'date' : undefined}
	title={formatDate(day.key)}
	tabindex={day.key === selected ? 0 : -1}
	onclick={() => onSelect(day.key)}
	onkeydown={navigate}
	>{#if emoji}<span class="day-emoji" aria-hidden="true">{emoji}</span>{/if}</button
>
