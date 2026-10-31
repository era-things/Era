<script lang="ts">
	import { tick } from 'svelte';
	import type { Reminder } from '../reminders';
	import type { DateKey } from '../calendar';
	let {
		reminders,
		selected,
		onmanage,
		oncomplete,
		onadd
	}: {
		reminders: Reminder[];
		selected: DateKey;
		onmanage: () => void;
		oncomplete: (id: string, completed: boolean) => void;
		onadd: (text: string) => boolean;
	} = $props();
	let adding = $state(false);
	let text = $state('');
	let input = $state<HTMLInputElement>();
	async function open() {
		adding = true;
		await tick();
		input?.focus();
	}
	function close() {
		adding = false;
		text = '';
	}
	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (text.trim() && onadd(text.trim())) {
			close();
		}
	}
</script>

<section class="day-reminders" aria-label="Day reminders">
	<header>
		<h3>Reminders</h3>
		<div class="actions">
			<button
				type="button"
				aria-label="Manage reminders"
				title="Manage reminders"
				onclick={onmanage}
			>
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
			<button
				type="button"
				class="add-button"
				aria-label="Add reminder"
				title="Add reminder"
				onclick={open}>+</button
			>
		</div>
	</header>
	{#if adding}
		<form onsubmit={submit}>
			<input
				bind:this={input}
				bind:value={text}
				aria-label="Reminder name"
				placeholder="Reminder"
				maxlength="500"
				required
				onkeydown={(event) => {
					if (event.key === 'Escape') close();
				}}
			/>
			<button type="submit" class="text-button" disabled={!text.trim()}>Add</button>
			<button type="button" aria-label="Cancel new reminder" onclick={close}>×</button>
		</form>
	{/if}
	{#if reminders.length}<ul>
			{#each reminders as reminder (reminder.id)}
				{@const completed = reminder.completedDates.includes(selected)}
				<li class:completed>
					<span>{reminder.text}</span><button
						class="completion-button"
						type="button"
						aria-label={(completed ? 'Reopen ' : 'Mark done: ') + reminder.text}
						onclick={() => oncomplete(reminder.id, !completed)}
						>{completed ? 'Undo' : 'Done'}</button
					>
				</li>
			{/each}
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
	.actions {
		display: flex;
		gap: 4px;
	}
	.add-button {
		background: #e9ede6;
		color: var(--ink);
		font-size: 20px;
	}
	form {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 8px;
	}
	input {
		flex: 1;
		min-width: 0;
		height: 30px;
		padding: 4px 6px;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: 13px;
	}
	.text-button {
		width: auto;
		padding: 0 6px;
		font: inherit;
		font-size: 12px;
		color: var(--accent);
	}
	button:disabled {
		opacity: 0.4;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
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
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 8px;
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
		font-size: 13px;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
	li > span {
		flex: 1;
		min-width: 48px;
		white-space: pre-wrap;
	}
	.completed > span {
		color: var(--muted);
		text-decoration: line-through;
	}
	.completion-button {
		width: auto;
		height: 26px;
		padding: 0 6px;
		font: inherit;
		font-size: 11px;
		border: 1px solid var(--line);
		flex-shrink: 0;
	}
</style>
