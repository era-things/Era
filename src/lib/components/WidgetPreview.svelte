<script lang="ts">
	import { fly } from 'svelte/transition';
	import {
		type Widget,
		type WidgetSettings,
		type WidgetInstance,
		type WidgetSkin
	} from '../widgets';
	import BuiltInWidget from './BuiltInWidget.svelte';
	import Chevron from './Chevron.svelte';
	import { isDayTimeWidget } from '../time';
	let {
		definition,
		settings,
		onchange
	}: { definition: Widget; settings: WidgetSettings; onchange: (skin: WidgetSkin) => void } =
		$props();
	let direction = $state(1);
	const hasSkins = $derived(definition.skins.length > 1);
	const sample = $derived({
		id: definition.id,
		skin: settings.skin,
		value: definition.sample
	} as WidgetInstance);
	function cycle(next: number) {
		direction = next;
		const index = definition.skins.findIndex(({ id }) => id === settings.skin);
		onchange(
			definition.skins[(index + next + definition.skins.length) % definition.skins.length].id
		);
	}
	function slide(node: Element, shift: number) {
		return fly(node, {
			x: `${shift * 100}%`,
			duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240,
			opacity: 1
		});
	}
</script>

<div
	class="appearance-selector"
	class:has-skins={hasSkins}
	class:time-preview={isDayTimeWidget(definition.id)}
	role="group"
	aria-label={definition.name + ' appearance'}
>
	<div class="measure-preview" role="img" aria-label={definition.name + ' appearance preview'}>
		<div class="preview-stage" inert>
			{#if definition.compact}
				{#key settings.skin}<div class="preview-slide" in:slide={direction} out:slide={-direction}>
						<div class="counter-sample"><BuiltInWidget widget={sample} /></div>
					</div>{/key}
			{:else}<BuiltInWidget widget={sample} />{/if}
		</div>
	</div>
	{#if hasSkins}<div class="skin-navigation">
			{#each [-1, 1] as step}
				{#if step === 1}<span class="skin-caption" aria-live="polite"
						>{definition.skins.find(({ id }) => id === settings.skin)?.name}</span
					>{/if}
				<button
					class="skin-arrow"
					type="button"
					aria-label={`${step < 0 ? 'Previous' : 'Next'} ${definition.name} appearance`}
					onclick={() => cycle(step)}><Chevron direction={step < 0 ? 'left' : 'right'} /></button
				>
			{/each}
		</div>{/if}
</div>

<style>
	.appearance-selector {
		--preview-height: 52px;
		display: grid;
		grid-template-rows: minmax(var(--preview-height), auto);
		width: 100%;
	}
	.has-skins {
		grid-template-rows: minmax(var(--preview-height), auto) 32px;
	}
	.time-preview {
		--preview-height: 26px;
	}
	.measure-preview {
		min-width: 0;
		width: 100%;
	}
	.preview-stage {
		position: relative;
		display: grid;
		align-items: center;
		min-height: var(--preview-height);
		overflow: hidden;
	}
	.preview-slide {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
	}
	.counter-sample {
		width: min(148px, 100%);
	}
	.skin-navigation {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}
	.skin-arrow {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: var(--muted);
	}
	.skin-arrow:hover {
		background: #e5eae2;
	}
	.skin-caption {
		min-width: 56px;
		text-align: center;
		color: var(--muted);
		font-size: 12px;
	}
</style>
