<script lang="ts">
	import type { Reminder } from '../reminders';
	let { reminders, onmanage }: { reminders: Reminder[]; onmanage: () => void } = $props();
</script>

<section class="day-reminders" aria-label="Day reminders">
	<header>
		<h3>Reminders</h3>
		<button type="button" aria-label="Manage reminders" title="Manage reminders" onclick={onmanage}>
			<svg
				aria-hidden="true"
				viewBox="0 0 16 16"
				width="14"
				height="14"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"><path d="M5 4h8M5 8h8M5 12h8M2 4h.01M2 8h.01M2 12h.01" /></svg
			>
		</button>
	</header>
	{#if reminders.length}<ul>
			{#each reminders as reminder (reminder.id)}<li>{reminder.text}</li>{/each}
		</ul>{/if}
</section>

<style>
	.day-reminders {
		margin-top: 24px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	h3 {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
	}
	button {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 0;
		border-radius: 3px;
		background: transparent;
		color: var(--muted);
	}
	button:hover {
		background: #dfe7da;
	}
	ul {
		list-style: none;
		margin: 4px 0 0;
		padding: 0;
	}
	li {
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
		font-size: 13px;
		line-height: 1.5;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}
</style>
