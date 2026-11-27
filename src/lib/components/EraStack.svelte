<script lang="ts">
	import { goto } from '$app/navigation';
	import type { DateKey } from '../calendar';
	import type { DayEmojis } from '../day-emojis';
	import type { DayNotes } from '../day-notes';
	import type { Era, EraDay, EraDays } from '../eras';
	import EraCard from './EraCard.svelte';
	import EraEditor from './EraEditor.svelte';

	let {
		eras,
		eraDays,
		emojis,
		notes,
		unavailable,
		today,
		onsave,
		onmark,
		onshow
	}: {
		eras: Era[];
		eraDays: EraDays;
		emojis: DayEmojis;
		notes: DayNotes;
		unavailable: boolean;
		today: DateKey;
		onsave: (era: Era) => boolean;
		onmark: (id: string, mark: DateKey[], unmark: DateKey[]) => boolean;
		onshow: (id: string) => void;
	} = $props();
	let creating = $state(false);
	let archivedOpen = $state(false);
	const orderedEras = $derived(
		eras
			.filter(({ archived }) => !archived)
			.sort((a, b) => Number(Boolean(b.autoMarkedThrough)) - Number(Boolean(a.autoMarkedThrough)))
	);
	const archivedEras = $derived(eras.filter(({ archived }) => archived));
	const histories = $derived.by(() => {
		const entries = new Map(eras.map(({ id }) => [id, [] as [DateKey, EraDay][]]));
		if (!entries.size) return entries;
		for (const [date, day] of Object.entries(eraDays)) {
			for (const [id, entry] of Object.entries(day)) entries.get(id)?.push([date, entry]);
		}
		for (const history of entries.values()) history.sort(([a], [b]) => b.localeCompare(a));
		return entries;
	});

	function create(era: Era) {
		if (!onsave(era)) return;
		creating = false;
		void goto('/eras?era=' + era.id, { reset: false });
	}
</script>

{#snippet card(era: Era)}
	<EraCard
		{era}
		history={histories.get(era.id) ?? []}
		{emojis}
		{notes}
		{today}
		{onsave}
		{onmark}
		{onshow}
	/>
{/snippet}

<div class="era-stack">
	<button class="new-era" type="button" disabled={creating} onclick={() => (creating = true)}
		>+ New era</button
	>
	{#if creating}
		<h2>New era</h2>
		<EraEditor onsave={create} oncancel={() => (creating = false)} />
	{/if}
	{#if unavailable}<p class="empty">Era unavailable.</p>{/if}
	{#each orderedEras as era (era.id)}
		{@render card(era)}
	{/each}
	{#if archivedEras.length}
		<details class="archive" bind:open={archivedOpen}>
			<summary>Archived ({archivedEras.length})</summary>
			{#if archivedOpen}
				<div class="archive-cards">
					{#each archivedEras as era (era.id)}
						{@render card(era)}
					{/each}
				</div>
			{/if}
		</details>
	{/if}
</div>

<style>
	.era-stack,
	.archive-cards {
		display: grid;
		gap: 10px;
	}
	.era-stack {
		padding: 16px;
	}
	.archive {
		border-top: 1px solid var(--line);
	}
	.archive summary {
		padding: 8px 4px;
		color: var(--muted);
		font-size: 12px;
		cursor: pointer;
	}
	.new-era {
		justify-self: end;
		min-height: 32px;
		padding: 6px 10px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: transparent;
		font-size: 12px;
	}
	.new-era:hover:not(:disabled) {
		background: #e5eae2;
	}
	h2 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}
	.empty {
		margin: 0;
		padding-block: 8px;
		font-size: 13px;
		color: var(--muted);
	}
</style>
