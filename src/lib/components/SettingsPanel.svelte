<script lang="ts">
	import type { DateKey } from '../calendar';
	import { serializeDataExport, type BackupPreview, type CalendarData } from '../data-export';
	import { DEFAULT_TIMELINE_COLOR } from '../timeline-color';
	let {
		today,
		timelineColor,
		onTimelineColor,
		readExport,
		previewImport,
		importBackup
	}: {
		today: DateKey;
		timelineColor: string;
		onTimelineColor: (color: string) => void;
		readExport: () => Promise<CalendarData>;
		previewImport: (body: string) => Promise<BackupPreview>;
		importBackup: (body: string, preview: BackupPreview) => Promise<BackupPreview | undefined>;
	} = $props();
	let fileInput: HTMLInputElement;
	let importing = $state(false);
	let pending = $state<{ body: string; preview: BackupPreview }>();
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
			link.download = `era-${today}.json`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			error = '';
		} catch {
			error = 'Could not export data. Try again.';
		}
	}

	async function runImport(message: string, action: () => Promise<string>) {
		importing = true;
		error = '';
		status = message;
		try {
			status = await action();
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

	async function chooseBackup(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || importing) return;

		pending = undefined;
		await runImport('Checking backup…', async () => {
			const body = await file.text();
			pending = { body, preview: await previewImport(body) };
			return '';
		});
	}

	async function confirmImport() {
		if (!pending || importing) return;
		const { body, preview } = pending;
		await runImport('Importing…', async () => {
			const updatedPreview = await importBackup(body, preview);
			if (updatedPreview) {
				pending = { body, preview: updatedPreview };
				return 'Era data changed. Review the updated import summary.';
			}
			pending = undefined;
			return 'Data imported.';
		});
	}

	const days = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`;
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
	{#if pending}
		<div class="confirmation" role="group" aria-label="Import summary">
			<p>
				Import data for <strong>{days(pending.preview.days)}</strong>. Existing values will be
				overwritten on
				<strong>{days(pending.preview.overwrittenDays)}</strong>.
			</p>
			{#if pending.preview.overwritesOtherData}
				<p>This also updates existing settings, measure definitions, reminders, or eras.</p>
			{/if}
			<div class="backup-actions">
				<button type="button" disabled={importing} onclick={confirmImport}>Confirm import</button>
				<button
					type="button"
					disabled={importing}
					onclick={() => {
						pending = undefined;
						status = error = '';
					}}>Cancel</button
				>
			</div>
		</div>
	{/if}
	<div class="timeline-setting">
		<label>
			Grid color
			<input
				type="color"
				value={timelineColor}
				disabled={importing}
				onchange={(event) => onTimelineColor(event.currentTarget.value)}
			/>
		</label>
		<span class="year-swatches" aria-hidden="true"><span></span><span></span></span>
		{#if timelineColor !== DEFAULT_TIMELINE_COLOR}
			<button
				type="button"
				disabled={importing}
				onclick={() => onTimelineColor(DEFAULT_TIMELINE_COLOR)}>Reset grid color</button
			>
		{/if}
	</div>
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
	.timeline-setting {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 16px;
	}
	.timeline-setting label,
	.year-swatches {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
	}
	input[type='color'] {
		width: 36px;
		height: 28px;
		padding: 2px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}
	.year-swatches span {
		width: 18px;
		height: 18px;
		border-radius: 1px;
		background: var(--year-light);
	}
	.year-swatches span:last-child {
		background: var(--year-dark);
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
	.confirmation {
		display: grid;
		gap: 8px;
		margin-top: 12px;
		padding-left: 12px;
		border-left: 2px solid var(--accent);
	}
	.confirmation strong {
		color: var(--ink);
	}
	.error {
		color: #a02d2d;
	}
</style>
