<script lang="ts">
	import { validCounterValue, type Counter } from '../counters';
	let {
		counter,
		value,
		onchange
	}: {
		counter: Counter;
		value: number | null | undefined;
		onchange: (value: number | null) => void;
	} = $props();
	function input(event: Event) {
		const field = event.currentTarget as HTMLInputElement;
		field.setCustomValidity('');
		if (field.validity.badInput) return;
		if (field.value === '') {
			onchange(null);
			return;
		}
		if (!validCounterValue(counter.id, field.valueAsNumber)) {
			field.setCustomValidity(
				counter.integer ? 'Enter a non-negative whole number.' : 'Enter a non-negative number.'
			);
			return;
		}
		onchange(field.valueAsNumber);
	}
</script>

<label
	class="counter-widget"
	title={counter.name + (counter.unit ? ' (' + counter.unit + ')' : '')}
>
	<svg
		aria-hidden="true"
		viewBox="0 0 24 24"
		width="20"
		height="20"
		fill="none"
		stroke="currentColor"
		stroke-width="1.6"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		{#if counter.id === 'weight'}
			<rect x="3" y="3" width="18" height="18" rx="4" />
			<path d="M7 9a6 6 0 0 1 10 0l-2 3H9Z M12 10l2-3" />
		{:else}
			<path d="M7 2C5 2 3.5 4 3.5 6.5c0 2 1 3.5 1 5.5h5c0-2 1-3.5 1-5.5C10.5 4 9 2 7 2Z" />
			<path d="M4.5 15h5v1a2.5 2.5 0 0 1-5 0Z" />
			<g transform="rotate(18 17 14)">
				<path d="M17 6c-2 0-3.5 2-3.5 4.5 0 2 1 3.5 1 5.5h5c0-2 1-3.5 1-5.5C20.5 8 19 6 17 6Z" />
				<path d="M14.5 19h5v1a2.5 2.5 0 0 1-5 0Z" />
			</g>
		{/if}
	</svg>
	<input
		type="number"
		aria-label={counter.name + (counter.unit ? ' (' + counter.unit + ')' : '')}
		min="0"
		max={Number.MAX_SAFE_INTEGER}
		step={counter.integer ? '1' : 'any'}
		inputmode={counter.integer ? 'numeric' : 'decimal'}
		placeholder="—"
		value={value ?? (counter.id === 'steps' ? 0 : '')}
		oninput={input}
		onchange={(event) => event.currentTarget.reportValidity()}
	/>
	{#if counter.unit}<span class="unit" aria-hidden="true">{counter.unit}</span>{/if}
</label>

<style>
	.counter-widget {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		padding: 10px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: #e9ede6;
	}
	.counter-widget:focus-within {
		border-color: var(--accent);
	}
	svg {
		flex-shrink: 0;
		color: var(--muted);
	}
	input {
		width: 100%;
		min-width: 0;
		padding: 2px 0;
		border: 0;
		border-radius: 2px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 20px;
		font-variant-numeric: tabular-nums;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	input::-webkit-inner-spin-button,
	input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	input:invalid {
		outline: 2px solid #a02d2d;
	}
	.unit {
		font-size: 11px;
		color: var(--muted);
	}
</style>
