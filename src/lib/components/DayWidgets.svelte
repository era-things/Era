<script lang="ts">
	import type { DateKey } from '../calendar';
	import type { CalendarData } from '../data-export';
	import {
		WIDGETS,
		attachWidget,
		canAttachWidget,
		dayWidget,
		isVisible,
		setWidgetValue,
		type WidgetId,
		type WidgetData
	} from '../widgets';
	import { previousNutritionItems } from '../nutrition';
	import { paletteFor, setDayMeasure, type MeasureValue } from '../measures';
	import BuiltInWidget from './BuiltInWidget.svelte';
	import DayMeasures from './DayMeasures.svelte';
	import GitHubActivityWidget from './GitHubActivityWidget.svelte';
	let {
		data,
		day,
		onchange,
		onmanage
	}: {
		data: WidgetData & Pick<CalendarData, 'githubActivity'>;
		day: DateKey;
		onchange: (data: WidgetData) => boolean;
		onmanage: () => void;
	} = $props();
	let choosing = $state(false);
	const visible = $derived(WIDGETS.filter(({ id }) => isVisible(data, day, id)));
	const timeWidgets = $derived(visible.filter(({ placement }) => placement === 'time'));
	const mainWidgets = $derived(visible.filter(({ placement }) => placement === 'main'));
	const footerWidgets = $derived(visible.filter(({ placement }) => placement === 'footer'));
	const gitHubActivity = $derived(data.githubActivity[day]);
	const history = $derived.by(() => {
		const nutrition = { ...data.nutrition };
		for (const [date, values] of Object.entries(data.automated)) {
			if (values.nutrition !== undefined) nutrition[date] = values.nutrition;
		}
		return previousNutritionItems(nutrition, day);
	});
	const measureValues = $derived(data.measures.days[day] ?? {});
	const attached = $derived(
		data.measures.definitions.filter(({ id }) => Object.hasOwn(measureValues, id))
	);
	function changeMeasure(id: string, value?: MeasureValue) {
		onchange({ ...data, measures: setDayMeasure(data.measures, day, id, value) });
	}
	const choices = $derived([
		...WIDGETS.filter(({ id }) => canAttachWidget(data, day, id)).map(({ id, name }) => ({
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

{#snippet widget(id: WidgetId)}
	<BuiltInWidget
		widget={dayWidget(data, day, id)}
		{history}
		readonly={data.automated[day]?.[id] !== undefined}
		onchange={(value) => onchange(setWidgetValue(data, day, id, value))}
	/>
{/snippet}

<section class="day-widget-stack" aria-label="Day widgets">
	{#if mainWidgets.length || timeWidgets.length || gitHubActivity}
		<div class="day-widgets">
			{#each mainWidgets as definition (definition.id)}
				<div class:compact-widget={definition.compact} class:full-widget={!definition.compact}>
					{@render widget(definition.id)}
				</div>
			{/each}
			{#if timeWidgets.length}
				<div class="full-widget time-widget-block" role="group" aria-label="Hours in a day">
					{#each timeWidgets as definition (definition.id)}
						<div class="time-widget-row">
							{@render widget(definition.id)}
						</div>
					{/each}
				</div>
			{/if}
			{#if gitHubActivity}
				<div class="full-widget"><GitHubActivityWidget activity={gitHubActivity} /></div>
			{/if}
		</div>
	{/if}
	{#if attached.length}<DayMeasures
			measures={attached}
			values={measureValues}
			onchange={changeMeasure}
			onremove={(id) => changeMeasure(id)}
		/>{/if}
	{#each footerWidgets as definition (definition.id)}
		{@render widget(definition.id)}
	{/each}
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
	.time-widget-block {
		overflow: clip;
		border-radius: 4px;
	}
	.time-widget-row :global(.sleep-widget),
	.time-widget-row :global(.time-widget) {
		border-radius: 0;
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
