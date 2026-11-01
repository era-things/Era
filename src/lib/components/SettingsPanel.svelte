<script lang="ts">
	import { localToday } from '../calendar';
	import { serializeDataExport, type CalendarData } from '../data-export';
	let { data }: { data: CalendarData } = $props();
	let error = $state('');
	function exportData() {
		try {
			const blob = new Blob([serializeDataExport(data)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `era-${localToday()}.json`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			error = '';
		} catch {
			error = 'Could not export data. Try again.';
		}
	}
</script>

<div class="settings-panel" id="settings-panel" role="tabpanel" aria-labelledby="tab-settings">
	<div class="settings-content">
		<div class="export-row">
			<p>Download day emojis, measures and reminders as JSON.</p>
			<button type="button" onclick={exportData}>Export data</button>
		</div>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</div>
</div>

<style>
	.settings-panel {
		flex: 1;
		overflow: auto;
		padding: 24px;
	}
	.settings-content {
		max-width: 984px;
		margin-inline: auto;
	}
	.export-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px 24px;
	}
	p {
		margin: 0;
		font-size: 13px;
		color: var(--muted);
	}
	button {
		min-height: 32px;
		padding: 6px 10px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 12px;
	}
	button:hover {
		background: #e5eae2;
	}
	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.error {
		margin-top: 12px;
		color: #a02d2d;
	}
	@media (max-width: 560px) {
		.settings-panel {
			padding: 16px;
		}
	}
</style>
