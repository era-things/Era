<script lang="ts">
	import Chevron from './Chevron.svelte';
	import { formatDate, relativeDay, type DateKey } from '../calendar';
	import EmojiSelector from './EmojiSelector.svelte';
	import type { Snippet } from 'svelte';
	import DayReminders from './DayReminders.svelte';
	import type { Reminder } from '../reminders';
	import { reflow } from '../widget-motion';
	let {
		selected,
		today,
		firstYear,
		lastYear,
		label = 'Selected day',
		onNavigate,
		emoji,
		onEmojiChange,
		reminders,
		onManageReminders,
		onCompleteReminder,
		onAddReminder,
		children
	}: {
		selected: DateKey;
		today: DateKey;
		firstYear: number;
		lastYear: number;
		label?: string;
		onNavigate?: (key: DateKey, offset: number) => void;
		emoji: string;
		onEmojiChange: (emoji: string) => void;
		reminders: Reminder[];
		onManageReminders: () => void;
		onCompleteReminder: (id: string, completed: boolean) => void;
		onAddReminder: (text: string) => boolean;
		children: Snippet;
	} = $props();
</script>

<aside class="day-panel" aria-label={label} use:reflow>
	<div class="day-panel-heading">
		<EmojiSelector value={emoji} onchange={onEmojiChange} />
		<div class="panel-date" aria-live="polite" aria-atomic="true">
			<h2><time datetime={selected}>{formatDate(selected)}</time></h2>
		</div>
	</div>
	{#if onNavigate}
		<nav class="day-navigation" aria-label="Day navigation">
			<button
				type="button"
				aria-label="Previous day"
				title="Previous day"
				disabled={selected <= String(firstYear).padStart(4, '0') + '-01-01'}
				onclick={() => onNavigate(selected, -1)}
			>
				<Chevron direction="left" />
			</button>
			<button
				type="button"
				aria-label="Next day"
				title="Next day"
				disabled={selected >= String(lastYear).padStart(4, '0') + '-12-31'}
				onclick={() => onNavigate(selected, 1)}
			>
				<Chevron />
			</button>
			<span class="panel-relative" aria-live="polite">{relativeDay(selected, today)}</span>
		</nav>
	{/if}
	{#key selected}{@render children()}{/key}
	{#key selected}
		<DayReminders
			{reminders}
			{selected}
			onmanage={onManageReminders}
			oncomplete={onCompleteReminder}
			onadd={onAddReminder}
		/>
	{/key}
</aside>
