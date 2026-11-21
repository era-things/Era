<script lang="ts">
	import { tick } from 'svelte';
	import { PALETTES, paletteFor, type Measure, type PaletteId } from '../measures';
	import {
		WIDGETS,
		type Widget,
		type LayoutState,
		type WidgetId,
		type WidgetSettings,
		type WidgetVisibility
	} from '../widgets';
	import { createResourceId } from '../resource-id';
	import { pop, reflow } from '../widget-motion';
	import WidgetPreview from './WidgetPreview.svelte';
	let {
		measures,
		onsave,
		ondelete,
		layout,
		onsettings
	}: {
		measures: Measure[];
		onsave: (measure: Measure) => boolean;
		ondelete: (id: string) => boolean;
		layout: LayoutState;
		onsettings: (id: WidgetId, patch: Partial<WidgetSettings>) => void;
	} = $props();
	let editing = $state<string | null>(null);
	let creating = $state(false);
	let name = $state('');
	let type = $state<Measure['type']>('uint');
	let palette = $state<PaletteId>('green');
	let error = $state('');
	let deleting = $state<string | null>(null);
	let nameInput = $state<HTMLInputElement>();
	let masonryReady = $state(false);
	let hiddenOpen = $state(false);
	let manager: HTMLDivElement;
	const visibleWidgets = $derived(
		WIDGETS.filter(({ id }) => layout.widgets[id].visibility !== 'hidden')
	);
	const hiddenWidgets = $derived(
		WIDGETS.filter(({ id }) => layout.widgets[id].visibility === 'hidden')
	);
	const visibilityOptions = {
		pinned: { label: 'Pinned', description: 'Show every day', next: 'available' },
		available: { label: 'Available', description: 'Offer in Add widget', next: 'with-data' },
		'with-data': { label: 'With data', description: 'Show on days with nonempty entries', next: 'pinned' }
	} as const satisfies Record<
		Exclude<WidgetVisibility, 'hidden'>,
		{ label: string; description: string; next: Exclude<WidgetVisibility, 'hidden'> }
	>;
	async function setHidden(id: WidgetId, hidden: boolean) {
		if (!hidden && hiddenWidgets.length === 1) hiddenOpen = false;
		onsettings(id, { visibility: hidden ? 'hidden' : 'available' });
		await tick();
		const target = hidden
			? hiddenOpen
				? `[data-widget-id="${id}"] .restore-widget`
				: '.hidden-widgets summary'
			: `[data-widget-id="${id}"] .visibility-button`;
		manager.querySelector<HTMLElement>(target)?.focus();
	}
	function masonry(node: HTMLDivElement) {
		const update = (card: HTMLElement) => {
			card.style.setProperty(
				'--card-rows',
				String(Math.ceil(card.getBoundingClientRect().height + 12))
			);
		};
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) update(entry.target as HTMLElement);
		});
		const observed = new Set<Element>();
		const sync = () => {
			for (const card of observed)
				if (card.parentElement !== node) {
					observer.unobserve(card);
					observed.delete(card);
				}
			for (const card of node.children)
				if (!observed.has(card)) {
					update(card as HTMLElement);
					observer.observe(card);
					observed.add(card);
				}
		};
		const mutations = new MutationObserver(sync);
		mutations.observe(node, { childList: true });
		sync();
		masonryReady = true;
		return {
			destroy: () => {
				observer.disconnect();
				mutations.disconnect();
			}
		};
	}
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
		if (onsave({ id: editing ?? createResourceId(), name: trimmed, type, palette }))
			creating = false;
	}
</script>

