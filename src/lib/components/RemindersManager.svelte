<script lang="ts">
	import type { DateKey } from '../calendar';
	import type { Reminder } from '../reminders';
	import ReminderEditor from './ReminderEditor.svelte';
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
						<ReminderEditor {reminder} {selected} {today} {onsave} {ondelete} />
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
	.new-reminder {
		border: 1px solid var(--line);
		margin-bottom: 12px;
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
