<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { NUTRIENTS, validFoodQuantity, type FoodItem, type Nutrients } from '../nutrition';
	import { pop } from '../widget-motion';
	let {
		item,
		onchange,
		autofocus = false,
		readonly = false,
		expanded = $bindable(null)
	}: {
		item: FoodItem;
		onchange: (item: FoodItem | null) => boolean;
		autofocus?: boolean;
		readonly?: boolean;
		expanded?: string | null;
	} = $props();
	let nameInput: HTMLInputElement;
	let quantityCell: HTMLTableCellElement;
	let quantityToggle = $state<HTMLButtonElement>();
	let quantityInput = $state<HTMLInputElement>();
	let editingQuantity = $state(false);
	const label = $derived(item.name || 'new item');
	const decrementRemovesItem = $derived(item.quantity <= 1);
	$effect(() => {
		if (expanded !== item.id) return;
		const dismiss = (event: PointerEvent) => {
			if (!quantityCell.contains(event.target as Node)) expanded = null;
		};
		document.addEventListener('pointerdown', dismiss);
		return () => document.removeEventListener('pointerdown', dismiss);
	});
	onMount(() => {
		if (autofocus) nameInput.focus();
	});
	function commitName(input: HTMLInputElement) {
		const name = input.value.trim();
		if (input.validity.valid && name !== item.name && onchange({ ...item, name })) return;
		input.value = item.name;
	}
	function commitNutrient(field: keyof Nutrients, input: HTMLInputElement) {
		const previous = item[field];
		const value = input.valueAsNumber;
		const saved =
			!readonly &&
			input.validity.valid &&
			value !== previous &&
			onchange({ ...item, [field]: value });
		input.value = String(Math.round(saved ? value : previous));
	}
	function keydown(event: KeyboardEvent, value: string | number) {
		const input = event.currentTarget as HTMLInputElement;
		if (event.key === 'Escape') input.value = String(value);
		else if (event.key !== 'Enter') return;
		event.preventDefault();
		input.blur();
	}
	function adjust(delta: -1 | 1) {
		if (delta === -1 && decrementRemovesItem) {
			if (onchange(null)) expanded = null;
			return;
		}
		const quantity = Number((item.quantity + delta).toFixed(2));
		if (validFoodQuantity(quantity)) onchange({ ...item, quantity });
	}
	async function editQuantity() {
		expanded = null;
		editingQuantity = true;
		await tick();
		quantityInput?.focus();
		quantityInput?.select();
	}
	function commitQuantity(input: HTMLInputElement) {
		const value = Number(input.value.replace(',', '.'));
		if (!readonly && input.validity.valid && validFoodQuantity(value) && value !== item.quantity)
			onchange({ ...item, quantity: value });
		editingQuantity = false;
	}
	async function quantityKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== 'Escape') return;
		keydown(event, item.quantity);
		await tick();
		quantityToggle?.focus();
	}
</script>