{#snippet widgetCard(definition: Widget)}
	{@const settings = layout.widgets[definition.id]}
	{@const visibility = settings.visibility}
	{#if visibility !== 'hidden'}
		{@const option = visibilityOptions[visibility]}
		<div
			class="built-in-row"
			data-widget-id={definition.id}
			class:pinned={visibility === 'pinned'}
			class:has-skins={definition.skins.length > 1}
		>
			<div class="built-in-controls">
				<span>{definition.name}</span>
				<div class="widget-actions">
					<button
						type="button"
						class="widget-action visibility-button"
						data-visibility={visibility}
						aria-label={`${definition.name} visibility: ${option.label}. Change to ${visibilityOptions[option.next].label}`}
						title={`${option.description}. Click to change to ${visibilityOptions[option.next].label}.`}
						onclick={() => onsettings(definition.id, { visibility: option.next })}
					>{option.label}</button>
					<button
						type="button"
						class="widget-action hide-widget"
						aria-label={'Hide ' + definition.name}
						title={'Hide ' + definition.name}
						onclick={() => setHidden(definition.id, true)}
					>
						<svg
							aria-hidden="true"
							viewBox="0 0 24 24"
							width="14"
							height="14"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.6 10.6 0 0 1 12 5c6 0 10 7 10 7a16 16 0 0 1-2.2 2.8M6.4 6.4C3.6 8.5 2 12 2 12s4 7 10 7a10 10 0 0 0 5-1.4" />
						</svg>
					</button>
				</div>
			</div>
			<WidgetPreview
				{definition}
				{settings}
				onchange={(skin) => onsettings(definition.id, { skin })}
			/>
		</div>
	{/if}
{/snippet}

<div
	class="layout-manager"
	id="layout-panel"
	role="tabpanel"
	aria-labelledby="tab-layout"
	bind:this={manager}
>
	<section class="built-in-measures" aria-label="Widgets">
		<h2>Widgets</h2>
		<div class="built-in-cards" data-masonry={masonryReady} use:masonry>
			{#each visibleWidgets as definition (definition.id)}{@render widgetCard(definition)}{/each}
		</div>
	</section>
	{#if hiddenWidgets.length}
		<details class="hidden-widgets" bind:open={hiddenOpen}>
			<summary>Hidden widgets <span class="hidden-count">{hiddenWidgets.length}</span></summary>
			{#each hiddenWidgets as definition (definition.id)}
				<div class="hidden-widget" data-widget-id={definition.id}>
					<span>{definition.name}</span>
					<button
						type="button"
						class="restore-widget"
						aria-label={'Restore ' + definition.name}
						onclick={() => setHidden(definition.id, false)}
					>Restore</button>
				</div>
			{/each}
		</details>
	{/if}
	<div class="manager-heading">
		<h2>Custom measures</h2>
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
	<div class="measure-list" use:reflow>
		{#each measures as measure (measure.id)}
			{@const p = paletteFor(measure.palette)}
			<div class="measure-row" transition:pop>
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
	.layout-manager {
		flex: 1;
		overflow: auto;
		padding: 18px 24px 24px;
	}
	.manager-heading,
	.built-in-measures,
	.hidden-widgets,
	.measure-list,
	.measure-form {
		max-width: 680px;
		margin-inline: auto;
	}
	.built-in-measures {
		margin-bottom: 20px;
	}
	.built-in-measures > h2 {
		margin-bottom: 12px;
	}
	.built-in-cards {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-auto-flow: dense;
		column-gap: 12px;
		row-gap: 12px;
		align-items: start;
	}
	.built-in-cards[data-masonry='true'] {
		grid-auto-rows: 1px;
		row-gap: 0;
	}
	.built-in-row {
		display: grid;
		width: 100%;
		grid-row-end: span var(--card-rows, 1);
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: 6px;
		min-width: 0;
		padding: 6px 12px 8px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--paper);
		font-size: 14px;
	}
	.built-in-row.pinned {
		border-color: color-mix(in srgb, var(--accent) 30%, var(--line));
	}
	.built-in-row.has-skins {
		padding-bottom: 4px;
	}
	.built-in-controls {
		width: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 8px;
	}
	.built-in-controls > span {
		font-weight: 600;
		line-height: 24px;
	}

	.widget-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.widget-action {
		display: grid;
		place-items: center;
		height: 24px;
		padding: 0 6px;
		color: var(--muted);
		white-space: nowrap;
	}
	.hide-widget {
		width: 24px;
		padding: 0;
	}
	.visibility-button {
		min-width: 68px;
	}
	.visibility-button[data-visibility='pinned'] {
		color: var(--accent);
		background: #dfe7da;
		border-color: var(--accent);
	}
	.hidden-widgets {
		margin-bottom: 20px;
		padding: 0 12px 10px;
		border: 1px solid var(--line);
		border-radius: 8px;
	}
	.hidden-widgets:not([open]) {
		padding-bottom: 0;
	}
	.hidden-widgets summary {
		padding: 10px 0;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
	}
	.hidden-widgets summary:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.hidden-count {
		margin-left: 6px;
		font-size: 12px;
		font-weight: 400;
		color: var(--muted);
	}
	.hidden-widget {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 0;
		border-top: 1px solid var(--line);
		font-size: 14px;
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
	.measure-form input:not([type='radio']),
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
	@media (max-width: 700px) {
		.built-in-cards {
			grid-template-columns: minmax(0, 1fr);
		}
		.built-in-cards[data-masonry='true'] {
			grid-auto-rows: auto;
			row-gap: 12px;
		}
		.built-in-row {
			grid-row-end: auto;
		}
	}
	@media (max-width: 560px) {
		.layout-manager {
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
