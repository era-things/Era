<script lang="ts">
	import { formatDate, relativeDay, type DateKey } from '../calendar';
	import EmojiSelector from './EmojiSelector.svelte';
	import DayMeasures from './DayMeasures.svelte';
	import type { Measure, MeasureValue } from '../measures';
	import DayReminders from './DayReminders.svelte';
	import type { Reminder } from '../reminders';
	import NutritionPanel from './NutritionPanel.svelte';
	import type { FoodItem } from '../nutrition';
	import MarkdownNote from './MarkdownNote.svelte';
	import CounterWidget from './CounterWidget.svelte';
	import { COUNTERS, type CounterId, type CountersState } from '../counters';
	import { BUILT_IN_MEASURES, type BuiltInMeasureId } from '../built-in-measures';
	let {
		selected,
		today,
		firstYear,
		lastYear,
		label = 'Selected day',
		onNavigate,
		emoji,
		onEmojiChange,
		measures,
		measureValues,
		onAddMeasure,
		onMeasureChange,
		onRemoveMeasure,
		onManageMeasures,
		reminders,
		onManageReminders,
		onCompleteReminder,
		onAddReminder,
		nutritionPinned,
		nutritionItems,
		nutritionHistory,
		onNutritionChange,
		note,
		onNoteChange,
		counters,
		onCounterChange,
		nutritionAttached,
		onAddBuiltIn
	}: {
		selected: DateKey;
		today: DateKey;
		firstYear: number;
		lastYear: number;
		label?: string;
		onNavigate?: (key: DateKey, offset: number) => void;
		emoji: string;
		onEmojiChange: (emoji: string) => void;
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
		nutritionPinned: boolean;
		nutritionItems: FoodItem[];
		nutritionHistory: FoodItem[];
		onNutritionChange: (items: FoodItem[]) => boolean;
		note: string;
		onNoteChange: (text: string) => void;
		counters: CountersState;
		onCounterChange: (id: CounterId, value: number | null) => void;
		nutritionAttached: boolean;
		onAddBuiltIn: (id: BuiltInMeasureId) => void;
	} = $props();
	const showNutrition = $derived(nutritionPinned || nutritionAttached);
	const visibleCounters = $derived(
		COUNTERS.filter(
			({ id }) => counters.pinned[id] || Object.hasOwn(counters.days[selected] ?? {}, id)
		)
	);
	const availableBuiltIns = $derived(
		BUILT_IN_MEASURES.filter(({ id }) =>
			id === 'nutrition' ? !showNutrition : !visibleCounters.some((counter) => counter.id === id)
		)
	);
</script>

<aside class="day-panel" aria-label={label}>
	<div class="day-panel-heading">
		<EmojiSelector value={emoji} onchange={onEmojiChange} />
		<div class="panel-date" aria-live="polite" aria-atomic="true">
			<h2><time datetime={selected}>{formatDate(selected)}</time></h2>
		</div>
	</div>
	{#if onNavigate}
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
	{/if}
	{#key selected}
		{#if showNutrition || visibleCounters.length}
			<div class="day-widgets">
				{#if showNutrition}<div class="full-widget">
						<NutritionPanel
							items={nutritionItems}
							history={nutritionHistory}
							onchange={onNutritionChange}
						/>
					</div>{/if}
				{#each visibleCounters as counter (counter.id)}
					<div class="compact-widget">
						<CounterWidget
							{counter}
							value={counters.days[selected]?.[counter.id]}
							onchange={(value) => onCounterChange(counter.id, value)}
						/>
					</div>
				{/each}
			</div>
		{/if}
		<DayMeasures
			{availableBuiltIns}
			onaddBuiltIn={onAddBuiltIn}
			{measures}
			values={measureValues}
			onadd={onAddMeasure}
			onchange={onMeasureChange}
			onremove={onRemoveMeasure}
			onmanage={onManageMeasures}
		>
			<MarkdownNote value={note} onchange={onNoteChange} />
		</DayMeasures>
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

<style>
	.day-widgets {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 24px;
	}
	.full-widget {
		flex: 0 0 100%;
		min-width: 0;
	}
	.compact-widget {
		flex: 1 1 calc((100% - 20px) / 3);
		min-width: min(120px, 100%);
	}
</style>
