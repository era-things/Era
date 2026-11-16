<script lang="ts">
	import { widgetFor, type WidgetInstance, type WidgetValues, type WidgetId } from '../widgets';
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
</script>

{#if widget.id === 'sleep'}
	<SleepWidget value={widget.value} skin={widget.skin} onchange={(value) => onchange(value)} />
{:else if widget.id === 'nutrition'}
	<NutritionPanel items={widget.value} {history} onchange={(items) => onchange(items) !== false} />
{:else if widget.id === 'note'}
	<MarkdownNote value={widget.value} onchange={(text) => onchange(text)} />
{:else if widget.id === 'phone' || widget.id === 'gym' || widget.id === 'reading' || widget.id === 'movie' || widget.id === 'steam'}
	<TimeWidget id={widget.id} value={widget.value} onchange={(value) => onchange(value)} />
{:else}
	<CounterWidget
		counter={widgetFor(widget.id)}
		skin={widget.skin}
		value={widget.value}
		onchange={(value) => onchange(value)}
	/>
{/if}
