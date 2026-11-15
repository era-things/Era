<script lang="ts">
	import { validCounterValue, type Counter, type WidgetSkin } from '../widgets';
	let {
		counter,
		skin,
		value,
		onchange
	}: {
		counter: Counter;
		skin: WidgetSkin;
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
	class:weight-scale={counter.id === 'weight' && skin === 'scale'}
	class:weight-display={counter.id === 'weight' && skin === 'display'}
	class:lcd={skin !== 'simple'}
	data-lcd={skin === 'display' || undefined}
	class:steps-pedometer={counter.id === 'steps' && skin === 'pedometer'}
	title={counter.name + (counter.unit ? ' (' + counter.unit + ')' : '')}
>
	{#if skin === 'simple' || skin === 'pedometer'}<svg
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
		</svg>{/if}
	<span class="counter-readout" data-lcd={skin === 'scale' || skin === 'pedometer' || undefined}>
		<input
			type="number"
			aria-label={counter.name + (counter.unit ? ' (' + counter.unit + ')' : '')}
			min="0"
			max={Number.MAX_SAFE_INTEGER}
			step={counter.integer ? '1' : 'any'}
			inputmode={counter.integer ? 'numeric' : 'decimal'}
			placeholder="—"
			value={value ?? counter.initial ?? ''}
			oninput={input}
			onchange={(event) => event.currentTarget.reportValidity()}
		/>
		{#if counter.unit}<span class="unit" aria-hidden="true">{counter.unit}</span>{/if}
	</span>
</label>

<style>
	.counter-widget {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		height: 52px;
		padding: 10px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: #e9ede6;
	}
	.counter-widget:focus-within {
		border-color: var(--accent);
	}
	.counter-readout {
		display: flex;
		align-items: baseline;
		gap: 5px;
		flex: 1;
		min-width: 0;
	}
	.weight-scale {
		justify-content: center;
		padding: 8px 12px;
		border-color: #b9c3b6;
		border-radius: 12px 12px 7px 7px;
		background: linear-gradient(165deg, #f0f2ec, #dde3d8);
		box-shadow:
			inset 0 1px 0 #fff,
			inset 0 -3px 0 #c6cec1;
	}
	.lcd {
		--lcd-surface: #d6dfc9;
		--lcd-border: #a3af97;
		--lcd-ink: #34442d;
		--lcd-font-size: 22px;
		--lcd-input-height: 26px;
		--lcd-shadow: rgb(52 68 42 / 13%);
	}
	[data-lcd] {
		padding: 2px 6px;
		border: 1px solid var(--lcd-border);
		border-radius: 4px;
		background: var(--lcd-surface);
		box-shadow:
			inset 0 2px 3px var(--lcd-shadow),
			0 1px 0 rgb(255 255 255 / 35%);
	}
	.weight-scale .counter-readout {
		flex: 0 1 96px;
	}
	.weight-display {
		--lcd-font-size: 32px;
		--lcd-input-height: 38px;
		padding: 6px 8px;
	}
	.lcd input {
		height: var(--lcd-input-height);
		padding: 0;
		font-family: 'Consolas', 'Liberation Mono', monospace;
		font-size: var(--lcd-font-size);
		line-height: 1.2;
		letter-spacing: -0.8px;
		text-align: right;
		color: var(--lcd-ink);
		text-shadow: 0 1px 0 rgb(255 255 255 / 35%);
	}
	.lcd input::placeholder {
		color: #758268;
		opacity: 1;
	}
	.lcd .unit {
		font-size: 10px;
		color: #526047;
	}
	.weight-display .unit {
		font-size: 12px;
	}
	.steps-pedometer {
		--lcd-surface: #dbe4d7;
		--lcd-border: #2f423e;
		--lcd-ink: #2f3c31;
		--lcd-font-size: 24px;
		--lcd-input-height: 30px;
		--lcd-shadow: rgb(32 51 36 / 20%);
		gap: 7px;
		padding: 7px 8px;
		border-color: #35474d;
		border-radius: 14px;
		background: linear-gradient(165deg, #536b75, #3c5059);
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 20%),
			inset 0 -3px 0 #30424a;
	}
	.steps-pedometer svg {
		color: #e0e7e3;
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
	.lcd input:focus-visible,
	.lcd input:invalid {
		outline: none;
	}
	[data-lcd]:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 0;
	}
	[data-lcd]:has(input:invalid) {
		outline: 2px solid #a02d2d;
		outline-offset: 0;
	}
	.unit {
		font-size: 11px;
		color: var(--muted);
	}
</style>
