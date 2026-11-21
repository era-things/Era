<script lang="ts">
	import { changeDurationPart, formatDurationPart, validTime } from '../duration';
	import { screenAppShares, type ScreenApp } from '../screen-apps';
	import Chevron from './Chevron.svelte';
	import ScreenTimeBreakdown from './ScreenTimeBreakdown.svelte';
	import WidgetIcon from './WidgetIcon.svelte';
	import { widgetFor, type TimeId } from '../widgets';
	import { pop } from '../widget-motion';
	let {
		id,
		value,
		screenApps = [],
		readonly = false,
		onchange
	}: {
		id: TimeId;
		value: number | null;
		screenApps?: readonly ScreenApp[];
		readonly?: boolean;
		onchange: (value: number | null) => boolean | void;
	} = $props();
	const definition = $derived(widgetFor(id));
	const name = $derived(definition.name);
	const hours = $derived(formatDurationPart(value, 'hours'));
	const minutes = $derived(formatDurationPart(value, 'minutes'));
	const units = ['hours', 'minutes'] as const;
	const apps = $derived(screenAppShares(screenApps, value));
	const top = $derived(apps[0]);
	const hasBreakdown = $derived(apps.length > 1);
	function change(event: Event, unit: 'hours' | 'minutes') {
		const input = event.currentTarget as HTMLInputElement;
		input.setCustomValidity('');
		if (!input.validity.valid) {
			input.reportValidity();
			return;
		}
		const next = changeDurationPart(value, unit, input.value === '' ? null : input.valueAsNumber);
		if (next !== null && !validTime(next)) {
			input.setCustomValidity('Enter a duration of at most 24 hours.');
			input.reportValidity();
			return;
		}
		const accepted = onchange(next) !== false;
		const current = accepted ? next : value;
		input.value = formatDurationPart(current, unit);
	}
</script>

{#snippet row(editable: boolean)}
	<WidgetIcon icon={definition.icon} />
	<span class="time-duration" role="group" aria-label={name + ' duration'}>
		{#each units as unit}
			{#if editable}
				<label
					><input
						class:hours={unit === 'hours'}
						type="number"
						aria-label={name + ' ' + unit}
						min="0"
						max={unit === 'hours' ? 24 : 59}
						step="1"
						inputmode="numeric"
						{readonly}
						placeholder="—"
						value={unit === 'hours' ? hours : minutes}
						oninput={(event) => event.currentTarget.setCustomValidity('')}
						onfocus={(event) => event.currentTarget.select()}
						onchange={(event) => change(event, unit)}
						onkeydown={(event) => {
							if (event.key === 'Enter') event.currentTarget.blur();
						}}
					/><span>{unit === 'hours' ? 'h' : 'm'}</span></label
				>
			{:else}
				<span class="duration-part">
					{(unit === 'hours' ? hours : minutes) || '—'}<small>{unit === 'hours' ? 'h' : 'm'}</small>
				</span>
			{/if}
		{/each}
	</span>
	{#if top}
		<span class="app-summary">
			<span class="summary-name" title={top.name}>{top.name}</span>
			{#if hasBreakdown}<span>{Math.round(top.share)}%</span>{/if}
		</span>
	{/if}
	{#if hasBreakdown}
		<span class="drawer-chevron"><Chevron direction="down" size={12} /></span>
	{/if}
{/snippet}

<section class={id} aria-label={name} title={name}>
	{#if hasBreakdown}
		<details class="widget-drawer" out:pop>
			<summary class="time-widget">{@render row(false)}</summary>
			<ScreenTimeBreakdown {apps} />
		</details>
	{:else}
		<div class="time-widget">{@render row(true)}</div>
	{/if}
</section>

<style>
	section {
		display: grid;
	}
	section > :is(details, .time-widget) {
		grid-area: 1 / 1;
	}
	.time-widget {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-width: 0;
		height: 26px;
		padding: 2px 7px;
		border: 1px solid transparent;
		border-radius: 4px;
		font-variant-numeric: tabular-nums;
		color: var(--time-ink);
		background: var(--time-surface);
	}
	.time-widget > :global(svg) {
		flex: 0 0 16px;
		color: var(--time-accent);
	}
	.time-duration {
		display: flex;
		align-items: baseline;
		gap: 3px;
		height: 20px;
	}
	label,
	.duration-part {
		display: flex;
		align-items: baseline;
		gap: 1px;
	}
	label span,
	.duration-part small {
		font-size: 10px;
		color: var(--time-muted);
	}
	input {
		width: 2ch;
		min-width: 0;
		height: 20px;
		padding: 0;
		border: 0;
		border-radius: 2px;
		color: var(--time-ink);
		background: transparent;
		font: inherit;
		font-size: 16px;
		line-height: 20px;
		font-variant-numeric: tabular-nums;
		text-align: left;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	input.hours {
		field-sizing: content;
		width: auto;
		min-width: 1ch;
		max-width: 2ch;
	}
	input::-webkit-inner-spin-button,
	input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input:focus-visible {
		outline: 2px solid var(--time-accent);
		outline-offset: 0;
	}
	input:invalid {
		outline: 2px solid #db6868;
	}
	input::placeholder {
		color: var(--time-muted);
		opacity: 1;
	}
	.time-widget:focus-within {
		border-color: var(--time-accent);
	}
	summary {
		list-style: none;
		cursor: pointer;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover {
		background: color-mix(in srgb, var(--time-surface) 88%, var(--time-accent));
	}
	details[open] > summary {
		border-end-start-radius: 0;
		border-end-end-radius: 0;
	}
	.app-summary {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		margin-inline-start: auto;
		color: var(--time-muted);
		font-size: 11px;
		white-space: nowrap;
	}
	.summary-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.drawer-chevron {
		display: inline-flex;
		flex: 0 0 12px;
	}
	details[open] .drawer-chevron {
		transform: rotate(180deg);
	}
	.phone {
		--time-ink: #edeaf5;
		--time-muted: #beb7d2;
		--time-accent: #b7abd6;
		--time-surface: #393449;
	}
	.gym {
		--time-ink: #e5efe9;
		--time-muted: #b4cabe;
		--time-accent: #a7c9ad;
		--time-surface: #334c45;
	}
	.reading {
		--time-ink: #3f4c3f;
		--time-muted: #5f715d;
		--time-accent: #506c4f;
		--time-surface: #e5eadc;
	}
	.movie {
		--time-ink: #f2e8e9;
		--time-muted: #d2bfc7;
		--time-accent: #e0b6c4;
		--time-surface: #513d49;
	}
	.steam {
		--time-ink: #ebf4fa;
		--time-muted: #a9c8dc;
		--time-accent: #b0d7ed;
		--time-surface: #233e52;
	}
</style>
