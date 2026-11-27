<script lang="ts">
	import { eraPalette, type Era } from '../eras';
	import Chevron from './Chevron.svelte';

	let {
		eras,
		visibleIds,
		onreset,
		ontoggle,
		onisolate
	}: {
		eras: Era[];
		visibleIds: ReadonlySet<string>;
		onreset: () => void;
		ontoggle: (id: string) => void;
		onisolate: (id: string) => void;
	} = $props();

	let open = $state(false);
	let trigger: HTMLButtonElement;
	let panel = $state<HTMLDivElement>();
	const menuId = $props.id();
	const allSelected = $derived(visibleIds.size === eras.length);
	const selectedEra = $derived(
		visibleIds.size === 1 ? eras.find(({ id }) => visibleIds.has(id)) : undefined
	);
	const label = $derived(allSelected ? 'All' : (selectedEra?.name ?? 'Custom'));
	const current = $derived(
		eras
			.filter(({ archived }) => !archived)
			.sort((a, b) => Number(Boolean(b.autoMarkedThrough)) - Number(Boolean(a.autoMarkedThrough)))
	);
	const archived = $derived(eras.filter((era) => era.archived));
</script>

{#snippet eraOption(era: Era)}
	<button
		type="button"
		class="era-option"
		style:--era-color={eraPalette(era).bright}
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
		<span class="check" aria-hidden="true">✓</span>
		<span class="swatch" aria-hidden="true"></span>
		<span>{era.name}</span>
	</button>
{/snippet}

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === 'Escape') {
			open = false;
			trigger.focus();
		}
	}}
	onclickcapture={(event) => {
		const target = event.target;
		if (open && target instanceof Node && !trigger.contains(target) && !panel?.contains(target))
			open = false;
	}}
/>

<nav class="era-selector" aria-label="Eras">
	<button
		class="trigger"
		type="button"
		bind:this={trigger}
		aria-expanded={open}
		aria-controls={open ? menuId : undefined}
		onclick={() => (open = !open)}
	>
		<span>{label}</span>
		<Chevron direction={open ? 'up' : 'down'} size={13} />
	</button>
	{#if open}
		<div
			class="selector-panel"
			id={menuId}
			role="group"
			aria-label="Visible eras"
			bind:this={panel}
		>
			<button type="button" class="era-option" aria-pressed={allSelected} onclick={onreset}>
				<span class="check" aria-hidden="true">✓</span>
				All
			</button>
			{#each current as era (era.id)}
				{@render eraOption(era)}
			{/each}
			{#if archived.length}
				<div class="archived-label">Archived</div>
				{#each archived as era (era.id)}
					{@render eraOption(era)}
				{/each}
			{/if}
		</div>
	{/if}
</nav>

<style>
	.era-selector {
		position: relative;
		padding-block: 2px;
	}
	button {
		min-height: 28px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: 12px;
	}
	.trigger {
		display: flex;
		align-items: center;
		gap: 6px;
		max-width: 100%;
		padding: 4px 8px;
	}
	.trigger span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.trigger :global(svg) {
		flex: none;
	}
	button:hover,
	button[aria-expanded='true'] {
		background: #e5eae2;
	}
	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.selector-panel {
		position: absolute;
		inset-block-start: calc(100% + 3px);
		inset-inline-start: 0;
		display: grid;
		gap: 2px;
		width: min(250px, calc(100vw - 64px));
		max-height: min(320px, 55dvh);
		padding: 4px;
		overflow-y: auto;
		overscroll-behavior: contain;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--paper);
		box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
	}
	.era-option {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 6px;
		border-color: transparent;
		text-align: start;
		overflow-wrap: anywhere;
		touch-action: manipulation;
		user-select: none;
	}
	.check {
		flex: 0 0 14px;
		visibility: hidden;
		color: var(--accent);
		text-align: center;
	}
	.era-option[aria-pressed='true'] .check {
		visibility: visible;
	}
	.swatch {
		flex: 0 0 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--era-color);
	}
	.archived-label {
		padding: 4px 6px 0;
		border-top: 1px solid var(--line);
		color: var(--muted);
		font-size: 11px;
	}
</style>
