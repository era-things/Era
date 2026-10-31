<script lang="ts">
	import { tick } from 'svelte';
	import {
		addDays,
		asDate,
		formatDate,
		relativeDay,
		weekdayOffset,
		isDateKey,
		type DateKey
	} from '../calendar';
	let {
		value = $bindable(),
		today,
		label
	}: { value: string; today: DateKey; label: string } = $props();
	const id = $props.id();
	let month = $state('');
	let focused = $state('');
	let left = $state(0);
	let top = $state(0);
	let popup: HTMLDivElement;
	let input = $state<HTMLInputElement>();
	let trigger: HTMLButtonElement;
	const monthLabel = new Intl.DateTimeFormat('en-US', {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
	const first = $derived((month || today.slice(0, 7)) + '-01');
	$effect(() => {
		input?.setCustomValidity(!value || isDateKey(value) ? '' : 'Enter a valid date (YYYY-MM-DD).');
	});
	const cells = $derived.by(() => {
		const end = asDate(first);
		end.setUTCMonth(end.getUTCMonth() + 1, 0);
		const offset = weekdayOffset(first);
		return Array.from({ length: Math.ceil((offset + end.getUTCDate()) / 7) * 7 }, (_, i) => {
			const date = addDays(first, i - offset);
			return isDateKey(date) ? date : null;
		});
	});
	function prepare() {
		focused = isDateKey(value) ? value : today;
		month = focused.slice(0, 7);
		const rect = trigger.getBoundingClientRect();
		left = Math.max(8, Math.min(rect.right - 280, window.innerWidth - 288));
		top = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 326));
	}
	async function focusDate(date: DateKey) {
		focused = date;
		month = date.slice(0, 7);
		await tick();
		document.getElementById(id + '-' + date)?.focus();
	}
	function choose(date: DateKey) {
		value = date;
		popup.hidePopover();
		trigger.focus({ preventScroll: true });
	}
	function shiftMonth(amount: number) {
		const date = asDate(first);
		date.setUTCMonth(date.getUTCMonth() + amount);
		if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return;
		month = date.toISOString().slice(0, 7);
		const last = new Date(date);
		last.setUTCMonth(last.getUTCMonth() + 1, 0);
		focused =
			month +
			'-' +
			String(Math.min(Number(focused.slice(8)) || 1, last.getUTCDate())).padStart(2, '0');
	}
	function navigate(event: KeyboardEvent, date: DateKey) {
		let offset: number | undefined;
		if (event.key === 'ArrowLeft') offset = -1;
		if (event.key === 'ArrowRight') offset = 1;
		if (event.key === 'ArrowUp') offset = -7;
		if (event.key === 'ArrowDown') offset = 7;
		if (event.key === 'Home') offset = -weekdayOffset(date);
		if (event.key === 'End') offset = 6 - weekdayOffset(date);
		if (offset !== undefined) {
			event.preventDefault();
			const next = addDays(date, offset);
			if (isDateKey(next)) void focusDate(next);
		} else if (event.key === 'PageUp' || event.key === 'PageDown') {
			event.preventDefault();
			shiftMonth(event.key === 'PageUp' ? -1 : 1);
			void focusDate(focused);
		}
	}
</script>

<div class="date-field">
	<label for={id + '-input'}>{label}</label>
	<div class="date-input">
		<input
			bind:this={input}
			id={id + '-input'}
			type="text"
			bind:value
			placeholder="YYYY-MM-DD"
			maxlength="10"
			required
		/>
		<button
			bind:this={trigger}
			type="button"
			class="calendar-button"
			aria-label={'Choose ' + label.toLowerCase()}
			aria-haspopup="dialog"
			popovertarget={id + '-calendar'}
			onclick={prepare}
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 16 16"
				width="14"
				height="14"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				><rect x="2" y="3.5" width="12" height="11" rx="1" /><path
					d="M5 1.5v4M11 1.5v4M2 7h12"
				/></svg
			>
		</button>
	</div>
