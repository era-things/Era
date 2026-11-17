<script lang="ts">
	import {
		widgetHandler,
		type WidgetInstanceOfKind,
		type WidgetHandlers,
		type WidgetInstance,
		type WidgetValues,
		type WidgetId
	} from '../widgets';
	import type { Snippet } from 'svelte';
	import type { FoodItem } from '../nutrition';
	import NutritionPanel from './NutritionPanel.svelte';
	import MarkdownNote from './MarkdownNote.svelte';
	import CounterWidget from './CounterWidget.svelte';
	import SleepWidget from './SleepWidget.svelte';
	import TimeWidget from './TimeWidget.svelte';
	let {
		widget,
		history = [],
		onchange = () => {}
	}: {
		widget: WidgetInstance;
		history?: FoodItem[];
		onchange?: (value: WidgetValues[WidgetId]) => boolean | void;
	} = $props();
	const renderers = { sleep, nutrition, note, time, counter } satisfies {
		[K in keyof WidgetHandlers<unknown>]: Snippet<[WidgetInstanceOfKind<K>]>;
	};
</script>

{#snippet sleep(item: WidgetInstanceOfKind<'sleep'>)}
	<SleepWidget value={item.value} skin={item.skin} onchange={(value) => onchange(value)} />
{/snippet}
{#snippet nutrition(item: WidgetInstanceOfKind<'nutrition'>)}
	<NutritionPanel items={item.value} {history} onchange={(items) => onchange(items) !== false} />
{/snippet}
{#snippet note(item: WidgetInstanceOfKind<'note'>)}
	<MarkdownNote value={item.value} onchange={(text) => onchange(text)} />
{/snippet}
{#snippet time(item: WidgetInstanceOfKind<'time'>)}
	<TimeWidget id={item.id} value={item.value} onchange={(value) => onchange(value)} />
{/snippet}
{#snippet counter(item: WidgetInstanceOfKind<'counter'>)}
	<CounterWidget
		counter={item.definition}
		skin={item.skin}
		value={item.value}
		onchange={(value) => onchange(value)}
	/>
{/snippet}

{@render widgetHandler(widget, renderers)(widget)}
