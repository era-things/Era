<script lang="ts">
	import { tick } from 'svelte';
	import type { DateKey } from '../calendar';
	import {
		REMINDER_PERIODS,
		isReminderDate,
		type Reminder,
		type ReminderPeriod
	} from '../reminders';
	let {
		reminders,
		selected,
		onsave,
		ondelete
	}: {
		reminders: Reminder[];
		selected: DateKey;
		onsave: (reminder: Reminder) => boolean;
		ondelete: (id: string) => boolean;
	} = $props();
	let editing = $state<string | null>(null);
	let creating = $state(false);
	let text = $state('');
	let period = $state<ReminderPeriod>('daily');
	let start = $state('');
	let error = $state('');
	let deleting = $state<string | null>(null);
	let textInput = $state<HTMLTextAreaElement>();
	const dateFormat = new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
	async function edit(reminder?: Reminder) {
		editing = reminder?.id ?? null;
		creating = true;
		text = reminder?.text ?? '';
		period = reminder?.period ?? 'daily';
		start = reminder?.start ?? selected;
		error = '';
		deleting = null;
		await tick();
		textInput?.focus();
	}
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
		if (onsave({ id: editing ?? crypto.randomUUID(), text: text.trim(), period, start }))
			creating = false;
	}
</script>

<div class="reminders-manager" id="reminders-panel" role="tabpanel" aria-labelledby="tab-reminders">
	<div class="manager-content">
		<header>
			<h2>Reminders</h2>
			<button type="button" onclick={() => edit()}>+ New reminder</button>
		</header>
		{#if creating}
			<form onsubmit={save}>
				<label
					>Text<textarea bind:this={textInput} bind:value={text} rows="2" maxlength="500" required
					></textarea></label
				>
				<div class="schedule-fields">
					<label
						>Period<select bind:value={period}
							>{#each REMINDER_PERIODS as p}<option value={p.value}>{p.label}</option
								>{/each}</select
						></label
					>
					<label
						>Starting date<input
							type="date"
							bind:value={start}
							min="0001-01-01"
							max="9999-12-31"
							required
						/></label
					>
				</div>
				{#if error}<p role="alert" class="form-error">{error}</p>{/if}
				<div class="form-actions">
					<button type="submit" class="primary"
						>{editing ? 'Save changes' : 'Create reminder'}</button
					><button type="button" onclick={() => (creating = false)}>Cancel</button>
				</div>
			</form>
		{/if}
		{#each reminders as reminder (reminder.id)}
			<div class="reminder-row">
				<div class="reminder-info">
					<p>{reminder.text}</p>
					<span
						>{REMINDER_PERIODS.find((p) => p.value === reminder.period)!.label} ·
						<time datetime={reminder.start}
							>{dateFormat.format(new Date(reminder.start + 'T00:00:00Z'))}</time
						></span
					>
				</div>
				<button
					type="button"
					aria-label={'Edit reminder: ' + reminder.text}
					onclick={() => edit(reminder)}>Edit</button
				>
				<button
					type="button"
					aria-label={'Delete reminder: ' + reminder.text}
					onclick={() => (deleting = reminder.id)}>Delete</button
				>
			</div>
			{#if deleting === reminder.id}<div class="delete-confirm">
					<span>Delete this reminder?</span><button
						type="button"
						onclick={() => {
							if (ondelete(reminder.id)) {
								deleting = null;
								if (editing === reminder.id) creating = false;
							}
						}}>Delete reminder</button
					><button type="button" onclick={() => (deleting = null)}>Cancel</button>
				</div>{/if}
		{/each}
		{#if !reminders.length && !creating}<p class="empty">No reminders yet.</p>{/if}
	</div>
</div>

<style>
	.reminders-manager {
		flex: 1;
		overflow: auto;
		padding: 24px;
	}
	.manager-content {
		max-width: 680px;
		margin-inline: auto;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 20px;
	}
	h2 {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
	}
	button {
		border: 1px solid var(--line);
		border-radius: 4px;
		background: transparent;
		padding: 6px 10px;
		font-size: 12px;
	}
	button:hover {
		background: #e5eae2;
	}
	form {
		display: grid;
		gap: 16px;
		border: 1px solid var(--line);
		padding: 18px;
		margin-bottom: 20px;
	}
	label {
		display: grid;
		gap: 6px;
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
		padding: 8px;
		background: var(--paper);
	}
	textarea {
		resize: vertical;
	}
	.schedule-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	.form-actions {
		display: flex;
		gap: 8px;
	}
	.primary {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}
	.primary:hover {
		background: #1b574b;
	}
	.reminder-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 0;
		border-bottom: 1px solid var(--line);
	}
	.reminder-info {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.reminder-info p {
		margin: 0 0 4px;
		font-size: 14px;
		line-height: 1.5;
		white-space: pre-wrap;
	}
	.reminder-info > span,
	.empty {
		color: var(--muted);
		font-size: 12px;
	}
	.delete-confirm {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		padding: 12px;
		font-size: 12px;
		background: #f5e5e8;
	}
	.form-error {
		margin: 0;
		font-size: 12px;
		color: #a02d2d;
	}
	@media (max-width: 560px) {
		.reminders-manager {
			padding: 16px;
		}
		.schedule-fields {
			grid-template-columns: 1fr;
			gap: 12px;
		}
		.reminder-row {
			gap: 8px;
		}
	}
</style>
