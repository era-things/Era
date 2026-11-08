<script lang="ts">
	import { tick } from 'svelte';
	import { NUTRIENTS, type FoodItem } from '../nutrition';
	let { items, onselect }: { items: FoodItem[]; onselect: (item: FoodItem) => boolean } = $props();
	let open = $state(false);
	let query = $state('');
	let root: HTMLDivElement;
	let search = $state<HTMLInputElement>();
	let toggle: HTMLButtonElement;
	const matches = $derived(
		items.filter((item) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
	);
	$effect(() => {
		if (!open) return;
		const dismiss = (event: PointerEvent) => {
			if (!root.contains(event.target as Node)) open = false;
		};
		document.addEventListener('pointerdown', dismiss);
		return () => document.removeEventListener('pointerdown', dismiss);
	});
	async function show() {
		open = !open;
		query = '';
		if (open) {
			await tick();
			search?.focus();
		}
	}
</script>

<div
	bind:this={root}
	onfocusout={(event) => {
		if (!root.contains(event.relatedTarget as Node | null)) open = false;
	}}
>
	<button
		class="history-toggle"
		bind:this={toggle}
		type="button"
		aria-label="Add previous item"
		title="Add previous item"
		aria-expanded={open}
		onclick={show}
	>
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.7"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2" /></svg
		>
	</button>
	{#if open}
		<div
			class="history-menu"
			role="dialog"
			tabindex="-1"
			aria-label="Previous nutrition items"
			onkeydown={(event) => {
				if (event.key === 'Escape' && open) {
					event.preventDefault();
					open = false;
					toggle.focus();
				}
			}}
		>
			<input
				bind:this={search}
				bind:value={query}
				aria-label="Find previous item"
				placeholder="Find item"
				type="search"
			/>
			<div class="results">
				{#each matches as item}
					<button
						class="previous-item"
						type="button"
						onclick={() => {
							if (onselect(item)) {
								open = false;
								toggle.focus();
							}
						}}
					>
						<span class="name">{item.name}</span>
						<span class="nutrients"
							>{#each NUTRIENTS as nutrient}<span>{item[nutrient.key]} {nutrient.shortLabel}</span
								>{/each}</span
						>
					</button>
				{:else}<p>{items.length ? 'No matching items' : 'No items from earlier days'}</p>{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	button {
		border: 0;
		border-radius: 3px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}
	button:hover {
		background: var(--nutrition-hover);
	}
	button:focus-visible,
	input:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: -1px;
	}
	.history-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: var(--nutrition-row-height);
		padding: 0;
		color: var(--muted);
	}
	.history-menu {
		position: absolute;
		z-index: 3;
		top: 100%;
		left: 0;
		width: min(320px, calc(100vw - 64px));
		padding: 6px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--nutrition-surface);
		box-shadow: 0 3px 12px rgb(0 0 0 / 10%);
	}
	input {
		width: 100%;
		min-width: 0;
		height: 28px;
		padding: 4px 6px;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: transparent;
		font: inherit;
		font-size: 12px;
		color: var(--ink);
	}
	.results {
		max-height: 220px;
		overflow: auto;
		margin-top: 4px;
	}
	.previous-item {
		display: grid;
		gap: 3px;
		width: 100%;
		padding: 6px;
		text-align: left;
	}
	.name {
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	.nutrients {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		color: var(--muted);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	p {
		margin: 8px 6px;
		font-size: 12px;
		color: var(--muted);
	}
</style>
