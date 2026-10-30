<script lang="ts">
	import { PALETTES, paletteFor, type Measure, type PaletteId } from '../measures';
	let {
		measures,
		onsave,
		ondelete
	}: {
		measures: Measure[];
		onsave: (measure: Measure) => boolean;
		ondelete: (id: string) => boolean;
	} = $props();
	let editing = $state<string | null>(null);
	let creating = $state(false);
	let name = $state('');
	let type = $state<Measure['type']>('uint');
	let palette = $state<PaletteId>('green');
	let error = $state('');
	let deleting = $state<string | null>(null);
	let nameInput = $state<HTMLInputElement>();
	function edit(measure?: Measure) {
		editing = measure?.id ?? null;
		creating = true;
		name = measure?.name ?? '';
		type = measure?.type ?? 'uint';
		palette = measure?.palette ?? 'green';
		error = '';
		deleting = null;
		requestAnimationFrame(() => nameInput?.focus());
	}
	function save(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) {
			error = 'Enter a name.';
			return;
		}
		if (
			measures.some(
				(m) => m.id !== editing && m.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase()
			)
		) {
			error = 'A measure with this name already exists.';
			return;
		}
		if (onsave({ id: editing ?? crypto.randomUUID(), name: trimmed, type, palette }))
			creating = false;
	}
</script>

<div class="measures-manager" id="measures-panel" role="tabpanel" aria-labelledby="tab-measures">
	<div class="manager-heading">
		<h2>Measures</h2>
		<button type="button" onclick={() => edit()}>+ New measure</button>
	</div>
	{#if creating}
		<form onsubmit={save} class="measure-form">
			<label>Name<input bind:this={nameInput} bind:value={name} maxlength="80" required /></label>
			<label
				>Type<select
					bind:value={type}
					disabled={editing !== null}
					title={editing ? 'Type is fixed after creation to preserve day values.' : undefined}
				>
					<option value="uint">Number (unsigned integer)</option><option value="boolean"
						>Boolean (true / false)</option
					>
				</select></label
			>
			<fieldset>
				<legend>Color palette</legend>
				<div class="palette-options">
					{#each PALETTES as p}
						<label class="palette-option"
							><input type="radio" name="palette" value={p.id} bind:group={palette} />
							<span
								class="palette-strip"
								style:--faint={p.faint}
								style:--medium={p.medium}
								style:--bright={p.bright}
							></span><span>{p.name}</span>
						</label>
					{/each}
				</div>
			</fieldset>
			{#if error}<p role="alert" class="form-error">{error}</p>{/if}
			<div class="form-actions">
				<button class="primary" type="submit">{editing ? 'Save changes' : 'Create measure'}</button
				><button type="button" onclick={() => (creating = false)}>Cancel</button>
			</div>
		</form>
	{/if}
	<div class="measure-list">
		{#each measures as measure (measure.id)}
			{@const p = paletteFor(measure.palette)}
			<div class="measure-row">
				<span
					class="palette-strip"
					aria-label={p.name + ' palette'}
					style:--faint={p.faint}
					style:--medium={p.medium}
					style:--bright={p.bright}
				></span>
				<div class="measure-info">
					<strong>{measure.name}</strong><span
						>{measure.type === 'uint' ? 'Number' : 'Boolean'}</span
					>
				</div>
				<button type="button" aria-label={'Edit ' + measure.name} onclick={() => edit(measure)}
					>Edit</button
				>
				<button
					type="button"
					aria-label={'Delete ' + measure.name}
					onclick={() => (deleting = measure.id)}>Delete</button
				>
			</div>
			{#if deleting === measure.id}<div class="delete-confirm">
					<span>Delete {measure.name} and all its day values?</span><button
						type="button"
						onclick={() => {
							if (ondelete(measure.id)) {
								deleting = null;
								if (editing === measure.id) creating = false;
							}
						}}>Delete measure</button
					><button type="button" onclick={() => (deleting = null)}>Cancel</button>
				</div>{/if}
		{/each}
		{#if !measures.length && !creating}<p class="empty">No measures yet.</p>{/if}
	</div>
</div>

<style>
	.measures-manager {
		flex: 1;
		overflow: auto;
		padding: 24px;
	}
	.manager-heading,
	.measure-list,
	.measure-form {
		max-width: 680px;
		margin-inline: auto;
	}
	.manager-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 20px;
	}
	h2 {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
	}
	button {
		border: 1px solid var(--line);
		border-radius: 4px;
		background: transparent;
		padding: 6px 10px;
		font-size: 12px;
	}
	button:hover {
		background: #e5eae2;
	}
	.measure-form {
		border: 1px solid var(--line);
		padding: 18px;
		margin-bottom: 20px;
		display: grid;
		gap: 16px;
	}
	.measure-form > label {
		display: grid;
		gap: 6px;
		font-size: 12px;
	}
	input:not([type='radio']),
	select {
		min-width: 0;
		width: 100%;
		font: inherit;
		color: inherit;
		border: 1px solid #bdc8bc;
		border-radius: 3px;
		padding: 8px;
		background: var(--paper);
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	legend {
		font-size: 12px;
		margin-bottom: 8px;
	}
	.palette-options {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	.palette-option {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		cursor: pointer;
	}
	.palette-option input {
		margin: 0;
		accent-color: var(--accent);
	}
	.palette-strip {
		display: block;
		width: 54px;
		height: 20px;
		flex-shrink: 0;
		border-radius: 3px;
		background: linear-gradient(to right, var(--faint), var(--medium), var(--bright));
	}
	.form-actions {
		display: flex;
		gap: 8px;
	}
	.primary {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}
	.primary:hover {
		background: #1b574b;
	}
	.measure-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 0;
		border-bottom: 1px solid var(--line);
	}
	.measure-info {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 3px;
		overflow-wrap: anywhere;
	}
	strong {
		font-weight: 600;
		font-size: 14px;
	}
	.measure-info > span,
	.empty {
		color: var(--muted);
		font-size: 12px;
	}
	.delete-confirm {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		padding: 12px;
		font-size: 12px;
		background: #f5e5e8;
	}
	.form-error {
		margin: 0;
		color: #a02d2d;
		font-size: 12px;
	}
	@media (max-width: 560px) {
		.measures-manager {
			padding: 16px;
		}
		.palette-options {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.palette-option {
			flex-wrap: wrap;
		}
		.measure-row {
			gap: 8px;
		}
		.measure-row > .palette-strip {
			width: 32px;
		}
	}
</style>
