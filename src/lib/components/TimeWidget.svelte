<script lang="ts">
	import { changeDurationPart, formatDurationPart, validTime } from '../duration';
	import WidgetIcon from './WidgetIcon.svelte';
	import { widgetFor, type TimeId } from '../widgets';
	let {
		id,
		value,
		onchange
	}: { id: TimeId; value: number | null; onchange: (value: number | null) => boolean | void } =
		$props();
	const definition = $derived(widgetFor(id));
	const name = $derived(definition.name);
	const hours = $derived(formatDurationPart(value, 'hours'));
	const minutes = $derived(formatDurationPart(value, 'minutes'));
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

<section class="time-widget {id}" aria-label={name} title={name}>
	<WidgetIcon icon={definition.icon} />
	<div class="time-duration" role="group" aria-label={name + ' duration'}>
		{#each ['hours', 'minutes'] as unit}
			<label
				><input
					class:hours={unit === 'hours'}
					type="number"
					aria-label={name + ' ' + unit}
					min="0"
					max={unit === 'hours' ? 24 : 59}
					step="1"
					inputmode="numeric"
					placeholder="—"
					value={unit === 'hours' ? hours : minutes}
					oninput={(event) => event.currentTarget.setCustomValidity('')}
					onfocus={(event) => event.currentTarget.select()}
					onchange={(event) => change(event, unit as 'hours' | 'minutes')}
					onkeydown={(event) => {
						if (event.key === 'Enter') event.currentTarget.blur();
					}}
				/><span>{unit === 'hours' ? 'h' : 'm'}</span></label
			>
		{/each}
	</div>
</section>

<style>
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
	.time-widget :global(svg) {
		flex: 0 0 16px;
		color: var(--time-accent);
	}
	.time-duration {
		display: flex;
		align-items: baseline;
		gap: 3px;
		height: 20px;
	}
	label {
		display: flex;
		align-items: baseline;
		gap: 1px;
	}
	label span {
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
