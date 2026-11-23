<script lang="ts">
	import Chevron from './Chevron.svelte';
	import { NUTRIENTS, nutritionTotals, type FoodItem } from '../nutrition';
	import { createResourceId } from '../resource-id';
	import { pop, reflow, unfold } from '../widget-motion';
	import NutritionHistory from './NutritionHistory.svelte';
	import NutritionItemRow from './NutritionItemRow.svelte';
	let {
		items,
		history,
		readonly = false,
		onchange
	}: {
		items: FoodItem[];
		history: FoodItem[];
		readonly?: boolean;
		onchange: (items: FoodItem[]) => boolean;
	} = $props();
	let expanded = $state<string | null>(null);
	let focusId = $state<string | null>(null);
	let itemsOpen = $state(false);
	const itemsId = $props.id();
	const totals = $derived(nutritionTotals(items));
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
	function add(source?: FoodItem) {
		const item: FoodItem = {
			name: '',
			kcal: 0,
			protein: 0,
			fat: 0,
			carbs: 0,
			...source,
			id: createResourceId(),
			quantity: 1
		};
		if (onchange([...items, item])) {
			focusId = source ? null : item.id;
			expanded = null;
			return true;
		}
		return false;
	}
	function update(id: string, next: FoodItem | null) {
		return onchange(
			next
				? items.map((item) => (item.id === id ? next : item))
				: items.filter((item) => item.id !== id)
		);
	}
</script>

<section class="nutrition" aria-label="Nutrition">
	<div class="nutrition-heading">
		<h3>Nutrition</h3>
		<button
			class="items-toggle"
			type="button"
			aria-expanded={itemsOpen}
			aria-controls={itemsId}
			onclick={() => {
				if (itemsOpen) {
					focusId = null;
					expanded = null;
				}
				itemsOpen = !itemsOpen;
			}}
		>
			<Chevron direction={itemsOpen ? 'down' : 'right'} size={10} />
			{items.length}
			{items.length === 1 ? 'item' : 'items'}
		</button>
	</div>
	<dl class="totals" aria-label="Day nutrition totals">
		{#each NUTRIENTS as nutrient (nutrient.key)}
			<div class:kcal={nutrient.key === 'kcal'} style:--nutrient-color={nutrient.color}>
				<dt aria-label={nutrient.label}>{nutrient.shortLabel}</dt>
				<dd>{number.format(totals[nutrient.key])}</dd>
			</div>
		{/each}
	</dl>
	<div id={itemsId}>
		{#if itemsOpen}
			<div class="items" use:reflow transition:unfold>
				{#if items.length}
					<table aria-label="Nutrition items" transition:pop>
						<colgroup>
							<col class="quantity-column" />
							<col />
							<col class="kcal-column" />
							{#each NUTRIENTS.slice(1) as nutrient (nutrient.key)}
								<col class="macro-column" />
							{/each}
						</colgroup>
						<thead>
							<tr>
								<th scope="col" aria-label="Quantity">Q</th>
								<th scope="col">Name</th>
								{#each NUTRIENTS as nutrient (nutrient.key)}
									<th scope="col" aria-label={nutrient.label}>{nutrient.shortLabel}</th>
								{/each}
							</tr>
						</thead>
						<tbody use:reflow>
							{#each items as item (item.id)}
								<NutritionItemRow
									{item}
									{readonly}
									bind:expanded
									autofocus={focusId === item.id}
									onchange={(next) => update(item.id, next)}
								/>
							{/each}
						</tbody>
					</table>
				{/if}
				{#if !readonly}<div class="item-actions">
						<button class="add-item" type="button" aria-label="Add item" onclick={() => add()}
							><svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.7"
								stroke-linecap="round"
								aria-hidden="true"><path d="M12 4v16M4 12h16" /></svg
							></button
						>
						<NutritionHistory items={history} onselect={add} />
					</div>{/if}
			</div>
		{/if}
	</div>
</section>

<style>
	.nutrition {
		--nutrition-surface: #f5eddb;
		--nutrition-hover: #e8dfca;
		--nutrition-row-height: 28px;
		padding: 10px;
		background: var(--nutrition-surface);
		border: 1px solid #d8c8a7;
		border-radius: 4px;
	}
	h3 {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
	}
	.nutrition-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 8px;
	}
	.items-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 24px;
		padding: 2px 4px;
		border: 0;
		border-radius: 3px;
		background: transparent;
		color: var(--muted);
		font-size: 12px;
	}
	.items-toggle:hover {
		background: var(--nutrition-hover);
	}
	.totals {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px 10px;
		margin: 0;
	}
	.totals > div {
		display: flex;
		align-items: baseline;
		gap: 4px;
		white-space: nowrap;
		padding: 4px 7px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--nutrient-color) 15%, transparent);
	}
	dt {
		width: 1ch;
		font-size: 11px;
	}
	dd {
		order: -1;
		min-width: 3ch;
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}
	.totals > .kcal {
		padding-inline: 0;
		margin-right: 6px;
		background: transparent;
	}
	.kcal dt {
		width: auto;
	}
	.kcal dd {
		min-width: 0;
	}
	.kcal dd {
		font-size: 22px;
		text-align: left;
	}
	.kcal dt {
		color: var(--muted);
	}
	.items {
		margin-top: 12px;
	}
	table {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		margin-top: 10px;
		font-size: 13px;
	}
	.quantity-column {
		width: 46px;
	}
	.kcal-column {
		width: calc(5ch + 4px);
	}
	.macro-column {
		width: calc(3ch + 12px);
	}
	th {
		padding: 0 6px;
		text-align: left;
		color: var(--muted);
		font-size: 11px;
		font-weight: 400;
	}
	.item-actions {
		position: relative;
		display: flex;
		align-items: center;
		gap: 2px;
		margin-top: 2px;
	}
	.add-item {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: var(--nutrition-row-height);
		padding: 0;
		border: 0;
		border-radius: 3px;
		background: transparent;
		font-size: 20px;
		color: var(--ink);
	}
	.add-item:hover {
		background: var(--nutrition-hover);
	}
</style>
