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
	import { nutritionTotals, previousNutritionItems } from '../nutrition';
	import { paletteFor, setDayMeasure, type MeasureValue } from '../measures';
	import { highlightRemote, pop, reflow } from '../widget-motion';
	import BuiltInWidget from './BuiltInWidget.svelte';
	import DayMeasures, { type DayMeasure } from './DayMeasures.svelte';
	import GitHubActivityWidget from './GitHubActivityWidget.svelte';
	import TimeWidget from './TimeWidget.svelte';
	import { eraPalette, type Era, type EraDay, type EraValueKind, type EraValues } from '../eras';
	let {
		data,
		day,
		remoteRevision,
		onchange,
		onmanage,
		eras,
		eraEntries,
		onEraValue
	}: {
		data: WidgetData & Pick<CalendarData, 'githubActivity'>;
		day: DateKey;
		remoteRevision: number;
		onchange: (data: WidgetData) => boolean;
		onmanage: () => void;
		eras: Era[];
		eraEntries: Record<string, EraDay>;
		onEraValue: <K extends EraValueKind>(
			id: string,
			kind: K,
			value: EraValues[K] | null
		) => boolean;
	} = $props();
	let choosing = $state(false);
	let draftTimers = $state<string[]>([]);
	let draftNumbers = $state<string[]>([]);
	const eraTimers = $derived(
		eras.filter(
			({ id, linkedValue }) =>
				linkedValue === 'hours' &&
				(eraEntries[id]?.values?.hours !== undefined || draftTimers.includes(id))
		)
	);
	function changeEraTime(id: string, minutes: number | null) {
		const accepted = onEraValue(id, 'hours', minutes);
		if (accepted && draftTimers.includes(id))
			draftTimers = draftTimers.filter((item) => item !== id);
		return accepted;
	}
	function focusDraft(node: HTMLElement, draft: boolean) {
		if (draft) node.querySelector('input')?.focus();
	}
	const visible = $derived(WIDGETS.filter(({ id }) => isVisible(data, day, id)));
	const timeWidgets = $derived(visible.filter(({ placement }) => placement === 'time'));
	const mainWidgets = $derived(visible.filter(({ placement }) => placement === 'main'));
	const footerWidgets = $derived(visible.filter(({ placement }) => placement === 'footer'));
	const gitHubActivity = $derived(data.githubActivity[day]);
	function highlightValue(id: WidgetId) {
		const widget = dayWidget(data, day, id);
		switch (widget.kind) {
			case 'sleep':
				return JSON.stringify(widget.value);
			case 'nutrition':
				return JSON.stringify(nutritionTotals(widget.value));
			case 'time':
			case 'counter':
				return widget.value;
			default:
				return undefined;
		}
	}
	const history = $derived.by(() => {
		const nutrition = { ...data.nutrition };
		for (const [date, values] of Object.entries(data.automated)) {
			if (values.nutrition !== undefined) nutrition[date] = values.nutrition;
		}
		return previousNutritionItems(nutrition, day);
	});
	const measureValues = $derived(data.measures.days[day] ?? {});
	const attached = $derived<DayMeasure[]>(
		data.measures.definitions
			.filter(({ id }) => Object.hasOwn(measureValues, id))
			.map((measure) => ({
				...measure,
				id: 'measure-' + measure.id,
				value: measureValues[measure.id],
				onchange: (value) => changeMeasure(measure.id, value),
				onremove: () => changeMeasure(measure.id)
			}))
	);
	function changeMeasure(id: string, value?: MeasureValue) {
		onchange({ ...data, measures: setDayMeasure(data.measures, day, id, value) });
	}
	const eraMeasures = $derived.by(() => {
		const cards: DayMeasure[] = [];
		const choices: { id: string; name: string; color: string; add: () => void }[] = [];
		for (const { id, linkedValue: kind, name, archived, palette } of eras) {
			if (kind !== 'boolean' && kind !== 'number') continue;
			const cardId = 'era-' + kind + '-' + id;
			const color = eraPalette({ palette });
			const value = eraEntries[id]?.values?.[kind];
			if (value !== undefined || (kind === 'number' && draftNumbers.includes(id))) {
				const change = (next: MeasureValue) => {
					if (onEraValue(id, kind, next) && kind === 'number' && draftNumbers.includes(id))
						draftNumbers = draftNumbers.filter((draft) => draft !== id);
				};
				cards.push({
					id: cardId,
					name,
					type: kind,
					palette: color.id,
					value: value ?? null,
					onchange: change,
					onremove: () => change(null)
				});
			} else if (!archived) {
				choices.push({
					id: cardId,
					name,
					color: color.bright,
					add: () => {
						if (kind === 'number') draftNumbers = [...draftNumbers, id];
						else onEraValue(id, 'boolean', false);
					}
				});
			}
		}
		return { cards, choices };
	});
	const choices = $derived([
		...WIDGETS.filter(({ id }) => canAttachWidget(data, day, id)).map(({ id, name }) => ({
			id: 'widget-' + id,
			name,
			color: '',
			add: () => onchange(attachWidget(data, day, id))
		})),
		...eras
			.filter((era) => era.linkedValue === 'hours' && !era.archived && !eraTimers.includes(era))
			.map((era) => ({
				id: 'era-timer-' + era.id,
				name: era.name + ' timer',
				color: eraPalette(era).bright,
				add: () => (draftTimers = [...draftTimers, era.id])
			})),
		...eraMeasures.choices,
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

<section class="day-widget-stack" aria-label="Day widgets" use:reflow>
	<div class="day-widgets" use:reflow>
		{#each mainWidgets as definition (definition.id)}
			<div
				class:compact-widget={definition.compact}
				class:full-widget={!definition.compact}
				use:highlightRemote={{ revision: remoteRevision, value: highlightValue(definition.id) }}
				transition:pop
			>
				{@render widget(definition.id)}
			</div>
		{/each}
		<div class="time-widget-block" role="group" aria-label="Hours in a day" use:reflow>
			{#each timeWidgets as definition (definition.id)}
				<div
					class="time-widget-row"
					use:highlightRemote={{ revision: remoteRevision, value: highlightValue(definition.id) }}
					transition:pop
				>
					{@render widget(definition.id)}
				</div>
			{/each}
			{#each eraTimers as era (era.id)}
				<div
					class="time-widget-row"
					use:focusDraft={draftTimers.includes(era.id)}
					use:highlightRemote={{
						revision: remoteRevision,
						value: eraEntries[era.id]?.values?.hours
					}}
				>
					<TimeWidget
						era={{ ...era, remove: () => changeEraTime(era.id, null) }}
						value={eraEntries[era.id]?.values?.hours ?? null}
						onchange={(minutes) => changeEraTime(era.id, minutes)}
					/>
				</div>
			{/each}
		</div>
		{#if gitHubActivity}
			<div
				class="full-widget"
				use:highlightRemote={{
					revision: remoteRevision,
					value: `${gitHubActivity.commits}/${gitHubActivity.additions}/${gitHubActivity.deletions}`
				}}
				transition:pop
			>
				<GitHubActivityWidget activity={gitHubActivity} />
			</div>
		{/if}
	</div>
	<DayMeasures measures={[...attached, ...eraMeasures.cards]} {remoteRevision} />
	{#each footerWidgets as definition (definition.id)}
		<div transition:pop>{@render widget(definition.id)}</div>
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
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
		margin-top: 10px;
	}
	.day-widgets {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 14px;
	}
	:global(.day-eras) + .day-widget-stack .day-widgets {
		margin-top: 0;
	}
	.full-widget,
	.time-widget-block {
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
	.day-widgets:not(:has(> :not(.time-widget-block), .time-widget-row)),
	.time-widget-block:not(:has(> .time-widget-row)) {
		display: none;
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
