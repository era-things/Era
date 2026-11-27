<script module lang="ts">
	import type { Measure, MeasureValue } from '../measures';

	export type DayMeasure = Omit<Measure, 'type'> & {
		type: Measure['type'] | 'number';
		value: MeasureValue;
		onchange: (value: MeasureValue) => void;
		onremove: () => void;
	};
</script>

<script lang="ts">
	import Chevron from './Chevron.svelte';
	import { paletteFor } from '../measures';
	import { highlightRemote, pop, reflow } from '../widget-motion';
	let { measures, remoteRevision }: { measures: DayMeasure[]; remoteRevision: number } = $props();
	const inputId = $props.id();
	function updateCount(input: HTMLInputElement, measure: DayMeasure) {
		input.setCustomValidity('');
		if (input.validity.badInput) return;
		if (!input.value) {
			measure.onchange(null);
			return;
		}
		const value = input.valueAsNumber;
		if (!Number.isSafeInteger(value) || value < 0) {
			input.setCustomValidity('Enter a non-negative whole number.');
			return;
		}
		measure.onchange(value);
	}
	function adjustNumber(event: MouseEvent, measure: DayMeasure, direction: number) {
		const input = (event.currentTarget as HTMLButtonElement)
			.closest('.number-control')!
			.querySelector('input')!;
		if (!input.reportValidity()) return;
		const current = input.value === '' ? 0 : input.valueAsNumber;
		const next = current + direction;
		if (!Number.isSafeInteger(next) || next < 0) return;
		input.value = String(next);
		measure.onchange(next);
	}
</script>

<section class="day-measures" aria-label="Custom measurements" use:reflow>
	{#each measures as measure (measure.id)}
		{@const p = paletteFor(measure.palette)}
		<article
			class="measure-card"
			style:--measure-faint={p.faint}
			style:--measure-bright={p.bright}
			aria-label={measure.name}
			use:highlightRemote={{ revision: remoteRevision, value: measure.value }}
			transition:pop
		>
			<div class="card-heading" class:boolean-heading={measure.type === 'boolean'}>
				{#if measure.type === 'boolean'}
					<label class="boolean-value">
						<input
							id={inputId + '-' + measure.id}
							type="checkbox"
							checked={measure.value === true}
							onchange={(event) => measure.onchange(event.currentTarget.checked)}
						/>
						<span>{measure.name}</span>
					</label>
				{:else}
					<label for={inputId + '-' + measure.id}>{measure.name}</label>
				{/if}
				<button
					type="button"
					aria-label={'Remove ' + measure.name + ' from day'}
					title="Remove from day"
					onclick={measure.onremove}>×</button
				>
			</div>
			{#if measure.type !== 'boolean'}
				<div class="number-control">
					<input
						id={inputId + '-' + measure.id}
						type="number"
						class:count={measure.type === 'uint'}
						min={measure.type === 'uint' ? 0 : undefined}
						max={measure.type === 'uint' ? Number.MAX_SAFE_INTEGER : undefined}
						step={measure.type === 'uint' ? '1' : 'any'}
						inputmode={measure.type === 'uint' ? 'numeric' : undefined}
						placeholder="—"
						value={measure.value ?? ''}
						oninput={(event) => {
							if (measure.type === 'uint') updateCount(event.currentTarget, measure);
						}}
						onchange={({ currentTarget: input }) => {
							if (input.reportValidity() && measure.type === 'number') {
								const value = input.value === '' ? null : input.valueAsNumber;
								if (value === null || Number.isFinite(value)) measure.onchange(value);
							}
						}}
					/>
					{#if measure.type === 'uint'}<div class="step-controls">
							{#each [1, -1] as direction}
								<button
									type="button"
									class="step-button"
									aria-label={(direction > 0 ? 'Increase ' : 'Decrease ') + measure.name}
									aria-controls={inputId + '-' + measure.id}
									disabled={direction > 0
										? measure.value === Number.MAX_SAFE_INTEGER
										: Number(measure.value ?? 0) <= 0}
									onclick={(event) => adjustNumber(event, measure, direction)}
								>
									<Chevron direction={direction > 0 ? 'up' : 'down'} size={12} />
								</button>
							{/each}
						</div>{/if}
				</div>
			{/if}
		</article>
	{/each}
</section>

<style>
	.day-measures {
		display: grid;
		gap: 10px;
	}
	.day-measures:not(:has(> .measure-card)) {
		display: none;
	}
	.card-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	button {
		border: 0;
		background: transparent;
		border-radius: 3px;
	}
	.measure-card {
		padding: 10px 12px;
		background: var(--measure-faint);
		border: 1px solid transparent;
		border-radius: 4px;
		min-width: 0;
	}
	.measure-card:hover,
	.measure-card:active,
	.measure-card:focus-within {
		border-color: var(--measure-bright);
	}
	.card-heading {
		margin-bottom: 8px;
	}
	.boolean-heading {
		margin-bottom: 0;
	}
	.card-heading label {
		font-size: 12px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.card-heading button {
		font-size: 18px;
		width: 22px;
		height: 22px;
		flex-shrink: 0;
		color: var(--muted);
		padding: 0;
	}
	.number-control {
		position: relative;
	}
	.step-controls {
		position: absolute;
		top: 1px;
		right: 1px;
		bottom: 1px;
		width: 24px;
		display: grid;
		grid-template-rows: repeat(2, minmax(0, 1fr));
	}
	.step-button {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		padding: 0;
		color: var(--muted);
		background: transparent;
		border-radius: 2px;
	}
	.step-button:hover:not(:disabled),
	.step-button:active:not(:disabled) {
		background: color-mix(in srgb, var(--measure-bright) 15%, var(--measure-faint));
	}
	input[type='number'] {
		height: 32px;
		appearance: textfield;
		-moz-appearance: textfield;
		width: 100%;
		min-width: 0;
		font: inherit;
		font-size: 20px;
		font-variant-numeric: tabular-nums;
		border: 1px solid transparent;
		border-radius: 3px;
		color: var(--ink);
		padding: 2px 8px;
		text-align: left;
		background: rgb(255 255 255 / 45%);
	}
	input.count {
		padding-right: 28px;
	}
	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input:focus-visible {
		outline: 2px solid var(--measure-bright);
		outline-offset: 2px;
	}
	input:invalid {
		border-color: #a02d2d;
	}
	.boolean-value {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		cursor: pointer;
	}
	input[type='checkbox'] {
		flex-shrink: 0;
		margin: 0;
		width: 18px;
		height: 18px;
		accent-color: var(--measure-bright);
	}
	@media (max-width: 560px) {
		.measure-card {
			padding: 8px;
		}
		.card-heading {
			gap: 4px;
		}
		.card-heading label {
			font-size: 11px;
		}
		.card-heading button {
			width: 18px;
			height: 18px;
		}
	}
</style>
