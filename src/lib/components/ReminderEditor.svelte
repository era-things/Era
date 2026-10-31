<script lang="ts">
	import type { DateKey } from '../calendar';
	import { PERIODIC_PERIODS, type Reminder } from '../reminders';
	import ReminderForm from './ReminderForm.svelte';
	let {
		reminder,
		selected,
		today,
		onsave,
		ondelete
	}: {
		reminder: Reminder;
		selected: DateKey;
		today: DateKey;
		onsave: (reminder: Reminder) => boolean;
		ondelete: (id: string) => boolean;
	} = $props();
	let deleting = $state(false);
</script>

<details class="reminder-drawer">
	<summary
		><span>{reminder.text}</span>{#if reminder.period !== 'once'}<span class="period"
				>{PERIODIC_PERIODS.find((p) => p.value === reminder.period)!.label}</span
			>{/if}</summary
	>
	<ReminderForm
		{reminder}
		kind={reminder.period === 'once' ? 'once' : 'periodic'}
		{selected}
		{today}
		{onsave}
		ondelete={() => (deleting = true)}
	/>
	{#if deleting}<div class="delete-confirm">
			<span>Delete this reminder?</span><button
				type="button"
				onclick={() => {
					if (ondelete(reminder.id)) deleting = false;
				}}>Delete reminder</button
			><button type="button" onclick={() => (deleting = false)}>Cancel</button>
		</div>{/if}
</details>

<style>
	.period {
		margin-left: auto;
		flex-shrink: 0;
		color: var(--muted);
		font-size: 11px;
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
	.reminder-drawer {
		border: 1px solid var(--line);
		margin-bottom: 12px;
	}
	summary {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		cursor: pointer;
		font-size: 13px;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::before {
		content: '›';
		color: var(--muted);
		font-size: 18px;
		line-height: 1;
	}
	details[open] > summary::before {
		transform: rotate(90deg);
	}
	details[open] > summary {
		border-bottom: 1px solid var(--line);
	}
	summary > span:first-of-type {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	summary:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
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
</style>
