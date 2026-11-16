<script lang="ts">
	import type { DateKey } from '../calendar';
	import {
		WIDGETS,
		attachWidget,
		dayWidget,
		isVisible,
		setWidgetValue,
		type WidgetData
	} from '../widgets';
	import { previousNutritionItems } from '../nutrition';
	import { paletteFor, setDayMeasure, type MeasureValue } from '../measures';
	import BuiltInWidget from './BuiltInWidget.svelte';
	import DayMeasures from './DayMeasures.svelte';
	let {
		data,
		day,
		onchange,
		onmanage
	}: {
		data: WidgetData;
		day: DateKey;
		onchange: (data: WidgetData) => boolean;
		onmanage: () => void;
	} = $props();
	let choosing = $state(false);
	const visible = $derived(WIDGETS.filter(({ id }) => isVisible(data, day, id)));
	const history = $derived(previousNutritionItems(data.nutrition, day));
	const measureValues = $derived(data.measures.days[day] ?? {});
	const attached = $derived(
		data.measures.definitions.filter(({ id }) => Object.hasOwn(measureValues, id))
	);
	function changeMeasure(id: string, value?: MeasureValue) {
		onchange({ ...data, measures: setDayMeasure(data.measures, day, id, value) });
	}
	const choices = $derived([
		...WIDGETS.filter(({ id }) => !isVisible(data, day, id)).map(({ id, name }) => ({
			id: 'widget-' + id,
			name,
			color: '',
			add: () => onchange(attachWidget(data, day, id))
		})),
		...data.measures.definitions
			.filter(({ id }) => !Object.hasOwn(measureValues, id))
			.map((measure) => ({
				...measure,
				id: 'measure-' + measure.id,
				color: paletteFor(measure.palette).bright,
				add: () => changeMeasure(measure.id, measure.type === 'boolean' ? false : 0)
			}))
	]);
</script>

<section class="day-widget-stack" aria-label="Day widgets">
	{#if visible.some(({ id }) => id !== 'note')}
		<div class="day-widgets">
			{#each visible.filter(({ id }) => id !== 'note') as definition (definition.id)}
				<div
					class:compact-widget={definition.compact}
					class:full-widget={!definition.compact}
					class:sleep-compact={definition.id === 'sleep'}
				>
					<BuiltInWidget
						widget={dayWidget(data, day, definition.id)}
						{history}
						onchange={(value) => onchange(setWidgetValue(data, day, definition.id, value))}
					/>
				</div>
			{/each}
		</div>
	{/if}
	{#if attached.length}<DayMeasures
			measures={attached}
			values={measureValues}
			onchange={changeMeasure}
			onremove={(id) => changeMeasure(id)}
		/>{/if}
	{#if isVisible(data, day, 'note')}<BuiltInWidget
			widget={dayWidget(data, day, 'note')}
			onchange={(value) => onchange(setWidgetValue(data, day, 'note', value as string))}
		/>{/if}
	{#if choosing}<div class="widget-chooser">
			{#each choices as choice (choice.id)}<button
					type="button"
					onclick={() => {
						choice.add();
						choosing = false;
					}}
				>
					{#if choice.color}<span class="swatch" style:background={choice.color}
						></span>{/if}{choice.name}
				</button>{/each}
			{#if !choices.length}<p>All widgets added.</p>{/if}
			<button type="button" class="manage-button" onclick={onmanage}>Layout settings</button>
		</div>{/if}
	<button
		class="add-button"
		type="button"
		aria-label="Add widget"
		aria-expanded={choosing}
		onclick={() => (choosing = !choosing)}>+</button
	>
</section>

<style>
	.day-widget-stack {
		display: grid;
		gap: 10px;
		margin-top: 10px;
	}
	.day-widgets {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 14px;
	}
	.full-widget {
		flex: 0 0 100%;
		min-width: 0;
	}
	.compact-widget {
		flex: 1 1 calc((100% - 20px) / 3);
		min-width: min(120px, 100%);
	}
	.sleep-compact {
		min-width: min(148px, 100%);
	}
	button {
		border: 0;
		background: transparent;
		border-radius: 3px;
	}
	button:hover {
		background: #dfe7da;
	}
	.add-button {
		width: 100%;
		height: 28px;
		border-radius: 3px 3px 10px 10px;
		font-size: 20px;
		font-weight: 700;
		color: color-mix(in srgb, var(--muted) 55%, transparent);
		background: #e9ede6;
	}
	.widget-chooser {
		border: 1px solid var(--line);
		border-radius: 4px;
		padding: 4px;
	}
	.widget-chooser button {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		text-align: left;
		padding: 8px;
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	.swatch {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.widget-chooser p {
		margin: 8px;
		font-size: 12px;
		color: var(--muted);
	}
	.manage-button {
		color: var(--muted);
	}
</style>
