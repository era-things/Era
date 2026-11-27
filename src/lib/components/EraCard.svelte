<script lang="ts">
	import { asDate, type DateKey } from '../calendar';
	import { datesToMark, eraPalette, eraStats, eraValueLabel, type Era, type EraDay } from '../eras';
	import type { DayEmojis } from '../day-emojis';
	import type { DayNotes } from '../day-notes';
	import { notePreview } from '../note-preview';
	import { formatDuration } from '../duration';
	import Chevron from './Chevron.svelte';
	import DatePicker from './DatePicker.svelte';
	import EraEditor from './EraEditor.svelte';
	import MarkdownNote from './MarkdownNote.svelte';
	import WidgetIcon from './WidgetIcon.svelte';
	import { WIDGET_ICONS, type WidgetIcon as Icon } from '../widget-icons';

	let {
		era,
		history,
		emojis,
		notes,
		today,
		onsave,
		onmark,
		onshow
	}: {
		era: Era;
		history: [DateKey, EraDay][];
		emojis: DayEmojis;
		notes: DayNotes;
		today: DateKey;
		onsave: (era: Era) => boolean;
		onmark: (id: string, mark: DateKey[], unmark: DateKey[]) => boolean;
		onshow: (id: string) => void;
	} = $props();
	const titleId = $props.id();
	let editing = $state(false);
	let rangeOpen = $state(false);
	let from = $state('');
	let through = $state('');
	let rangeError = $state('');
	let historyOpen = $state(false);
	let focusedStat = $state('');
	let pinnedStat = $state('');
	const visibleStat = $derived(focusedStat || pinnedStat);
	const historyMonths = $derived.by(() => {
		const months = new Map<string, [DateKey, EraDay][]>();
		if (!historyOpen) return months;
		for (const entry of history) {
			const month = entry[0].slice(0, 7);
			if (!months.has(month)) months.set(month, []);
			months.get(month)!.push(entry);
		}
		return months;
	});
	const monthLabel = new Intl.DateTimeFormat('en-US', {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
	const stats = $derived(
		eraStats(
			era.linkedValue,
			history.map(([, entry]) => entry)
		)
	);
	const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 });
	const calendarOutline = 'M4 6h16v14H4ZM8 3v6m8-6v6M4 10h16';
	const statIcons = {
		day: { paths: [{ d: calendarOutline }] },
		loggedDay: { paths: [{ d: calendarOutline }, { d: 'm8 15 2 2 5-5' }] },
		total: { paths: [{ d: 'M18 4H6l7 8-7 8h12' }] },
		average: { paths: [{ d: 'M5 20v-5m7 5V9m7 11V4M3 12h18' }] },
		range: { paths: [{ d: 'M4 7v10m16-10v10M8 12h8m-5-3-3 3 3 3m2-6 3 3-3 3' }] },
		completed: { paths: [{ d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 12l3 3 5-6' }] }
	} satisfies Record<string, Icon>;
	const shortDate = new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});
	const dateColumns = ['weekday', 'month', 'day', 'year'];
	const averageDetail = (count: number, kind: 'linked' | 'logged') =>
		`Average across ${count} ${kind} ${count === 1 ? 'day' : 'days'}`;
	function toggleArchive() {
		if (onsave({ ...era, archived: !era.archived, autoMarkedThrough: undefined }))
			rangeOpen = false;
	}
	function toggleRange() {
		rangeOpen = !rangeOpen;
		from = through = today;
		rangeError = '';
	}
	function markRange(event: SubmitEvent) {
		event.preventDefault();
		const dates = datesToMark(from, through);
		if (!dates) {
			rangeError = 'Enter a start and end date in order.';
			return;
		}
		if (onmark(era.id, dates, [])) rangeOpen = false;
	}
</script>

{#snippet statistic(icon: Icon, label: string, value: string, detail = label)}
	{@const detailId = titleId + '-stat-' + label.replace(/[^a-z]/gi, '-')}
	<div class="statistic" title={label}>
		<dt>{label}</dt>
		<dd>
			<button
				type="button"
				aria-label={label + ', ' + value}
				aria-expanded={visibleStat === label}
				aria-describedby={visibleStat === label ? detailId : undefined}
				onfocus={() => (focusedStat = label)}
				onblur={() => (focusedStat = '')}
				onclick={() => {
					focusedStat = '';
					pinnedStat = pinnedStat === label ? '' : label;
				}}
				onkeydown={(event) => {
					if (event.key === 'Escape') focusedStat = pinnedStat = '';
				}}
			>
				<WidgetIcon {icon} size={16} />{value}
			</button>
			{#if visibleStat === label}<span class="stat-detail" id={detailId}>{detail}</span>{/if}
		</dd>
	</div>
{/snippet}

<article class="era-card" aria-labelledby={titleId}>
	<div class="era-heading">
		<h2 id={titleId} class="era-title" style:--era-color={eraPalette(era).bright}>
			<span class="era-swatch" aria-hidden="true"></span>{era.name}
		</h2>
		<div class="era-actions">
			<button type="button" onclick={() => onshow(era.id)}>Show on grid</button>
			{#if !era.archived}
				<label class="active">
					<input
						type="checkbox"
						checked={era.autoMarkedThrough !== undefined}
						onchange={(event) =>
							onsave({
								...era,
								autoMarkedThrough: event.currentTarget.checked ? today : undefined
							})}
					/>
					Active
				</label>
			{/if}
			<button type="button" disabled={editing} onclick={() => (editing = true)}>Edit</button>
			<button type="button" onclick={toggleArchive}>{era.archived ? 'Restore' : 'Archive'}</button>
		</div>
	</div>
	{#if editing}
		<EraEditor
			{era}
			onsave={(next) => {
				if (onsave(next)) editing = false;
			}}
			oncancel={() => (editing = false)}
		/>
	{:else if era.description}
		<MarkdownNote
			value={era.description}
			readonly
			compact
			options={{ label: 'Era description' }}
			regionLabel="Era description"
		/>
	{/if}

	<section class="history" aria-label="Era history">
		<div class="era-heading">
			<div class="history-summary">
				<button
					type="button"
					class="history-toggle"
					disabled={!history.length}
					aria-expanded={historyOpen && history.length > 0}
					onclick={() => (historyOpen = !historyOpen)}
				>
					<Chevron direction={historyOpen ? 'down' : 'right'} size={14} />
					Days <span>{history.length}</span>
				</button>
			</div>
			{#if !era.archived}
				<button type="button" aria-expanded={rangeOpen} onclick={toggleRange}
					>Mark date range</button
				>
			{/if}
		</div>
		{#if stats}
			<dl
				class="era-stats"
				aria-label="Era statistics"
				style:--stat-accent={eraPalette(era).bright}
			>
				{#if stats.kind === 'hours'}
					{@render statistic(WIDGET_ICONS.clock, 'Total time', formatDuration(stats.total))}
					{@render statistic(
						statIcons.day,
						'Average per linked day',
						formatDuration(Math.round(stats.total / history.length)),
						averageDetail(history.length, 'linked')
					)}
					{@render statistic(
						statIcons.loggedDay,
						'Average per logged day',
						formatDuration(Math.round(stats.average)),
						averageDetail(stats.count, 'logged')
					)}
				{:else if stats.kind === 'boolean'}
					{@render statistic(
						statIcons.completed,
						'Days on / days logged',
						`${stats.on} / ${stats.count}`
					)}
				{:else}
					{@render statistic(statIcons.total, 'Total', number.format(stats.total))}
					{@render statistic(
						statIcons.average,
						'Average',
						number.format(stats.average),
						averageDetail(stats.count, 'logged')
					)}
					{@render statistic(
						statIcons.range,
						'Minimum–maximum',
						`${number.format(stats.min)}–${number.format(stats.max)}`
					)}
				{/if}
			</dl>
		{/if}
		{#if rangeOpen}
			<form class="range-form" onsubmit={markRange}>
				<DatePicker label="From" bind:value={from} {today} />
				<DatePicker label="Through" bind:value={through} {today} />
				<button class="era-primary" type="submit">Mark days</button>
				{#if rangeError}<p role="alert">{rangeError}</p>{/if}
			</form>
		{/if}
		{#if historyOpen && history.length}
			<ul class="history-list" aria-label="Linked days">
				{#each historyMonths as [month, entries] (month)}
					<li class="history-month">
						<h3>{monthLabel.format(asDate(entries[0][0]))}</h3>
						<ul>
							{#each entries as [date, entry] (date)}
								{@const day = asDate(date)}
								{@const parts = shortDate.formatToParts(day)}
								{@const emoji = emojis[date]}
								{@const preview = notes[date] ? notePreview(notes[date]) : ''}
								<li class="history-day">
									<a
										href={'/eras?era=' + era.id + '&day=' + date}
										aria-label={shortDate.format(day) + (emoji ? ' ' + emoji : '')}
										aria-describedby={preview ? titleId + '-' + date : undefined}
									>
										<span class="history-date">
											<span class="history-emoji" aria-hidden="true">{emoji ?? ''}</span>
											<time datetime={date}>
												{#each dateColumns as column (column)}
													<span class:day-number={column === 'day'}
														>{parts.find(({ type }) => type === column)?.value}</span
													>
												{/each}
											</time>
										</span>
										{#if preview}<span class="note-preview" id={titleId + '-' + date}
												>{preview}</span
											>{/if}
									</a>
									<span class="duration">{eraValueLabel(era.linkedValue, entry)}</span>
									{#if entry.marked}
										<button
											type="button"
											aria-label={'Unmark ' + date}
											onclick={() => onmark(era.id, [], [date])}>×</button
										>
									{/if}
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</article>

<style>
	.era-card {
		display: grid;
		gap: 10px;
		min-width: 0;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--paper);
	}
	.era-heading,
	.history-summary,
	.era-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	.era-heading {
		justify-content: space-between;
	}
	h2,
	ul,
	p {
		margin: 0;
	}
	h2 {
		font-size: 15px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	button {
		min-height: 32px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: transparent;
		padding: 6px 10px;
		font-size: 12px;
	}
	button:hover:not(:disabled),
	a:hover {
		background: #e5eae2;
	}
	.era-primary {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}
	.era-primary:hover:not(:disabled) {
		background: #1b574b;
	}
	ul {
		list-style: none;
		padding: 0;
	}
	a {
		display: block;
		color: inherit;
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	a:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.era-swatch {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--era-color);
	}
	.era-title .era-swatch {
		margin-inline-end: 8px;
	}
	.active {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		cursor: pointer;
	}
	.active input {
		margin: 0;
		accent-color: var(--accent);
	}
	.history {
		margin-top: 6px;
	}
	.history-summary {
		column-gap: 12px;
	}
	.era-stats {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin: 8px 0 0;
		padding: 6px 9px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--stat-accent) 7%, var(--paper));
		font-size: 12px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.statistic {
		flex: 1 1 auto;
		min-width: 0;
	}
	.statistic dt {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.statistic dd {
		margin: 0;
	}
	.statistic dd button {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 24px;
		padding: 0 3px;
		border: 0;
		font-weight: inherit;
		overflow-wrap: anywhere;
	}
	.stat-detail {
		position: absolute;
		z-index: 3;
		inset-block-start: calc(100% + 2px);
		inset-inline-start: 0;
		padding: 4px 7px;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--paper);
		color: var(--muted);
		font-weight: 400;
	}
	.statistic dd :global(svg) {
		flex: none;
		color: var(--stat-accent);
	}
	.history-toggle {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.history-toggle span {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.history-list,
	.range-form {
		margin-top: 8px;
	}
	.history-list {
		max-block-size: min(18rem, 40dvh);
		overflow-y: auto;
		overscroll-behavior-y: contain;
		scrollbar-gutter: stable;
		scroll-padding-top: 24px;
	}
	.history-month h3 {
		position: sticky;
		inset-block-start: 0;
		z-index: 1;
		margin: 0;
		padding: 4px;
		background: var(--paper);
		color: var(--muted);
		font-size: 12px;
	}
	.history-day {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto 30px;
		align-items: center;
		border-top: 1px solid var(--line);
		font-size: 13px;
	}
	.history-list a {
		min-width: 0;
		padding: 7px 4px;
		color: var(--accent);
	}
	.history-date {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.history-emoji {
		flex: 0 0 1.4em;
		text-align: center;
	}
	.note-preview {
		display: block;
		overflow: hidden;
		margin-top: 3px;
		color: var(--muted);
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.history-list time {
		display: grid;
		grid-template-columns: 4ch 4ch 2ch 4ch;
		gap: 0.55em;
		font-variant-numeric: tabular-nums;
	}
	.day-number {
		text-align: right;
	}
	.duration {
		font-size: 12px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.history-list button {
		min-height: 24px;
		padding: 0;
		margin-inline-start: 6px;
		border-color: transparent;
	}
	.range-form {
		display: flex;
		align-items: end;
		gap: 8px;
		flex-wrap: wrap;
	}
	.range-form [role='alert'] {
		flex-basis: 100%;
		font-size: 12px;
		color: #a02d2d;
	}
</style>
