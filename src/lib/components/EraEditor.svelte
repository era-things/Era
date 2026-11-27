<script lang="ts">
	import { untrack } from 'svelte';
	import {
		ERA_DESCRIPTION_LIMIT,
		ERA_LINKED_VALUES,
		ERA_NAME_LIMIT,
		eraPalette,
		type Era,
		type EraLinkedValue
	} from '../eras';
	import { PALETTES, type PaletteId } from '../measures';
	import { createResourceId } from '../resource-id';
	import MarkdownNote from './MarkdownNote.svelte';

	let {
		era,
		onsave,
		oncancel
	}: {
		era?: Era;
		onsave: (era: Era) => void;
		oncancel: () => void;
	} = $props();
	let name = $state(untrack(() => era?.name ?? ''));
	let description = $state(untrack(() => era?.description ?? ''));
	let palette = $state<PaletteId>(untrack(() => eraPalette(era ?? {}).id));
	let linkedValue = $state<EraLinkedValue>(untrack(() => era?.linkedValue ?? 'none'));
	const descriptionTooLong = $derived(description.trim().length > ERA_DESCRIPTION_LIMIT);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim() || descriptionTooLong) return;
		onsave({
			...era,
			id: era?.id ?? createResourceId(),
			name: name.trim(),
			description: description.trim(),
			archived: era?.archived ?? false,
			linkedValue,
			palette
		});
	}
</script>

<form onsubmit={submit}>
	<label>Name<input required maxlength={ERA_NAME_LIMIT} bind:value={name} /></label>
	<div class="description-field">
		<span>Description</span>
		<MarkdownNote
			value={description}
			readonly={false}
			options={{ label: 'Description', placeholder: '' }}
			regionLabel="Era description"
			compact
			onchange={(value) => (description = value)}
		/>
		{#if descriptionTooLong}<p role="alert">
				Use {ERA_DESCRIPTION_LIMIT} characters or fewer.
			</p>{/if}
	</div>
	<label>
		Linked value
		<select bind:value={linkedValue}>
			{#each Object.entries(ERA_LINKED_VALUES) as [value, label] (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
	</label>
	<fieldset>
		<legend>Color</legend>
		<div class="colors">
			{#each PALETTES as color (color.id)}
				<label class="color" title={color.name}>
					<input
						type="radio"
						name="era-color"
						value={color.id}
						bind:group={palette}
						aria-label={color.name}
						style:--swatch={color.bright}
						style:--fill={color.medium}
					/>
				</label>
			{/each}
		</div>
	</fieldset>
	<div class="actions">
		<button class="primary" type="submit" disabled={!name.trim() || descriptionTooLong}
			>{era ? 'Save changes' : 'Create era'}</button
		>
		<button type="button" onclick={oncancel}>Cancel</button>
	</div>
</form>

<style>
	form {
		display: grid;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: 4px;
	}
	form > label,
	.description-field {
		display: grid;
		gap: 4px;
		min-width: 0;
		font-size: 12px;
	}
	input:not([type='radio']),
	select {
		width: 100%;
		min-height: 32px;
		padding: 5px 8px;
		font: inherit;
		color: inherit;
		border: 1px solid #bdc8bc;
		border-radius: 3px;
		background: var(--paper);
	}
	.description-field p {
		margin: 0;
		color: #a02d2d;
	}
	fieldset {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: 4px;
		padding: 0;
		font-size: 12px;
	}
	.colors,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.color input {
		appearance: none;
		display: block;
		width: 26px;
		height: 26px;
		margin: 0;
		border: 1px solid var(--swatch);
		border-radius: 4px;
		background: var(--fill);
		cursor: pointer;
	}
	.color input:checked {
		box-shadow:
			inset 0 0 0 2px var(--paper),
			inset 0 0 0 4px var(--swatch);
	}
	.color input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	button {
		min-height: 32px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: transparent;
		padding: 6px 10px;
		font-size: 12px;
	}
	button:hover:not(:disabled) {
		background: #e5eae2;
	}
	.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}
	.primary:hover:not(:disabled) {
		background: #1b574b;
	}
	.primary:disabled {
		opacity: 1;
		background: #e5eae2;
		border-color: var(--line);
		color: var(--muted);
	}
</style>
