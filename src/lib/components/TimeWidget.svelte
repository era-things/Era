<script lang="ts">
	import { widgetFor } from '../widgets';
	import { validTime, type TimeId } from '../time';
	let {
		id,
		value,
		onchange
	}: { id: TimeId; value: number | null; onchange: (value: number | null) => boolean | void } =
		$props();
	const name = $derived(widgetFor(id).name);
	const hours = $derived(value === null ? '' : Math.floor(value / 60));
	const minutes = $derived(value === null ? '' : String(value % 60).padStart(2, '0'));
	function change(event: Event, unit: 'hours' | 'minutes') {
		const input = event.currentTarget as HTMLInputElement;
		input.setCustomValidity('');
		if (!input.validity.valid) {
			input.reportValidity();
			return;
		}
		const next =
			input.value === ''
				? null
				: unit === 'hours'
					? input.valueAsNumber * 60 + ((value ?? 0) % 60)
					: Math.floor((value ?? 0) / 60) * 60 + input.valueAsNumber;
		if (next !== null && !validTime(next)) {
			input.setCustomValidity('Enter a duration of at most 24 hours.');
			input.reportValidity();
			return;
		}
		const accepted = onchange(next) !== false;
		const current = accepted ? next : value;
		input.value =
			current === null
				? ''
				: unit === 'hours'
					? String(Math.floor(current / 60))
					: String(current % 60).padStart(2, '0');
	}
</script>

<section class="time-widget {id}" aria-label={name} title={name}>
	<svg
		aria-hidden="true"
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill={id === 'steam' ? 'currentColor' : 'none'}
		stroke={id === 'steam' ? 'none' : 'currentColor'}
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		{#if id === 'phone'}
			<rect x="6" y="2" width="12" height="20" rx="2.5" />
			<path d="M10 5h4M11 19h2" />
			<path d="M9 9h6v6H9Z" stroke-opacity=".45" />
		{:else if id === 'gym'}
			<path d="M7 12h10M3 9v6m4-9v12M21 9v6m-4-9v12M3 12h4m10 0h4" stroke-width="2" />
		{:else if id === 'reading'}
			<path
				d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15M5 7h3M5 10h3m8-3h3m-3 3h3"
			/>
		{:else if id === 'movie'}
			<rect x="2" y="4" width="20" height="16" rx="1.5" />
			<path d="M6 4v16m12-16v16M2 8h4m-4 4h4m-4 4h4m12-8h4m-4 4h4m-4 4h4" />
			<path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none" />
		{:else if id === 'steam'}
			<path
				d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"
			/>
		{/if}
	</svg>
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
	svg {
		display: block;
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