</div>
<div
	bind:this={popup}
	id={id + '-calendar'}
	popover="auto"
	role="dialog"
	aria-label={'Choose ' + label.toLowerCase()}
	class="date-popup"
	style:left={left + 'px'}
	style:top={top + 'px'}
	ontoggle={async (event) => {
		if (event.newState === 'open') {
			await tick();
			document.getElementById(id + '-' + focused)?.focus();
		}
	}}
>
	<header>
		<button
			type="button"
			aria-label="Previous month"
			disabled={first <= '0001-01-01'}
			onclick={() => shiftMonth(-1)}>‹</button
		>
		<strong aria-live="polite">{monthLabel.format(asDate(first))}</strong>
		<button
			type="button"
			aria-label="Next month"
			disabled={first >= '9999-12-01'}
			onclick={() => shiftMonth(1)}>›</button
		>
	</header>
	<div class="weekdays" aria-hidden="true">
		{#each ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as day}<span>{day}</span>{/each}
	</div>
	<div class="dates" role="group" aria-label="Dates">
		{#each cells as date, index (date ?? 'blank-' + index)}
			{#if date}<button
					type="button"
					id={id + '-' + date}
					class:past={date < today}
					class:outside-month={date.slice(0, 7) !== first.slice(0, 7)}
					class:future={date > today}
					class:today={date === today}
					class:selected={date === value}
					aria-label={formatDate(date) + ' · ' + relativeDay(date, today)}
					aria-current={date === today ? 'date' : undefined}
					aria-pressed={date === value}
					tabindex={date === focused ? 0 : -1}
					onkeydown={(event) => navigate(event, date)}
					onclick={() => choose(date)}>{Number(date.slice(8))}</button
				>
			{:else}<span aria-hidden="true"></span>{/if}
		{/each}
	</div>
	<footer>
		<span class="past-key">Past</span><span class="future-key">Future</span><button
			type="button"
			onclick={() => choose(today)}>Today</button
		>
	</footer>
</div>

<style>
	.date-field {
		display: grid;
		gap: 4px;
		min-width: 0;
		font-size: 12px;
	}
	.date-input {
		position: relative;
	}
	input {
		width: 100%;
		min-width: 0;
		height: 32px;
		font: inherit;
		color: inherit;
		border: 1px solid #bdc8bc;
		border-radius: 3px;
		padding: 5px 30px 5px 8px;
		background: var(--paper);
	}
	input:invalid:not(:placeholder-shown) {
		border-color: #a02d2d;
	}
	.calendar-button {
		position: absolute;
		inset: 1px 1px 1px auto;
		width: 26px;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		border-radius: 2px;
	}
	.date-popup {
		position: fixed;
		inset: auto;
		margin: 0;
		width: min(280px, calc(100vw - 16px));
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: var(--paper);
		color: var(--ink);
		box-shadow: 0 6px 20px rgb(0 0 0 / 12%);
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
		gap: 8px;
	}
	strong {
		font-size: 13px;
		font-weight: 600;
	}
	button {
		font: inherit;
		border: 0;
		background: transparent;
		border-radius: 3px;
		color: inherit;
	}
	header button {
		width: 28px;
		height: 28px;
		font-size: 20px;
		background: #e9ede6;
	}
	.weekdays,
	.dates {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 3px;
		text-align: center;
	}
	.weekdays {
		margin-bottom: 5px;
		font-size: 10px;
		color: var(--muted);
	}
	.dates button {
		height: 30px;
		padding: 0;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}
	.dates .past {
		color: #8a938c;
	}
	.dates .outside-month {
		opacity: 0.6;
	}
	.dates .future {
		color: var(--accent);
		background: #e9efe7;
	}
	.dates .today {
		outline: 1px solid var(--accent);
		outline-offset: -1px;
		font-weight: 750;
		color: var(--accent);
	}
	.dates .selected {
		background: var(--accent);
		color: white;
	}
	button:hover:not(:disabled) {
		background: #dfe7da;
		color: var(--ink);
	}
	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	footer {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid var(--line);
		font-size: 11px;
	}
	.past-key {
		color: #8a938c;
	}
	.future-key {
		color: var(--accent);
	}
	footer button {
		margin-left: auto;
		padding: 5px 8px;
		color: var(--accent);
	}
</style>
