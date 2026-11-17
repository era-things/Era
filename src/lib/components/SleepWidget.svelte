<script lang="ts">
	import { changeDurationPart, formatDurationPart } from '../duration';
	import type { WidgetSkin } from '../widgets';
	import { changeSleep, formatSleepTime, parseSleepTime, type Sleep } from '../sleep';
	let {
		value,
		skin = 'lunar-seal',
		readonly = false,
		onchange
	}: {
		value: Sleep;
		skin?: WidgetSkin<'sleep'>;
		readonly?: boolean;
		onchange: (value: Sleep) => boolean | void;
	} = $props();
	const hours = $derived(formatDurationPart(value.duration, 'hours'));
	const minutes = $derived(formatDurationPart(value.duration, 'minutes'));

	function timeChange(event: Event, field: 'start' | 'end') {
		const input = event.currentTarget as HTMLInputElement;
		const parsed = parseSleepTime(input.value);
		if (input.value.trim() && parsed === null) {
			input.setCustomValidity('Enter a time from 0000 to 2359.');
			input.reportValidity();
			return;
		}
		input.setCustomValidity('');
		const next = changeSleep(value, field, parsed);
		if (onchange(next) !== false) input.value = formatSleepTime(next[field]);
		else input.value = formatSleepTime(value[field]);
	}

	function durationChange(event: Event, unit: 'hours' | 'minutes') {
		const input = event.currentTarget as HTMLInputElement;
		if (!input.validity.valid) {
			input.reportValidity();
			return;
		}
		const duration = changeDurationPart(
			value.duration,
			unit,
			input.value === '' ? null : input.valueAsNumber
		);
		if (onchange(changeSleep(value, 'duration', duration)) === false)
			input.value = String(unit === 'hours' ? hours : minutes);
	}
</script>

<section class="sleep-widget" class:lunar-seal={skin === 'lunar-seal'} aria-label="Sleep">
	{#if skin === 'lunar-seal'}<div class="sky" aria-hidden="true"></div>{/if}
	<svg
		aria-hidden="true"
		viewBox="0 0 24 24"
		width="17"
		height="17"
		fill="none"
		stroke="currentColor"
		stroke-width="1.6"
	>
		{#if skin === 'lunar-seal'}
			<path d="M17 3a9 9 0 1 0 4 15A9 9 0 0 1 17 3Z" fill="currentColor" fill-opacity=".12" />
		{:else}<path d="M20.2 14.2A8.5 8.5 0 0 1 9.8 3.8a8.5 8.5 0 1 0 10.4 10.4Z" />{/if}
	</svg>
	<div class="sleep-duration" role="group" aria-label="Sleep duration">
		<label
			><input
				class="sleep-hours"
				type="number"
				aria-label="Sleep hours"
				min="0"
				max="23"
				step="1"
				placeholder="—"
				value={hours}
				{readonly}
				onchange={(event) => durationChange(event, 'hours')}
			/><span>h</span></label
		>
		<label
			><input
				type="number"
				aria-label="Sleep minutes"
				min="0"
				max="59"
				step="1"
				placeholder="—"
				value={minutes}
				{readonly}
				onchange={(event) => durationChange(event, 'minutes')}
			/><span>m</span></label
		>
	</div>
	<div class="sleep-times">
		{#each ['start', 'end'] as field, index}
			<input
				type="text"
				inputmode="numeric"
				aria-label={field === 'start' ? 'Sleep start time' : 'Sleep wake-up time'}
				placeholder="--:--"
				value={formatSleepTime(value[field as 'start' | 'end'])}
				maxlength="5"
				spellcheck="false"
				{readonly}
				oninput={(event) => event.currentTarget.setCustomValidity('')}
				onfocus={(event) => event.currentTarget.select()}
				onchange={(event) => timeChange(event, field as 'start' | 'end')}
				onkeydown={(event) => {
					if (event.key === 'Enter') event.currentTarget.blur();
				}}
			/>
			{#if index === 0}<span aria-hidden="true">→</span>{/if}
		{/each}
	</div>
</section>

<style>
	.sleep-widget {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-width: 0;
		height: 26px;
		padding: 2px 7px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: #e9ede6;
		font-variant-numeric: tabular-nums;
	}
	.sleep-widget:focus-within {
		border-color: var(--accent);
	}
	svg {
		flex: 0 0 16px;
		width: 16px;
		height: 16px;
		color: var(--muted);
	}
	.sleep-duration {
		display: flex;
		align-items: baseline;
		flex-shrink: 0;
		gap: 3px;
		height: 20px;
	}
	.sleep-duration label {
		display: flex;
		align-items: baseline;
		gap: 1px;
	}
	.sleep-duration span {
		font-size: 10px;
		color: var(--muted);
	}
	input {
		min-width: 0;
		padding: 0;
		border: 0;
		border-radius: 2px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-variant-numeric: tabular-nums;
	}
	.sleep-duration input {
		width: 2ch;
		height: 20px;
		font-size: 16px;
		line-height: 20px;
		text-align: left;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	.sleep-duration .sleep-hours {
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
		outline: 2px solid var(--accent);
		outline-offset: 0;
	}
	input:invalid {
		outline: 2px solid #a02d2d;
	}
	input::placeholder {
		color: var(--muted);
		opacity: 1;
	}
	.sleep-times {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		gap: 5px;
		margin-left: auto;
		color: var(--muted);
		font-size: 10px;
	}
	.sleep-times input {
		width: 5ch;
		height: 18px;
		font-size: 11px;
		line-height: 18px;
		color: var(--muted);
	}
	.sleep-times input:focus {
		color: var(--ink);
	}
	.lunar-seal {
		--ink: #f4efdc;
		--muted: #bdcbdc;
		--accent: #e6d399;
		position: relative;
		isolation: isolate;
		border-color: #4a5d7a;
		background: #263750;
		color: var(--ink);
	}
	.lunar-seal > :not(.sky) {
		position: relative;
		z-index: 1;
	}
	.lunar-seal svg {
		color: var(--accent);
		stroke-width: 1.3;
	}
	.sky {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		border-radius: inherit;
		background:
			radial-gradient(circle at 27% 14%, #e6d3998a 0 0.65px, transparent 1px),
			radial-gradient(circle at 71% 83%, #b7c9e163 0 0.6px, transparent 1px),
			radial-gradient(circle at 89% 19%, #e6d39978 0 0.7px, transparent 1px);
	}
	.sky::after {
		content: '';
		position: absolute;
		width: 84px;
		height: 84px;
		top: -24px;
		left: 144px;
		border: 1px solid #e6d39924;
		border-radius: 50%;
	}
	.lunar-seal input:invalid {
		outline-color: #ff8c8c;
	}
</style>
