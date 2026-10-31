<script lang="ts">
	import { formatDate, relativeDay, type DateKey } from '../calendar';
	import EmojiSelector from './EmojiSelector.svelte';
	import DayMeasures from './DayMeasures.svelte';
	import type { Measure, MeasureValue } from '../measures';
	import DayReminders from './DayReminders.svelte';
	import type { Reminder } from '../reminders';
	let {
		selected,
		today,
		firstYear,
		lastYear,
		onNavigate,
		emoji,
		onEmojiChange,
		saveError,
		measures,
		measureValues,
		onAddMeasure,
		onMeasureChange,
		onRemoveMeasure,
		onManageMeasures,
		reminders,
		onManageReminders,
		onCompleteReminder,
		onAddReminder
	}: {
		selected: DateKey;
		today: DateKey;
		firstYear: number;
		lastYear: number;
		onNavigate: (key: DateKey, offset: number) => void;
		emoji: string;
		onEmojiChange: (emoji: string) => void;
		saveError: string;
		measures: Measure[];
		measureValues: Record<string, MeasureValue>;
		onAddMeasure: (measure: Measure) => void;
		onMeasureChange: (id: string, value: MeasureValue) => void;
		onRemoveMeasure: (id: string) => void;
		onManageMeasures: () => void;
		reminders: Reminder[];
		onManageReminders: () => void;
		onCompleteReminder: (id: string, completed: boolean) => void;
		onAddReminder: (text: string) => boolean;
	} = $props();
</script>

<aside class="day-panel" aria-label="Selected day">
	<div class="day-panel-heading">
		<EmojiSelector value={emoji} onchange={onEmojiChange} />
		<div class="panel-date" aria-live="polite" aria-atomic="true">
			<h2><time datetime={selected}>{formatDate(selected)}</time></h2>
		</div>
	</div>
	<nav class="day-navigation" aria-label="Day navigation">
		<button
			type="button"
			aria-label="Previous day"
			title="Previous day"
			disabled={selected <= firstYear + '-01-01'}
			onclick={() => onNavigate(selected, -1)}
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 16 16"
				width="16"
				height="16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="m9.5 4-4 4 4 4" /></svg
			>
		</button>
		<button
			type="button"
			aria-label="Next day"
			title="Next day"
			disabled={selected >= lastYear + '-12-31'}
			onclick={() => onNavigate(selected, 1)}
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 16 16"
				width="16"
				height="16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="m6.5 4 4 4-4 4" /></svg
			>
		</button>
		<span class="panel-relative" aria-live="polite">{relativeDay(selected, today)}</span>
	</nav>
	{#if saveError}<p class="emoji-error" role="alert">{saveError}</p>{/if}
	{#key selected}
		<DayMeasures
			{measures}
			values={measureValues}
			onadd={onAddMeasure}
			onchange={onMeasureChange}
			onremove={onRemoveMeasure}
			onmanage={onManageMeasures}
		/>
	{/key}
	{#key selected}
		<DayReminders
			{reminders}
			{selected}
			onmanage={onManageReminders}
			oncomplete={onCompleteReminder}
			onadd={onAddReminder}
		/>
	{/key}
</aside>
