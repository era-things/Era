<script lang="ts">
	import { widgetFor, type WidgetInstance, type WidgetValues, type WidgetId } from '../widgets';
	import type { FoodItem } from '../nutrition';
	import NutritionPanel from './NutritionPanel.svelte';
	import MarkdownNote from './MarkdownNote.svelte';
	import CounterWidget from './CounterWidget.svelte';
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

{#if widget.id === 'nutrition'}
	<NutritionPanel items={widget.value} {history} onchange={(items) => onchange(items) !== false} />
{:else if widget.id === 'note'}
	<MarkdownNote value={widget.value} onchange={(text) => onchange(text)} />
{:else}
	<CounterWidget
		counter={widgetFor(widget.id)}
		skin={widget.skin}
		value={widget.value}
		onchange={(value) => onchange(value)}
	/>
{/if}
