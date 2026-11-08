<script lang="ts">
	import { NUTRIENTS, nutritionTotals, type FoodItem } from '../nutrition';
	import NutritionHistory from './NutritionHistory.svelte';
	import NutritionItemRow from './NutritionItemRow.svelte';
	let {
		items,
		history,
		onchange
	}: { items: FoodItem[]; history: FoodItem[]; onchange: (items: FoodItem[]) => boolean } =
		$props();
	let expanded = $state<string | null>(null);
	let focusId = $state<string | null>(null);
	const totals = $derived(nutritionTotals(items));
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
	function add(source?: FoodItem) {
		const item: FoodItem = {
			name: '',
			kcal: 0,
			protein: 0,
			fat: 0,
			carbs: 0,
			...source,
			id: crypto.randomUUID(),
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
	<h3>Nutrition</h3>
	<dl class="totals" aria-label="Day nutrition totals">
		{#each NUTRIENTS as nutrient (nutrient.key)}
			<div class:kcal={nutrient.key === 'kcal'} style:--nutrient-color={nutrient.color}>
				<dt aria-label={nutrient.label}>{nutrient.shortLabel}</dt>
				<dd>{number.format(totals[nutrient.key])}</dd>
			</div>
		{/each}
	</dl>
	<details class="items">
		<summary>Items <span>{items.length}</span></summary>
		{#if items.length}
			<table aria-label="Nutrition items">
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
				<tbody>
					{#each items as item (item.id)}
						<NutritionItemRow
							{item}
							bind:expanded
							autofocus={focusId === item.id}
							onchange={(next) => update(item.id, next)}
						/>
					{/each}
				</tbody>
			</table>
		{/if}
		<div class="item-actions">
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
		</div>
	</details>
</section>

<style>
	.nutrition {
		--nutrition-surface: #f5eddb;
		--nutrition-hover: #e8dfca;
		--nutrition-row-height: 28px;
		margin-top: 24px;
		padding: 10px;
		background: var(--nutrition-surface);
		border-radius: 4px;
	}
	h3 {
		margin: 0 0 10px;
		font-size: 12px;
		font-weight: 600;
	}
	.totals {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
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
		width: 3ch;
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.totals > .kcal {
		padding-inline: 0;
		margin-right: 6px;
		background: transparent;
	}
	.kcal dt,
	.kcal dd {
		width: auto;
	}
	.kcal dd {
		font-size: 18px;
	}
	.items {
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
	table {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		margin-top: 10px;
		font-size: 13px;
	}
	.quantity-column {
		width: 32px;
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
