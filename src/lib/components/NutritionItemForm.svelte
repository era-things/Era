<script lang="ts">
	import { NUTRIENTS, validFoodItem, type FoodItem, type Nutrients } from '../nutrition';
	import { onMount } from 'svelte';
	let {
		item,
		onsave,
		oncancel
	}: { item?: FoodItem; onsave: (item: FoodItem) => boolean; oncancel: () => void } = $props();
	let name = $state('');
	let values = $state<Record<keyof Nutrients, number | undefined>>({
		kcal: 0,
		protein: 0,
		fat: 0,
		carbs: 0
	});
	let nameInput = $state<HTMLInputElement>();
	$effect(() => {
		name = item?.name ?? '';
		values = {
			kcal: item?.kcal ?? 0,
			protein: item?.protein ?? 0,
			fat: item?.fat ?? 0,
			carbs: item?.carbs ?? 0
		};
	});
	onMount(() => nameInput?.focus());
	function save(event: SubmitEvent) {
		event.preventDefault();
		const next = {
			id: item?.id ?? crypto.randomUUID(),
			name: name.trim(),
			quantity: item?.quantity ?? 1,
			...values
		};
		if (validFoodItem(next)) onsave(next);
	}
</script>

<form onsubmit={save} aria-label={item ? 'Edit item: ' + item.name : 'Add item'}>
	<label>Name<input bind:this={nameInput} bind:value={name} maxlength="120" required /></label>
	<div class="nutrient-fields">
		{#each NUTRIENTS as nutrient (nutrient.key)}
			<label
				>{nutrient.shortLabel}<input
					aria-label={nutrient.label}
					type="number"
					min="0"
					max={Number.MAX_SAFE_INTEGER}
					step="any"
					inputmode="decimal"
					bind:value={values[nutrient.key]}
					required
				/></label
			>
		{/each}
	</div>
	<div class="actions">
		<button type="submit" disabled={!name.trim()}>{item ? 'Save' : 'Add'}</button>
		<button type="button" onclick={oncancel}>Cancel</button>
	</div>
</form>

<style>
	form {
		display: grid;
		gap: 10px;
		padding: 10px 0;
	}
	label {
		display: grid;
		min-width: 0;
		gap: 4px;
		font-size: 11px;
		color: var(--muted);
	}
	input {
		width: 100%;
		min-width: 0;
		height: 30px;
		padding: 4px 6px;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: 12px;
	}
	.nutrient-fields {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		align-items: end;
		gap: 6px;
	}
	.actions {
		display: flex;
		gap: 6px;
	}
	button {
		padding: 4px 8px;
		min-height: 28px;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: transparent;
		font-size: 12px;
	}
	button[type='submit'] {
		color: white;
		background: var(--accent);
		border-color: var(--accent);
	}
	button:hover:not(:disabled) {
		filter: brightness(0.95);
	}
	input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
</style>
