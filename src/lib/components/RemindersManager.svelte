<script lang="ts">
	import type { DateKey } from '../calendar';
	import { REMINDER_PERIODS, type Reminder } from '../reminders';
	import ReminderForm from './ReminderForm.svelte';
	let {
		reminders,
		selected,
		today,
		onsave,
		ondelete
	}: {
		reminders: Reminder[];
		selected: DateKey;
		today: DateKey;
		onsave: (reminder: Reminder) => boolean;
		ondelete: (id: string) => boolean;
	} = $props();
	const groups = [
		{ value: 'once', label: 'One-off' },
		{ value: 'periodic', label: 'Periodic' }
	] as const;
	let creating = $state({ once: false, periodic: false });
	let deleting = $state<string | null>(null);
	function create(reminder: Reminder, group: 'once' | 'periodic'): boolean {
		if (!onsave(reminder)) return false;
		creating[group] = false;
		return true;
	}
</script>

<div class="reminders-manager" id="reminders-panel" role="tabpanel" aria-labelledby="tab-reminders">
	<div class="manager-content">
		<div class="period-groups">
			{#each groups as group (group.value)}
				<section class="period-group" aria-label={group.label + ' reminders'}>
					<div class="group-heading">
						<h2>{group.label}</h2>
						<button
							type="button"
							aria-label={'New ' + group.label.toLowerCase() + ' reminder'}
							disabled={creating[group.value]}
							onclick={() => (creating[group.value] = true)}>+ New</button
						>
					</div>
					{#if creating[group.value]}<div class="new-reminder">
							<ReminderForm
								kind={group.value}
								{selected}
								{today}
								onsave={(reminder) => create(reminder, group.value)}
								oncancel={() => (creating[group.value] = false)}
							/>
						</div>{/if}
					{#each reminders.filter( (r) => (group.value === 'once' ? r.period === 'once' : r.period !== 'once') ) as reminder (reminder.id)}
						<details class="reminder-drawer">
							<summary
								><span>{reminder.text}</span>{#if group.value === 'periodic'}<span class="period"
										>{REMINDER_PERIODS.find((p) => p.value === reminder.period)!.label}</span
									>{/if}</summary
							>
							<ReminderForm
								{reminder}
								kind={group.value}
								{selected}
								{today}
								{onsave}
								ondelete={() => (deleting = reminder.id)}
							/>
							{#if deleting === reminder.id}<div class="delete-confirm">
									<span>Delete this reminder?</span><button
										type="button"
										onclick={() => {
											if (ondelete(reminder.id)) deleting = null;
										}}>Delete reminder</button
									><button type="button" onclick={() => (deleting = null)}>Cancel</button>
								</div>{/if}
						</details>
					{/each}
				</section>
			{/each}
		</div>
	</div>
</div>

<style>
	.reminders-manager {
		flex: 1;
		overflow: auto;
		padding: 24px;
	}
	.manager-content {
		max-width: 984px;
		margin-inline: auto;
	}
	.period-groups {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 480px));
		gap: 24px;
		align-items: start;
	}
	.period-group {
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
	}
	.group-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 10px;
	}
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
	.reminder-drawer,
	.new-reminder {
		container-type: inline-size;
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
	@media (max-width: 720px) {
		.manager-content {
			max-width: 480px;
		}
		.period-groups {
			grid-template-columns: minmax(0, 480px);
		}
	}
	@media (max-width: 560px) {
		.reminders-manager {
			padding: 16px;
		}
	}
</style>
