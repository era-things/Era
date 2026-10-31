<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { PageData } from './$types';
	import TimelineGrid from '../lib/components/TimelineGrid.svelte';
	import DayDetail from '../lib/components/DayDetail.svelte';
	import DayPanel from '../lib/components/DayPanel.svelte';
	import MeasuresManager from '../lib/components/MeasuresManager.svelte';
	import RemindersManager from '../lib/components/RemindersManager.svelte';
	import {
		REMINDERS_STORAGE_KEY,
		parseReminders,
		reminderOccursOn,
		reminderOverridesEmoji,
		setReminderCompleted,
		type Reminder
	} from '../lib/reminders';
	import {
		MEASURES_STORAGE_KEY,
		emptyMeasures,
		parseMeasures,
		removeMeasure,
		validMeasureValue,
		type Measure,
		type MeasureValue,
		type MeasuresState
	} from '../lib/measures';
	import { addDays, daysInRange, localToday, yearOf, type DateKey } from '../lib/calendar';
	import {
		DAY_EMOJIS_STORAGE_KEY,
		normalizeEmoji,
		parseDayEmojis,
		type DayEmojis
	} from '../lib/day-emojis';
	import {
		parseSavedView,
		VIEW_STORAGE_KEY,
		ZOOM_LEVELS,
		type ViewMode,
		type ZoomLevel
	} from '../lib/view-state';

	let { data }: { data: PageData } = $props();
	let browserToday = $state<DateKey | null>(null);
	let rangeStart = $state<number | null>(null);
	let selection = $state<DateKey | null>(null);
	let restored = $state(false);
	let mode = $state<ViewMode>('vertical');
	let zoom = $state<ZoomLevel>(100);
	let emojis = $state<DayEmojis>({});
	let emojiSaveError = $state('');
	let section = $state<'calendar' | 'measures' | 'reminders'>('calendar');
	let measures = $state<MeasuresState>(emptyMeasures());
	let measureSaveError = $state('');
	let reminders = $state<Reminder[]>([]);
	let reminderSaveError = $state('');
	const dayReminders = $derived(
		reminders.filter((reminder) => reminderOccursOn(reminder, selected))
	);
	const cellSize = $derived((24 * zoom) / 100);
	const zoomIndex = $derived(ZOOM_LEVELS.indexOf(zoom));
	let viewport: HTMLDivElement;
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	const today = $derived(browserToday ?? data.today);
	const firstYear = $derived(rangeStart ?? yearOf(today) - 5);
	const lastYear = $derived(firstYear + 9);
	const selected = $derived(selection ?? today);
	const reminderEmojis = $derived.by(() => {
		const overrides: DayEmojis = {};
		const enabled = reminders.filter((r) => r.overrideEmoji);
		if (!enabled.length) return overrides;
		for (const { key } of daysInRange(firstYear, lastYear)) {
			if (enabled.some((r) => reminderOverridesEmoji(r, key, today))) overrides[key] = '❗';
		}
		return overrides;
	});
	const displayedEmojis = $derived({ ...emojis, ...reminderEmojis });

	function saveView() {
		if (!restored || !viewport || section !== 'calendar') return;
		try {
			localStorage.setItem(
				VIEW_STORAGE_KEY,
				JSON.stringify({
					version: 3,
					mode,
					zoom,
					firstYear,
					selected,
					scrollTop: viewport.scrollTop,
					scrollLeft: viewport.scrollLeft
				})
			);
		} catch {
			/* The timeline works when browser storage is unavailable. */
		}
	}

	function scheduleSave() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(saveView, 120);
	}

	$effect(() => {
		firstYear;
		selected;
		mode;
		zoom;
		if (restored) saveView();
	});

	onMount(() => {
		let active = true;
		const refreshToday = () => {
			browserToday = localToday();
		};
		refreshToday();
		try {
			emojis = parseDayEmojis(localStorage.getItem(DAY_EMOJIS_STORAGE_KEY));
		} catch {
			emojiSaveError = 'Day emoji storage is unavailable in this browser.';
		}
		const syncEmojis = (event: StorageEvent) => {
			if (event.key === DAY_EMOJIS_STORAGE_KEY) emojis = parseDayEmojis(event.newValue);
		};
		try {
			measures = parseMeasures(localStorage.getItem(MEASURES_STORAGE_KEY));
		} catch {
			measureSaveError = 'Measure storage is unavailable in this browser.';
		}
		const syncMeasures = (event: StorageEvent) => {
			if (event.key === MEASURES_STORAGE_KEY) measures = parseMeasures(event.newValue);
		};
		window.addEventListener('storage', syncMeasures);
		window.addEventListener('storage', syncEmojis);
		try {
			reminders = parseReminders(localStorage.getItem(REMINDERS_STORAGE_KEY));
		} catch {
			reminderSaveError = 'Reminder storage is unavailable in this browser.';
		}
		const syncReminders = (event: StorageEvent) => {
			if (event.key === REMINDERS_STORAGE_KEY) reminders = parseReminders(event.newValue);
		};
		window.addEventListener('storage', syncReminders);
		let saved = null;
		try {
			saved = parseSavedView(localStorage.getItem(VIEW_STORAGE_KEY));
		} catch {
			/* Use today. */
		}
		if (saved) {
			rangeStart = saved.firstYear;
			selection = saved.selected;
			mode = saved.mode;
			zoom = saved.zoom;
		}
		const initialView = saved;
		void tick().then(() => {
			if (!active) return;
			if (initialView) {
				viewport.scrollTop = initialView.scrollTop;
				viewport.scrollLeft = initialView.scrollLeft;
			} else {
				document
					.getElementById('day-' + today)
					?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
			}
			restored = true;
		});
		const timer = window.setInterval(refreshToday, 60_000);
		window.addEventListener('focus', refreshToday);
		window.addEventListener('pagehide', saveView);
		return () => {
			saveView();
			active = false;
			clearTimeout(saveTimer);
			window.clearInterval(timer);
			window.removeEventListener('focus', refreshToday);
			window.removeEventListener('pagehide', saveView);
			window.removeEventListener('storage', syncEmojis);
			window.removeEventListener('storage', syncMeasures);
			window.removeEventListener('storage', syncReminders);
		};
	});

	async function changeRange(direction: number) {
		// Preserve month/day and viewport position when browsing another decade.
		const nextYear = yearOf(selected) + direction * 10;
		let next = nextYear + selected.slice(4);
		if (new Date(next + 'T00:00:00Z').toISOString().slice(0, 10) !== next)
			next = nextYear + '-02-28';
		const top = viewport.scrollTop;
		const left = viewport.scrollLeft;
		rangeStart = firstYear + direction * 10;
		selection = next;
		await tick();
		viewport.scrollTop = top;
		viewport.scrollLeft = left;
		saveView();
	}

	async function focusDay(key: DateKey, center = false, focus = true) {
		await tick();
		const element = document.getElementById('day-' + key);
		if (focus) element?.focus({ preventScroll: true });
		// Nearest leaves the viewport untouched while the destination is visible.
		element?.scrollIntoView({
			block: center ? 'center' : 'nearest',
			inline: center ? 'center' : 'nearest',
			behavior: 'instant'
		});
		saveView();
	}

	async function goToToday() {
		if (yearOf(today) < firstYear || yearOf(today) > lastYear) rangeStart = yearOf(today) - 5;
		selection = today;
		await focusDay(today, true);
	}

	async function navigateDay(key: DateKey, offset: number, focus = true) {
		const next = addDays(key, offset);
		if (yearOf(next) < firstYear || yearOf(next) > lastYear) return;
		selection = next;
		await focusDay(next, false, focus);
	}

	async function changeMode(next: ViewMode) {
		const wasCalendar = section === 'calendar';
		section = 'calendar';
		if (mode === next && wasCalendar) return;
		clearTimeout(saveTimer);
		mode = next;
		await tick();
		document
			.getElementById('day-' + selected)
			?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
		saveView();
	}

	async function navigateTabs(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const tabs = ['horizontal', 'vertical', 'measures', 'reminders'] as const;
		const index = tabs.indexOf(section === 'calendar' ? mode : section);
		const next =
			event.key === 'Home'
				? tabs[0]
				: event.key === 'End'
					? tabs[tabs.length - 1]
					: tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
		if (next === 'measures') showMeasures();
		else if (next === 'reminders') showReminders();
		else await changeMode(next);
		await tick();
		document.getElementById('tab-' + next)?.focus();
	}

	function showMeasures() {
		saveView();
		section = 'measures';
	}

	function showReminders() {
		saveView();
		section = 'reminders';
	}

	function persistReminders(next: Reminder[]): boolean {
		try {
			localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify({ version: 1, reminders: next }));
			reminders = next;
			reminderSaveError = '';
			return true;
		} catch {
			reminderSaveError = 'Could not save reminders in this browser.';
			return false;
		}
	}

	function saveReminder(reminder: Reminder): boolean {
		return persistReminders(
			reminders.some((r) => r.id === reminder.id)
				? reminders.map((r) => (r.id === reminder.id ? reminder : r))
				: [...reminders, reminder]
		);
	}

	function completeReminder(id: string, completed: boolean) {
		persistReminders(
			reminders.map((r) => (r.id === id ? setReminderCompleted(r, selected, completed) : r))
		);
	}

	function persistMeasures(next: MeasuresState): boolean {
		try {
			localStorage.setItem(MEASURES_STORAGE_KEY, JSON.stringify({ version: 1, ...next }));
			measures = next;
			measureSaveError = '';
			return true;
		} catch {
			measureSaveError = 'Could not save measures in this browser.';
			return false;
		}
	}

	function saveMeasure(measure: Measure): boolean {
		const previous = measures.definitions.find((m) => m.id === measure.id);
		if (previous && previous.type !== measure.type) return false;
		return persistMeasures({
			...measures,
			definitions: previous
				? measures.definitions.map((m) => (m.id === measure.id ? measure : m))
				: [...measures.definitions, measure]
		});
	}

	function setMeasureValue(id: string, value: MeasureValue) {
		const definition = measures.definitions.find((m) => m.id === id);
		if (!definition || !validMeasureValue(definition.type, value)) return;
		persistMeasures({
			...measures,
			days: { ...measures.days, [selected]: { ...measures.days[selected], [id]: value } }
		});
	}

	function removeDayMeasure(id: string) {
		const days = { ...measures.days };
		const values = { ...days[selected] };
		delete values[id];
		if (Object.keys(values).length) days[selected] = values;
		else delete days[selected];
		persistMeasures({ ...measures, days });
	}

	async function setZoom(next: ZoomLevel) {
		if (zoom === next) return;
		clearTimeout(saveTimer);
		const bounds = viewport.getBoundingClientRect();
		const grid = viewport
			.querySelector('.vertical-days, .horizontal-days')
			?.getBoundingClientRect();
		let anchor: Element | null = null;
		if (grid) {
			const x = Math.max(
				grid.left + 6,
				Math.min(bounds.left + viewport.clientWidth / 2, grid.right - 6)
			);
			const y = Math.max(
				grid.top + 6,
				Math.min(bounds.top + viewport.clientHeight / 2, grid.bottom - 6)
			);
			for (const [dx, dy] of [
				[0, 0],
				[4, 0],
				[0, 4],
				[4, 4],
				[-4, -4]
			]) {
				const candidate = document.elementFromPoint(x + dx, y + dy)?.closest('.day');
				if (candidate?.classList.contains('day') && viewport.contains(candidate)) {
					anchor = candidate;
					break;
				}
			}
		}
		const before = anchor?.getBoundingClientRect();
		zoom = next;
		await tick();
		if (anchor && before) {
			const after = anchor.getBoundingClientRect();
			viewport.scrollTop += after.top - before.top;
			viewport.scrollLeft += after.left - before.left;
		}
		saveView();
	}

	function adjustZoom(direction: number) {
		return setZoom(
			ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, zoomIndex + direction))]
		);
	}

	function setEmoji(value: string) {
		const emoji = normalizeEmoji(value);
		if (emoji === null) return;
		const next = { ...emojis };
		if (emoji) next[selected] = emoji;
		else delete next[selected];
		try {
			localStorage.setItem(DAY_EMOJIS_STORAGE_KEY, JSON.stringify({ version: 1, days: next }));
			emojis = next;
			emojiSaveError = '';
		} catch {
			emojiSaveError = 'Could not save the emoji in this browser.';
		}
	}