<tr aria-label={label} transition:pop>
	<td
		class="quantity-cell"
		bind:this={quantityCell}
		onfocusout={(event) => {
			if (!quantityCell.contains(event.relatedTarget as Node | null) && expanded === item.id)
				expanded = null;
		}}
	>
		{#if readonly}
			<span class="quantity-value">×{item.quantity}</span>
		{:else if editingQuantity}
			<input
				class="quantity-input"
				bind:this={quantityInput}
				aria-label={'Edit quantity of ' + label}
				inputmode="decimal"
				pattern={'[0-9]*(?:[.,][0-9]{1,2})?'}
				required
				value={item.quantity}
				onblur={(event) => commitQuantity(event.currentTarget)}
				onkeydown={quantityKeydown}
			/>
		{:else}<button
				class="quantity-toggle"
				type="button"
				bind:this={quantityToggle}
				aria-label={'Quantity of ' + label + ', currently ' + item.quantity}
				aria-expanded={expanded === item.id}
				aria-keyshortcuts="F2"
				title="Double-click or press F2 to edit quantity"
				onclick={() => (expanded = expanded === item.id ? null : item.id)}
				ondblclick={editQuantity}
				onkeydown={(event) => {
					if (event.key !== 'F2') return;
					event.preventDefault();
					void editQuantity();
				}}
				><span class="quantity-value" aria-live="polite">×{item.quantity}</span></button
			>
		{/if}
		{#if !readonly && expanded === item.id}
			<div
				class="quantity-controls"
				role="group"
				aria-label={'Quantity controls for ' + label}
				transition:slide={{ axis: 'x', duration: 140 }}
			>
				<button
					type="button"
					aria-label={(decrementRemovesItem ? 'Remove ' : 'Decrease quantity of ') + label}
					onclick={() => adjust(-1)}
				>
					{#if decrementRemovesItem}<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.7"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg
						>{:else}−{/if}
				</button>
				<button
					type="button"
					aria-label={'Increase quantity of ' + label}
					disabled={item.quantity === Number.MAX_SAFE_INTEGER}
					onclick={() => adjust(1)}>+</button
				>
			</div>
		{/if}
	</td>
	<td
		><input
			class="name"
			bind:this={nameInput}
			aria-label={'Name of ' + label}
			title={item.name}
			value={item.name}
			{readonly}
			maxlength="120"
			onblur={(event) => commitName(event.currentTarget)}
			onkeydown={(event) => keydown(event, item.name)}
		/></td
	>
	{#each NUTRIENTS as nutrient (nutrient.key)}
		<td
			><input
				class:kcal={nutrient.key === 'kcal'}
				class="nutrient"
				style:--nutrient-color={nutrient.color}
				aria-label={nutrient.label + ' of ' + label}
				type="number"
				min="0"
				max={Number.MAX_SAFE_INTEGER}
				step="any"
				inputmode="decimal"
				required
				value={Math.round(item[nutrient.key])}
				{readonly}
				onfocus={(event) => {
					if (!readonly) event.currentTarget.value = String(item[nutrient.key]);
				}}
				onblur={(event) => commitNutrient(nutrient.key, event.currentTarget)}
				onkeydown={(event) => keydown(event, item[nutrient.key])}
			/></td
		>
	{/each}
</tr>

<style>
	td {
		padding: 2px;
		border-bottom: 1px solid var(--line);
	}
	.quantity-cell {
		position: relative;
	}
	input {
		width: 100%;
		min-width: 0;
		height: var(--nutrition-row-height);
		padding: 4px;
		border: 0;
		border-radius: 3px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.name {
		font-size: 12px;
		text-overflow: ellipsis;
	}
	.nutrient {
		font-variant-numeric: tabular-nums;
		background: color-mix(in srgb, var(--nutrient-color) 15%, transparent);
		appearance: textfield;
	}
	.nutrient::-webkit-inner-spin-button,
	.nutrient::-webkit-outer-spin-button {
		appearance: none;
		margin: 0;
	}
	.kcal {
		background: transparent;
		font-size: 15px;
	}
	input:hover {
		box-shadow: inset 0 0 0 1px var(--line);
	}
	input:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: -1px;
	}
	button {
		border: 0;
		border-radius: 3px;
		background: transparent;
		color: var(--muted);
	}
	button:hover:not(:disabled) {
		background: var(--nutrition-hover);
		color: var(--ink);
	}
	.quantity-toggle,
	.quantity-input,
	.quantity-value {
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}
	.quantity-toggle {
		width: 100%;
		height: var(--nutrition-row-height);
		padding: 4px 2px;
		color: var(--ink);
		touch-action: manipulation;
	}
	.quantity-input {
		text-align: center;
	}
	.quantity-value {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.quantity-controls {
		position: absolute;
		top: 2px;
		left: 100%;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--nutrition-surface);
	}
	.quantity-controls button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		font-size: 16px;
	}
	button:disabled {
		opacity: 0.35;
	}
</style>
