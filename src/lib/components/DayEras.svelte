<script lang="ts">
	import { tick } from 'svelte';
	import { eraPalette, type Era, type EraDay } from '../eras';

	let {
		eras,
		entries,
		onmark
	}: {
		eras: Era[];
		entries: Record<string, EraDay>;
		onmark: (id: string, marked: boolean) => boolean;
	} = $props();
	let choosing = $state(false);
	let addButton: HTMLButtonElement | undefined = $state();
	const choices = $derived(eras.filter((era) => !era.archived && !entries[era.id]?.marked));
	const linked = $derived(eras.filter(({ id }) => entries[id]));

	async function mark(id: string) {
		if (!onmark(id, true)) return;
		choosing = false;
		await tick();
		addButton?.focus();
	}
</script>

{#if linked.length || eras.some(({ archived }) => !archived)}
	<div class="day-eras" role="group" aria-label="Day eras">
		<div class="tags">
			{#each linked as era (era.id)}
				<span class="tag" style:--era-fill={eraPalette(era).faint}>
					<a href={'/eras?era=' + era.id} title={era.name}>{era.name}</a>
					{#if entries[era.id]?.marked}
						<button
							type="button"
							aria-label={'Unmark ' + era.name}
							onclick={() => onmark(era.id, false)}>×</button
						>
					{/if}
				</span>
			{/each}
			<button
				type="button"
				class="add-era"
				aria-expanded={choosing && choices.length > 0}
				hidden={!choices.length}
				bind:this={addButton}
				onclick={() => (choosing = !choosing)}>+ Era</button
			>
		</div>
		{#if choosing && choices.length}
			<div class="choices">
				{#each choices as era (era.id)}
					<button type="button" onclick={() => mark(era.id)}>
						<span class="swatch" style:background={eraPalette(era).bright} aria-hidden="true"
						></span>
						{era.name}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.day-eras {
		margin-top: 10px;
		font-size: 12px;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.tag {
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		border-radius: 3px;
		background: var(--era-fill);
	}
	a {
		padding: 3px 5px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--ink);
		text-decoration: none;
	}
	a:hover {
		text-decoration: underline;
	}
	a:focus-visible {
		outline: 2px solid var(--accent);
	}
	button {
		border: 0;
		border-radius: 3px;
		padding: 3px 5px;
		background: transparent;
		color: var(--muted);
	}
	button:hover {
		background: #dfe7da;
	}
	.tag button {
		flex-shrink: 0;
	}
	.add-era {
		border: 1px solid var(--line);
	}
	.choices {
		display: grid;
		margin-top: 4px;
		padding: 4px;
		border: 1px solid var(--line);
		border-radius: 4px;
	}
	.choices button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px;
		text-align: left;
		overflow-wrap: anywhere;
	}
	.swatch {
		flex: 0 0 8px;
		height: 8px;
		border-radius: 50%;
	}
</style>
