<script lang="ts">
	import { localToday } from '../calendar';
	import { serializeDataExport, type CalendarData } from '../data-export';
	let {
		readExport,
		importBackup
	}: {
		readExport: () => Promise<CalendarData>;
		importBackup: (body: string) => Promise<void>;
	} = $props();
	let fileInput: HTMLInputElement;
	let importing = $state(false);
	let error = $state('');
	let status = $state('');
	async function exportData() {
		try {
			const blob = new Blob([serializeDataExport(await readExport())], {
				type: 'application/json'
			});
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

	async function chooseBackup(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || importing) return;

		importing = true;
		error = '';
		status = 'Importing…';
		try {
			await importBackup(await file.text());
			status = 'Data and settings imported.';
		} catch (failure) {
			status = '';
			error =
				failure instanceof Error && !(failure instanceof TypeError)
					? failure.message
					: 'Could not import data. Try again.';
		} finally {
			importing = false;
		}
	}
</script>

<div class="settings-panel" id="settings-panel" role="tabpanel" aria-labelledby="tab-settings">
	<div class="backup-actions">
		<button type="button" disabled={importing} onclick={exportData}>
			{@render transferIcon('M12 3v12m-4-4 4 4 4-4')}
			Export data
		</button>
		<button type="button" disabled={importing} onclick={() => fileInput.click()}>
			{@render transferIcon('M12 15V3M8 7l4-4 4 4')}
			Import data
		</button>
		<input
			type="file"
			accept=".json,application/json"
			hidden
			bind:this={fileInput}
			onchange={chooseBackup}
		/>
	</div>
	{#if status}<p class="feedback" role="status">{status}</p>{/if}
	{#if error}<p class="feedback error" role="alert">{error}</p>{/if}
</div>

{#snippet transferIcon(arrow: string)}
	<svg
		aria-hidden="true"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.7"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d={arrow} />
		<path d="M4 15v5h16v-5" />
	</svg>
{/snippet}

<style>
	.settings-panel {
		flex: 1;
		overflow: auto;
		padding: 12px var(--app-gutter);
	}
	.backup-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	p {
		margin: 0;
		font-size: 13px;
		color: var(--muted);
	}
	button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 32px;
		padding: 6px 10px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 12px;
	}
	button:hover:enabled {
		background: #e5eae2;
	}
	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.feedback {
		margin-top: 12px;
	}
	.error {
		color: #a02d2d;
	}
</style>
