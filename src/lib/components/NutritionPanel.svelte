<script lang="ts">
	import { NUTRIENTS, nutritionTotals, type FoodItem, type Nutrients } from '../nutrition';
	import NutritionItemForm from './NutritionItemForm.svelte';
	import { slide } from 'svelte/transition';
	let { items, onchange }: { items: FoodItem[]; onchange: (items: FoodItem[]) => boolean } =
		$props();
	let adding = $state(false);
	let editing = $state<string | null>(null);
	let actions = $state<string | null>(null);
	const totals = $derived(nutritionTotals(items));
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
	function save(item: FoodItem) {
		const next = items.some((food) => food.id === item.id)
			? items.map((food) => (food.id === item.id ? item : food))
			: [...items, item];
		if (!onchange(next)) return false;
		adding = false;
		editing = null;
		return true;
	}
	function changeQuantity(item: FoodItem, delta: number) {
		const quantity = item.quantity + delta;
		if (!Number.isSafeInteger(quantity) || quantity < 1) return;
		onchange(items.map((food) => (food.id === item.id ? { ...food, quantity } : food)));
	}
</script>

{#snippet nutrients(values: Nutrients)}
	<dl class="nutrients">
		{#each NUTRIENTS as nutrient (nutrient.key)}
			<div class:kcal={nutrient.key === 'kcal'} style:--nutrient-color={nutrient.color}>
				<dt aria-label={nutrient.label}>{nutrient.shortLabel}</dt>
				<dd>{number.format(values[nutrient.key])}</dd>
			</div>
		{/each}
	</dl>
{/snippet}

<section class="nutrition" aria-label="Nutrition">
	<h3>Nutrition</h3>
	<div class="day-totals" aria-label="Day nutrition totals">{@render nutrients(totals)}</div>
	<details class="food-list">
		<summary>Items <span>{items.length}</span></summary>
		{#if items.length}
			<div class="column-headings" aria-hidden="true">
				<span>Q</span>
				<span>Name</span>
				{#each NUTRIENTS as nutrient (nutrient.key)}
					<span>{nutrient.shortLabel}</span>
				{/each}
			</div>
		{/if}
		{#each items as item (item.id)}
			<article aria-label={item.name}>
				{#if editing === item.id}
					<NutritionItemForm {item} onsave={save} oncancel={() => (editing = null)} />
				{:else}
					<header>
						<button
							class="item-quantity"
							type="button"
							aria-label={'Increase quantity of ' + item.name + ', currently ' + item.quantity}
							disabled={item.quantity === Number.MAX_SAFE_INTEGER}
							onclick={() => changeQuantity(item, 1)}
							><span aria-live="polite">×{item.quantity}</span></button
						>
						<strong title={item.name}>{item.name}</strong>
						{@render nutrients(item)}
						{#if actions === item.id}
							<div class="item-actions" transition:slide={{ axis: 'x', duration: 140 }}>
								<div class="quantity" role="group" aria-label={'Quantity of ' + item.name}>
									<button
										type="button"
										aria-label={'Decrease quantity of ' + item.name}
										disabled={item.quantity === 1}
										onclick={() => changeQuantity(item, -1)}>−</button
									>
									<span aria-live="polite">×{item.quantity}</span>
									<button
										type="button"
										aria-label={'Increase quantity of ' + item.name}
										disabled={item.quantity === Number.MAX_SAFE_INTEGER}
										onclick={() => changeQuantity(item, 1)}>+</button
									>
								</div>
								<button
									class="icon-button"
									type="button"
									aria-label={'Edit ' + item.name}
									onclick={() => {
										editing = item.id;
										adding = false;
										actions = null;
									}}
									><svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="1.7"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
										><path d="m16 3 5 5M3 21l5-1L21 7a3.54 3.54 0 0 0-5-5L3 15Z" /></svg
									></button
								><button
									class="icon-button"
									type="button"
									aria-label={'Remove ' + item.name}
									onclick={() => onchange(items.filter((food) => food.id !== item.id))}
									><svg
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
									></button
								>
							</div>
						{/if}
						<button
							class="icon-button more"
							type="button"
							aria-label={'Actions for ' + item.name}
							aria-expanded={actions === item.id}
							onclick={() => (actions = actions === item.id ? null : item.id)}>…</button
						>
					</header>
				{/if}
			</article>
		{/each}
		{#if adding}<NutritionItemForm onsave={save} oncancel={() => (adding = false)} />
		{:else}<button
				class="add-food"
				type="button"
				aria-label="Add item"
				onclick={() => {
					adding = true;
					editing = null;
				}}>+</button
			>{/if}
	</details>
</section>

<style>
	.nutrition {
		margin-top: 24px;
		padding: 10px;
		background: #f5eddb;
		border-radius: 4px;
	}
	h3 {
		margin: 0 0 10px;
		font-size: 12px;
		font-weight: 600;
	}
	.nutrients {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 10px;
		margin: 0;
	}
	.nutrients > div {
		display: flex;
		align-items: baseline;
		gap: 4px;
		white-space: nowrap;
		padding: 4px 7px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--nutrient-color) 15%, transparent);
		color: var(--ink);
	}
	.nutrients > .kcal {
		padding: 4px 0;
		margin-right: 6px;
		background: transparent;
	}
	dt {
		font-size: 11px;
	}
	dd {
		order: -1;
		margin: 0;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
	.nutrients > div:not(.kcal) dd {
		width: 3ch;
		flex: 0 0 3ch;
		text-align: left;
	}
	.day-totals .nutrients > div:not(.kcal) dt {
		width: 1ch;
		flex: 0 0 1ch;
	}
	.day-totals dd {
		font-size: 14px;
		font-weight: 600;
	}
	.kcal dd {
		font-size: 15px;
	}
	.day-totals .kcal dd {
		font-size: 18px;
	}
	.food-list {
		margin-top: 12px;
	}
	summary {
		cursor: pointer;
		font-size: 12px;
	}
	summary span {
		margin-left: 4px;
		color: var(--muted);
	}
	article {
		padding: 2px 0;
		border-bottom: 1px solid var(--line);
	}
	header,
	.column-headings {
		display: grid;
		grid-template-columns: 28px minmax(4ch, 1fr) 5ch repeat(3, calc(3ch + 8px)) 28px;
		align-items: center;
		gap: 4px;
		font-size: 13px;
	}
	.column-headings {
		margin-top: 10px;
		color: var(--muted);
	}
	.column-headings > span {
		font-size: 11px;
		padding-inline: 4px;
	}
	header {
		position: relative;
	}
	header .nutrients {
		display: contents;
	}
	header .nutrients > div {
		padding-inline: 4px;
	}
	header .nutrients > .kcal {
		margin-right: 0;
	}
	header dt {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	strong {
		flex: 1;
		min-width: 4ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		font-weight: 500;
	}
	button {
		border: 0;
		border-radius: 3px;
		background: transparent;
		padding: 4px 6px;
		font-size: 11px;
		color: var(--muted);
	}
	button:hover:not(:disabled) {
		background: #e8dfca;
		color: var(--ink);
	}
	.add-food {
		margin-top: 2px;
		width: 28px;
		height: 28px;
		padding: 0;
		font-size: 20px;
		color: var(--ink);
	}
	.icon-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		flex-shrink: 0;
	}
	.item-actions {
		position: absolute;
		right: 32px;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
		background: #f5eddb;
	}
	.more {
		font-size: 18px;
	}
	.item-quantity {
		flex-shrink: 0;
		min-height: 28px;
		padding: 4px;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}
	.quantity {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}
	.quantity button {
		width: 26px;
		height: 26px;
		padding: 0;
		font-size: 16px;
	}
	.quantity button:disabled {
		opacity: 0.35;
	}
</style>
