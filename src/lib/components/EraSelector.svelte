<script lang="ts">
	import { eraPalette, type Era } from '../eras';
	import { tick } from 'svelte';

	let {
		eras,
		availableWidth,
		visibleIds,
		selectedEra,
		onreset,
		ontoggle,
		onisolate
	}: {
		eras: Era[];
		availableWidth: number;
		visibleIds: ReadonlySet<string>;
		selectedEra?: Era;
		onreset: () => void;
		ontoggle: (id: string) => void;
		onisolate: (id: string) => void;
	} = $props();
	let showArchived = $state(false);
	let showOverflow = $state(false);
	let nav = $state<HTMLElement>();
	let measurement = $state<HTMLDivElement>();
	let widths = $state<Record<string, number>>({});
	const candidates = $derived(
		eras
			.filter((era) => !era.archived || era.id === selectedEra?.id)
			.sort((a, b) => Number(Boolean(b.autoMarkedThrough)) - Number(Boolean(a.autoMarkedThrough)))
	);
	const archived = $derived(eras.filter((era) => era.archived && era.id !== selectedEra?.id));
	$effect(() => {
		if (!measurement) return;
		candidates;
		const row = measurement;
		const measure = () => {
			widths = Object.fromEntries(
				Array.from(row.children, (element) => [
					(element as HTMLElement).dataset.measure!,
					element.getBoundingClientRect().width + 6
				])
			);
		};
		void tick().then(measure);
	});
	const shown = $derived.by(() => {
		if (!availableWidth || !widths.default) return candidates;
		const budget = availableWidth - 6 - widths.default - (archived.length ? widths.archived : 0);
		if (candidates.reduce((width, era) => width + (widths['era-' + era.id] ?? 0), 0) <= budget)
			return candidates;
		let remaining = budget - widths.overflow;
		return candidates.filter((era) => {
			const size = widths['era-' + era.id] ?? 0;
			if (!era.autoMarkedThrough && !era.archived && size > remaining) return false;
			remaining -= size;
			return true;
		});
	});
	const overflow = $derived(candidates.filter((era) => !shown.includes(era)));
	const selectedOverflow = $derived(overflow.filter((era) => visibleIds.has(era.id)).length);
	const menuId = $props.id();
</script>

{#snippet eraChip(era: Era)}
	{@const color = eraPalette(era)}
	<button
		type="button"
		class="era-chip"
		style:--era-color={color.bright}
		style:--era-fill={color.faint}
		aria-pressed={visibleIds.has(era.id)}
		aria-keyshortcuts="Shift+Enter"
		title="Double-click or Shift-click to show only this era"
		onclick={(event) => {
			if (event.shiftKey) onisolate(era.id);
			else if (event.detail <= 1) ontoggle(era.id);
		}}
		ondblclick={(event) => {
			if (!event.shiftKey) onisolate(era.id);
		}}
		onkeydown={(event) => {
			if (event.shiftKey && event.key === 'Enter') {
				event.preventDefault();
				onisolate(era.id);
			}
		}}
	>
		<span class="swatch" aria-hidden="true"></span>
		{era.name}
	</button>
{/snippet}

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && (showOverflow || showArchived)) {
			const opener = nav?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
			showOverflow = showArchived = false;
			opener?.focus();
		}
	}}
	onclick={(event) => {
		if (event.target instanceof Node && !nav?.contains(event.target))
			showOverflow = showArchived = false;
	}}
/>

<nav class="era-selector" aria-label="Eras" bind:this={nav}>
	<div class="measurement" aria-hidden="true" bind:this={measurement}>
		<span class="chip-control" data-measure="default">Default</span>
		<span class="chip-control" data-measure="archived">Archived</span>
		<span class="chip-control" data-measure="overflow">+{candidates.length}</span>
		{#each candidates as era (era.id)}
			<span class="chip-control" data-measure={'era-' + era.id}
				><span class="swatch"></span>{era.name}</span
			>
		{/each}
	</div>
	<button type="button" aria-pressed={visibleIds.size === eras.length} onclick={onreset}
		>Default</button
	>
	<div class="chip-strip">
		{#each shown as era (era.id)}
			{@render eraChip(era)}
		{/each}
	</div>
	{#if overflow.length}
		<button
			type="button"
			class:has-selection={selectedOverflow > 0}
			aria-label={overflow.length +
				' more eras' +
				(selectedOverflow ? ', ' + selectedOverflow + ' selected' : '')}
			aria-controls={menuId}
			aria-expanded={showOverflow}
			onclick={() => {
				showOverflow = !showOverflow;
				showArchived = false;
			}}>+{overflow.length}</button
		>
	{/if}
	{#if archived.length}
		<button
			type="button"
			aria-expanded={showArchived}
			aria-controls={menuId}
			onclick={() => {
				showArchived = !showArchived;
				showOverflow = false;
			}}
		>
			Archived
		</button>
	{/if}
	{#if (showOverflow && overflow.length) || (showArchived && archived.length)}
		<div class="selector-menu" id={menuId}>
			{#each showArchived ? archived : overflow as era (era.id)}
				{@render eraChip(era)}
			{/each}
		</div>
	{/if}
</nav>

<style>
	.era-selector {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 3px;
		background: var(--paper);
		white-space: nowrap;
	}
	.chip-strip {
		display: flex;
		gap: 6px;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.chip-strip:empty {
		display: none;
	}
	.measurement {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
		display: flex;
		visibility: hidden;
		pointer-events: none;
	}
	.selector-menu {
		position: absolute;
		inset-block-start: calc(100% + 3px);
		inset-inline-start: 0;
		display: grid;
		gap: 4px;
		min-width: min(180px, 100%);
		max-width: min(340px, 100%);
		max-height: min(260px, 55dvh);
		padding: 6px;
		overflow: auto;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--paper);
		box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
	}
	.selector-menu button {
		text-align: start;
		white-space: normal;
		overflow-wrap: anywhere;
	}
	button,
	.chip-control {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 28px;
		padding: 4px 8px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: transparent;
		color: var(--ink);
		font-size: 12px;
	}
	button:hover,
	button[aria-expanded='true'] {
		background: #e5eae2;
	}
	button[aria-pressed='true'],
	button.has-selection {
		background: var(--era-fill, #e5eae2);
	}
	.era-chip {
		touch-action: manipulation;
		user-select: none;
	}
	.era-chip[aria-pressed='true'] {
		border-color: color-mix(in srgb, var(--era-color) 60%, var(--line));
	}
	.era-chip[aria-pressed='false'] .swatch {
		opacity: 0.5;
	}
	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.swatch {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--era-color);
	}
</style>