</script>

<svelte:head>
	<title>Era</title>
	<meta name="description" content="Personal day timeline." />
</svelte:head>

<main class="app" aria-label="Era timeline" style:--cell={cellSize + 'px'}>
	<header class="toolbar">
		<h1>Era</h1>
		<nav class="range-controls" aria-label="Timeline range" hidden={section !== 'calendar'}>
			<button
				type="button"
				aria-label="Previous ten years"
				title="Previous ten years"
				disabled={firstYear <= 1910}
				onclick={() => changeRange(-1)}>←</button
			>
			<span class="range-label" aria-live="polite">{firstYear}–{lastYear}</span>
			<button
				type="button"
				aria-label="Next ten years"
				title="Next ten years"
				disabled={firstYear >= 2090}
				onclick={() => changeRange(1)}>→</button
			>
		</nav>
		<div class="view-tabs" role="tablist" aria-label="View">
			<button
				type="button"
				role="tab"
				id="tab-horizontal"
				onkeydown={navigateTabs}
				aria-selected={section === 'calendar' && mode === 'horizontal'}
				aria-controls="timeline-panel"
				tabindex={section === 'calendar' && mode === 'horizontal' ? 0 : -1}
				onclick={() => changeMode('horizontal')}>Weekdays</button
			>
			<button
				type="button"
				role="tab"
				id="tab-vertical"
				onkeydown={navigateTabs}
				aria-selected={section === 'calendar' && mode === 'vertical'}
				aria-controls="timeline-panel"
				tabindex={section === 'calendar' && mode === 'vertical' ? 0 : -1}
				onclick={() => changeMode('vertical')}>Grid</button
			>
			<button
				type="button"
				role="tab"
				id="tab-measures"
				onkeydown={navigateTabs}
				aria-selected={section === 'measures'}
				aria-controls="measures-panel"
				tabindex={section === 'measures' ? 0 : -1}
				onclick={showMeasures}>Measures</button
			>
			<button
				type="button"
				role="tab"
				id="tab-reminders"
				onkeydown={navigateTabs}
				aria-selected={section === 'reminders'}
				aria-controls="reminders-panel"
				tabindex={section === 'reminders' ? 0 : -1}
				onclick={showReminders}>Reminders</button
			>
		</div>
		<div
			class="zoom-controls"
			role="group"
			aria-label="Timeline zoom"
			hidden={section !== 'calendar'}
		>
			<button
				type="button"
				aria-label="Zoom out"
				title="Zoom out"
				disabled={zoomIndex === 0}
				onclick={() => adjustZoom(-1)}>−</button
			>
			<button
				type="button"
				class="zoom-readout"
				aria-label="Reset zoom to 100%"
				title="Reset zoom to 100%"
				onclick={() => setZoom(100)}>{zoom}%</button
			>
			<button
				type="button"
				aria-label="Zoom in"
				title="Zoom in"
				disabled={zoomIndex === ZOOM_LEVELS.length - 1}
				onclick={() => adjustZoom(1)}>+</button
			>
		</div>
		<button class="today-button" type="button" onclick={goToToday} hidden={section !== 'calendar'}
			>Today</button
		>
	</header>
	{#if measureSaveError}<p class="measure-save-error" role="alert">{measureSaveError}</p>{/if}
	{#if reminderSaveError}<p class="measure-save-error" role="alert">{reminderSaveError}</p>{/if}
	<div class="calendar-content" hidden={section !== 'calendar'}>
		{#if mode === 'horizontal'}<DayDetail {selected} {today} />{/if}
		<div class={['view-workspace', { 'with-day-panel': mode === 'vertical' }]}>
			<div
				class={['timeline-scroll', mode]}
				id="timeline-panel"
				bind:this={viewport}
				onscroll={scheduleSave}
				role="tabpanel"
				aria-labelledby={'tab-' + mode}
			>
				<TimelineGrid
					{firstYear}
					{lastYear}
					{today}
					{selected}
					{mode}
					{cellSize}
					emojis={displayedEmojis}
					onSelect={(key) => (selection = key)}
					onNavigate={navigateDay}
				/>
			</div>
			{#if mode === 'vertical'}
				<DayPanel
					{selected}
					{today}
					{firstYear}
					{lastYear}
					emoji={emojis[selected] ?? ''}
					onEmojiChange={setEmoji}
					saveError={emojiSaveError}
					onNavigate={(key, offset) => navigateDay(key, offset, false)}
					measures={measures.definitions}
					measureValues={measures.days[selected] ?? {}}
					onAddMeasure={(measure) =>
						setMeasureValue(measure.id, measure.type === 'uint' ? 0 : false)}
					onMeasureChange={setMeasureValue}
					onRemoveMeasure={removeDayMeasure}
					onManageMeasures={showMeasures}
					reminders={dayReminders}
					onManageReminders={showReminders}
					onCompleteReminder={completeReminder}
					onAddReminder={(text) =>
						saveReminder({
							id: crypto.randomUUID(),
							text,
							period: 'once',
							start: selected,
							overrideEmoji: false,
							leadDays: 0,
							completedDates: []
						})}
				/>
			{/if}
		</div>
	</div>
	{#if section === 'measures'}
		<MeasuresManager
			measures={measures.definitions}
			onsave={saveMeasure}
			ondelete={(id) => persistMeasures(removeMeasure(measures, id))}
		/>
	{/if}
	{#if section === 'reminders'}
		<RemindersManager
			{reminders}
			{selected}
			{today}
			onsave={saveReminder}
			ondelete={(id) => persistReminders(reminders.filter((r) => r.id !== id))}
		/>
	{/if}
</main>
