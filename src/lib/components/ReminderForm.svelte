<script lang="ts">
	import { onMount } from 'svelte';
	import type { DateKey } from '../calendar';
	import DatePicker from './DatePicker.svelte';
	import {
		REMINDER_PERIODS,
		isReminderDate,
		type Reminder,
		type ReminderPeriod
	} from '../reminders';
	let {
		reminder,
		kind,
		selected,
		today,
		onsave,
		oncancel,
		ondelete
	}: {
		reminder?: Reminder;
		kind: 'once' | 'periodic';
		selected: DateKey;
		today: DateKey;
		onsave: (reminder: Reminder) => boolean;
		oncancel?: () => void;
		ondelete?: () => void;
	} = $props();
	let text = $state('');
	let period = $state<ReminderPeriod>('once');
	let start = $state('');
	let overrideEmoji = $state(false);
	let leadMode = $state<'days' | 'always'>('days');
	let leadDays = $state<number | undefined>(0);
	let error = $state('');
	let textInput = $state<HTMLTextAreaElement>();

	function reset() {
		text = reminder?.text ?? '';
		period = reminder?.period ?? (kind === 'once' ? 'once' : 'weekly');
		start = reminder?.start ?? selected;
		overrideEmoji = reminder?.overrideEmoji ?? false;
		leadMode = reminder?.leadDays === 'always' ? 'always' : 'days';
		leadDays = typeof reminder?.leadDays === 'number' ? reminder.leadDays : 0;
		error = '';
	}
	$effect(() => reset());
	onMount(() => {
		if (!reminder) textInput?.focus();
	});
	const dirty = $derived(
		!reminder ||
			text !== reminder.text ||
			period !== reminder.period ||
			start !== reminder.start ||
			overrideEmoji !== reminder.overrideEmoji ||
			(leadMode === 'always' ? 'always' : leadDays) !== reminder.leadDays
	);

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (!text.trim()) {
			error = 'Enter reminder text.';
			return;
		}
		if (!isReminderDate(start)) {
			error = 'Enter a valid starting date.';
			return;
		}
		if (
			overrideEmoji &&
			leadMode === 'days' &&
			(leadDays === undefined || !Number.isSafeInteger(leadDays) || leadDays < 0)
		) {
			error = 'Enter a non-negative whole number of days.';
			return;
		}
		if (
			onsave({
				id: reminder?.id ?? crypto.randomUUID(),
				text: text.trim(),
				period: kind === 'once' ? 'once' : period,
				start,
				overrideEmoji,
				leadDays:
					leadMode === 'always'
						? 'always'
						: leadDays !== undefined && Number.isSafeInteger(leadDays) && leadDays >= 0
							? leadDays
							: 0,
				completedDates: reminder?.completedDates ?? []
			})
		)
			error = '';
	}
</script>

<form
	onsubmit={save}
	aria-label={reminder
		? 'Edit reminder: ' + reminder.text
		: kind === 'once'
			? 'New one-off reminder'
			: 'New periodic reminder'}
>
	<div class="main-fields" class:one-off={kind === 'once'}>
		<label
			>Text<textarea bind:this={textInput} bind:value={text} rows="1" maxlength="500" required
			></textarea></label
		>
		{#if kind === 'periodic'}<label
				>Period<select bind:value={period}
					>{#each REMINDER_PERIODS.filter((p) => p.value !== 'once') as p}<option value={p.value}
							>{p.label}</option
						>{/each}</select
				></label
			>{/if}
		<DatePicker label="Starting date" bind:value={start} {today} />
	</div>
	<div class="form-options">
		<div class="override-settings">
			<label class="override-option"
				><input type="checkbox" bind:checked={overrideEmoji} /><span>Override emoji with ❗</span
				></label
			>
			{#if overrideEmoji}
				<div class="lead-settings">
					<select aria-label="Show override" class="lead-mode" bind:value={leadMode}
						><option value="days">Days before</option><option value="always">Always</option></select
					>
					{#if leadMode === 'days'}<input
							aria-label="Days before"
							class="lead-days"
							type="number"
							min="0"
							step="1"
							max={Number.MAX_SAFE_INTEGER}
							bind:value={leadDays}
							required
						/>{/if}
				</div>
			{/if}
		</div>
		<div class="form-actions">
			<button type="submit" class="primary" disabled={!dirty}
				>{reminder ? 'Save changes' : 'Create reminder'}</button
			>
			{#if reminder}
				{#if dirty}<button type="button" onclick={reset}>Reset</button>{/if}
				{#if ondelete}<button
						type="button"
						aria-label={'Delete reminder: ' + reminder.text}
						onclick={ondelete}>Delete</button
					>{/if}
			{:else if oncancel}<button type="button" onclick={oncancel}>Cancel</button>{/if}
		</div>
	</div>
	{#if error}<p role="alert" class="form-error">{error}</p>{/if}
</form>

<style>
	form {
		display: grid;
		gap: 12px;
		padding: 12px;
	}
	label {
		display: grid;
		gap: 4px;
		font-size: 12px;
		min-width: 0;
	}
	input,
	select,
	textarea {
		width: 100%;
		min-width: 0;
		font: inherit;
		color: inherit;
		border: 1px solid #bdc8bc;
		border-radius: 3px;
		padding: 5px 8px;
		min-height: 32px;
		background: var(--paper);
	}
	textarea {
		resize: vertical;
		height: 32px;
	}
	.main-fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 128px 148px;
		gap: 10px;
	}
	.main-fields.one-off {
		grid-template-columns: minmax(0, 1fr) 148px;
	}
	.form-options {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
	}
	.override-settings {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 12px;
	}
	.override-option {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}
	.override-option input {
		min-height: 0;
		width: 16px;
		height: 16px;
		margin: 0;
		accent-color: var(--accent);
	}
	.lead-settings {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.lead-mode {
		width: 112px;
	}
	.lead-days {
		width: 64px;
	}
	.form-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-left: auto;
	}
	button {
		min-height: 32px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: transparent;
		padding: 6px 10px;
		font-size: 12px;
	}
	button:hover:not(:disabled) {
		background: #e5eae2;
	}
	.primary {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}
	.primary:hover:not(:disabled) {
		background: #1b574b;
	}
	.form-error {
		margin: 0;
		font-size: 12px;
		color: #a02d2d;
	}
	@container (max-width: 560px) {
		.main-fields {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
		.main-fields:not(.one-off) > label:first-child {
			grid-column: 1/-1;
		}
	}
</style>
