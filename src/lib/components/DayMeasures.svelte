<script lang="ts">
	import { paletteFor, type Measure, type MeasureValue } from '../measures';
	let {
		measures,
		values,
		onadd,
		onchange,
		onremove,
		onmanage
	}: {
		measures: Measure[];
		values: Record<string, MeasureValue>;
		onadd: (measure: Measure) => void;
		onchange: (id: string, value: MeasureValue) => void;
		onremove: (id: string) => void;
		onmanage: () => void;
	} = $props();
	let choosing = $state(false);
	const attached = $derived(measures.filter((m) => Object.hasOwn(values, m.id)));
	const available = $derived(measures.filter((m) => !Object.hasOwn(values, m.id)));
	function numberInput(event: Event, id: string) {
		const input = event.currentTarget as HTMLInputElement;
		input.setCustomValidity('');
		if (input.validity.badInput) return;
		if (!input.value) {
			onchange(id, null);
			return;
		}
		const value = input.valueAsNumber;
		if (!Number.isSafeInteger(value) || value < 0) {
			input.setCustomValidity('Enter a non-negative whole number.');
			return;
		}
		onchange(id, value);
	}
	function adjustNumber(event: MouseEvent, id: string, direction: number) {
		const input = (event.currentTarget as HTMLButtonElement)
			.closest('.number-control')!
			.querySelector('input')!;
		if (!input.reportValidity()) return;
		const current = input.value === '' ? 0 : input.valueAsNumber;
		const next = current + direction;
		if (!Number.isSafeInteger(next) || next < 0) return;
		input.value = String(next);
		onchange(id, next);
	}
</script>

<section class="day-measures" aria-label="Day measures">
	<header>
		<h3>Measures</h3>
		<button
			class="add-button"
			type="button"
			aria-label="Add measure"
			aria-expanded={choosing}
			onclick={() => (choosing = !choosing)}>+</button
		>
	</header>
	{#if choosing}
		<div class="measure-chooser">
			{#each available as measure (measure.id)}
				<button
					type="button"
					onclick={() => {
						onadd(measure);
						choosing = false;
					}}
					><span class="swatch" style:background={paletteFor(measure.palette).bright}
					></span>{measure.name}</button
				>
			{/each}
			{#if !available.length}<p>
					{measures.length ? 'All measures added.' : 'No measures yet.'}
				</p>{/if}
			<button type="button" class="manage-button" onclick={onmanage}>Manage measures</button>
		</div>
	{/if}
	<div class="measure-cards">
		{#each attached as measure (measure.id)}
			{@const p = paletteFor(measure.palette)}
			<article
				class="measure-card"
				style:--measure-faint={p.faint}
				style:--measure-bright={p.bright}
				aria-label={measure.name}
			>
				<div class="card-heading" class:boolean-heading={measure.type === 'boolean'}>
					{#if measure.type === 'boolean'}
						<label class="boolean-value">
							<input
								id={'value-' + measure.id}
								type="checkbox"
								checked={values[measure.id] === true}
								onchange={(event) => onchange(measure.id, event.currentTarget.checked)}
							/>
							<span>{measure.name}</span>
						</label>
					{:else}
						<label for={'value-' + measure.id}>{measure.name}</label>
					{/if}
					<button
						type="button"
						aria-label={'Remove ' + measure.name + ' from day'}
						title="Remove from day"
						onclick={() => onremove(measure.id)}>×</button
					>
				</div>
				{#if measure.type === 'uint'}
					<div class="number-control">
						<input
							id={'value-' + measure.id}
							type="number"
							min="0"
							max={Number.MAX_SAFE_INTEGER}
							step="1"
							inputmode="numeric"
							placeholder="—"
							value={values[measure.id] ?? ''}
							oninput={(event) => numberInput(event, measure.id)}
							onchange={(event) => event.currentTarget.reportValidity()}
						/>
						<div class="step-controls">
							<button
								type="button"
								class="step-button"
								aria-label={'Increase ' + measure.name}
								aria-controls={'value-' + measure.id}
								disabled={values[measure.id] === Number.MAX_SAFE_INTEGER}
								onclick={(event) => adjustNumber(event, measure.id, 1)}
							>
								<svg
									aria-hidden="true"
									viewBox="0 0 16 16"
									width="12"
									height="12"
									fill="none"
									stroke="currentColor"
									stroke-width="1.75"
									stroke-linecap="round"
									stroke-linejoin="round"><path d="m4 10 4-4 4 4" /></svg
								>
							</button>
							<button
								type="button"
								class="step-button"
								aria-label={'Decrease ' + measure.name}
								aria-controls={'value-' + measure.id}
								disabled={Number(values[measure.id] ?? 0) <= 0}
								onclick={(event) => adjustNumber(event, measure.id, -1)}
							>
								<svg
									aria-hidden="true"
									viewBox="0 0 16 16"
									width="12"
									height="12"
									fill="none"
									stroke="currentColor"
									stroke-width="1.75"
									stroke-linecap="round"
									stroke-linejoin="round"><path d="m4 6 4 4 4-4" /></svg
								>
							</button>
						</div>
					</div>
				{/if}
			</article>
		{/each}
	</div>
</section>

<style>
	.day-measures {
		margin-top: 24px;
	}
	header,
	.card-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	header {
		margin-bottom: 10px;
	}
	h3 {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
	}
	button {
		border: 0;
		background: transparent;
		border-radius: 3px;
	}
	.add-button {
		width: 26px;
		height: 26px;
		font-size: 20px;
		background: #e9ede6;
	}
	button:hover {
		background: #dfe7da;
	}
	.measure-chooser {
		border: 1px solid var(--line);
		border-radius: 4px;
		padding: 4px;
		margin-bottom: 10px;
	}
	.measure-chooser button {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		text-align: left;
		padding: 8px;
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	.swatch {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.measure-chooser p {
		margin: 8px;
		font-size: 12px;
		color: var(--muted);
	}
	.manage-button {
		color: var(--muted);
	}
	.measure-cards {
		display: grid;
		gap: 10px;
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
		padding: 2px 28px 2px 8px;
		text-align: left;
		background: rgb(255 255 255 / 45%);
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
