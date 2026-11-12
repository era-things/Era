<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { untrack } from 'svelte';
	import { changes, type Section, type Change } from '../lib/calendar-records';
	import type { CalendarData } from '../lib/data-export';
	import { setDayNote } from '../lib/day-notes';
	import type { PageData } from './$types';
	import TimelineGrid from '../lib/components/TimelineGrid.svelte';
	import DayDetail from '../lib/components/DayDetail.svelte';
	import DayPanel from '../lib/components/DayPanel.svelte';
	import MeasuresManager from '../lib/components/MeasuresManager.svelte';
	import RemindersManager from '../lib/components/RemindersManager.svelte';
	import SettingsPanel from '../lib/components/SettingsPanel.svelte';
	import { previousNutritionItems, setNutritionItems, type FoodItem } from '../lib/nutrition';
	import {
		createReminder,
		reminderOccursOn,
		reminderOverridesEmoji,
		setReminderCompleted,
		type Reminder
	} from '../lib/reminders';
	import {
		removeMeasure,
		validMeasureValue,
		type Measure,
		type MeasureValue
	} from '../lib/measures';
	import {
		addDays,
		daysInRange,
		localToday,
		relativeDay,
		yearOf,
		type DateKey
	} from '../lib/calendar';
	import { normalizeEmoji, type DayEmojis } from '../lib/day-emojis';
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
	let calendarData = $state<CalendarData>(untrack(() => data.calendar));
	const emojis = $derived(calendarData.emojis),
		notes = $derived(calendarData.notes),
		reminders = $derived(calendarData.reminders),
		measures = $derived(calendarData.measures),
		nutrition = $derived(calendarData.nutrition);
	let section = $state<'calendar' | 'today' | 'measures' | 'reminders' | 'settings'>('calendar');
	let saveError = $state('');
	let conflict = $state(false);
	const queue: Change[][] = [];
	let pending: Promise<void> | undefined;
	let generation = 0;
	let channel: BroadcastChannel | undefined;
	async function refresh() {
		if (queue.length) return;
		const ticket = ++generation;
		try {
			const response = await fetch('/api/calendar', { cache: 'no-store' });
			if (!response.ok) return;
			const next = await response.json();
			if (ticket === generation && !queue.length) calendarData = next;
		} catch {
			/* Retry on next focus. */
		}
	}
	function flush() {
		return (pending ??= send().finally(() => {
			pending = undefined;
		}));
	}
	async function readExport() {
		await flush();
		if (queue.length) throw new Error('Unsaved edits');
		const response = await fetch('/api/calendar', { cache: 'no-store' });
		if (!response.ok) throw new Error('Export unavailable');
		return (await response.json()) as CalendarData;
	}
	async function send() {
		if (conflict || !queue.length) return;
		try {
			while (queue.length) {
				const body = JSON.stringify(queue[0]);
				const res = await fetch('/api/calendar', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body,
					keepalive: body.length < 16000
				});
				if (!res.ok) {
					conflict = res.status === 409;
					throw new Error();
				}
				queue.shift();
			}
			saveError = '';
			channel?.postMessage('saved');
		} catch {
			saveError = conflict
				? 'This record changed on another device. Copy your unsaved edits before reloading.'
				: 'Changes are waiting to be saved.';
		}
	}
	function save<K extends Section>(key: K, value: CalendarData[K]): boolean {
		const next = { ...calendarData, [key]: value };
		const edits = changes(calendarData, next);
		if (edits.length) {
			generation++;
			calendarData = next;
			queue.push(edits);
			void flush();
		}
		return true;
	}
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
		channel = new BroadcastChannel('era-saves');
		channel.onmessage = refresh;
		window.addEventListener('focus', refresh);
		const warn = (event: BeforeUnloadEvent) => {
			if (queue.length) {
				event.preventDefault();
				event.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', warn);
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
			channel?.close();
			window.removeEventListener('focus', refresh);
			window.removeEventListener('beforeunload', warn);
			active = false;
			clearTimeout(saveTimer);
			window.clearInterval(timer);
			window.removeEventListener('focus', refreshToday);
			window.removeEventListener('pagehide', saveView);
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
		const tabs = ['horizontal', 'vertical', 'today', 'measures', 'reminders', 'settings'] as const;
		const index = tabs.indexOf(section === 'calendar' ? mode : section);
		const next =
			event.key === 'Home'
				? tabs[0]
				: event.key === 'End'
					? tabs[tabs.length - 1]
					: tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
		if (next === 'today') showToday();
		else if (next === 'measures') showMeasures();
		else if (next === 'reminders') showReminders();
		else if (next === 'settings') showSettings();
		else await changeMode(next);
		await tick();
		document.getElementById('tab-' + next)?.focus();
	}

	function showToday() {
		saveView();
		section = 'today';
	}

	function showMeasures() {
		saveView();
		section = 'measures';
	}

	function showReminders() {
		saveView();
		section = 'reminders';
	}

	function showSettings() {
		saveView();
		section = 'settings';
	}

	function saveReminder(reminder: Reminder): boolean {
		return save(
			'reminders',
			reminders.some((r) => r.id === reminder.id)
				? reminders.map((r) => (r.id === reminder.id ? reminder : r))
				: [...reminders, reminder]
		);
	}

	function completeReminder(day: DateKey, id: string, completed: boolean) {
		save(
			'reminders',
			reminders.map((r) => (r.id === id ? setReminderCompleted(r, day, completed) : r))
		);
	}

	function saveMeasure(measure: Measure): boolean {
		const previous = measures.definitions.find((m) => m.id === measure.id);
		if (previous && previous.type !== measure.type) return false;
		return save('measures', {
			...measures,
			definitions: previous
				? measures.definitions.map((m) => (m.id === measure.id ? measure : m))
				: [...measures.definitions, measure]
		});
	}

	function updateNutrition(day: DateKey, items: FoodItem[]): boolean {
		return save('nutrition', setNutritionItems(nutrition, day, items));
	}

	function setMeasureValue(day: DateKey, id: string, value: MeasureValue) {
		const definition = measures.definitions.find((m) => m.id === id);
		if (!definition || !validMeasureValue(definition.type, value)) return;
		save('measures', {
			...measures,
			days: { ...measures.days, [day]: { ...measures.days[day], [id]: value } }
		});
	}

	function removeDayMeasure(day: DateKey, id: string) {
		const days = { ...measures.days };
		const values = { ...days[day] };
		delete values[id];
		if (Object.keys(values).length) days[day] = values;
		else delete days[day];
		save('measures', { ...measures, days });
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

	function setEmoji(day: DateKey, value: string) {
		const emoji = normalizeEmoji(value);
		if (emoji === null) return;
		const next = { ...emojis };
		if (emoji) next[day] = emoji;
		else delete next[day];
		save('emojis', next);
	}
</script>

<svelte:head>
	<title>Era</title>
	<meta name="description" content="Personal day timeline." />
</svelte:head>

{#snippet dayEditor(day: DateKey, label: string, navigation = false)}
	<DayPanel
		selected={day}
		{today}
		{firstYear}
		{lastYear}
		{label}
		onNavigate={navigation ? (key, offset) => navigateDay(key, offset, false) : undefined}
		emoji={emojis[day] ?? ''}
		onEmojiChange={(value) => setEmoji(day, value)}
		measures={measures.definitions}
		measureValues={measures.days[day] ?? {}}
		onAddMeasure={(measure) =>
			setMeasureValue(day, measure.id, measure.type === 'uint' ? 0 : false)}
		onMeasureChange={(id, value) => setMeasureValue(day, id, value)}
		onRemoveMeasure={(id) => removeDayMeasure(day, id)}
		onManageMeasures={showMeasures}
		reminders={reminders.filter((reminder) => reminderOccursOn(reminder, day))}
		onManageReminders={showReminders}
		onCompleteReminder={(id, completed) => completeReminder(day, id, completed)}
		onAddReminder={(text) => saveReminder(createReminder(text, day))}
		nutritionEnabled={nutrition.enabled}
		nutritionItems={nutrition.days[day] ?? []}
		nutritionHistory={previousNutritionItems(nutrition.days, day)}
		onNutritionChange={(items) => updateNutrition(day, items)}
		note={notes[day] ?? ''}
		onNoteChange={(text) => save('notes', setDayNote(notes, day, text))}
	/>
{/snippet}

<main class="app" aria-label="Era timeline" aria-busy={!restored} style:--cell={cellSize + 'px'}>
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
				id="tab-today"
				onkeydown={navigateTabs}
				aria-selected={section === 'today'}
				aria-controls="today-panel"
				tabindex={section === 'today' ? 0 : -1}
				onclick={showToday}>Today</button
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
			<button
				type="button"
				role="tab"
				id="tab-settings"
				onkeydown={navigateTabs}
				aria-selected={section === 'settings'}
				aria-controls="settings-panel"
				tabindex={section === 'settings' ? 0 : -1}
				onclick={showSettings}>Settings</button
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
	{#if saveError}<p role="alert">
			{saveError}
			{#if conflict}<button onclick={() => window.location.reload()}>Reload</button>{:else}<button
					onclick={flush}>Retry</button
				>{/if}
		</p>{/if}
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
				{@render dayEditor(selected, 'Selected day', true)}
			{/if}
		</div>
	</div>
	{#if section === 'today'}
		<div class="today-view" id="today-panel" role="tabpanel" aria-labelledby="tab-today">
			<div class="today-workspace">
				{#each [-1, 0, 1] as offset (offset)}
					{@const day = addDays(today, offset)}
					{@render dayEditor(day, relativeDay(day, today))}
				{/each}
			</div>
		</div>
	{/if}
	{#if section === 'measures'}
		<MeasuresManager
			measures={measures.definitions}
			nutritionEnabled={nutrition.enabled}
			onNutritionEnabledChange={(enabled) => save('nutrition', { ...nutrition, enabled })}
			onsave={saveMeasure}
			ondelete={(id) => save('measures', removeMeasure(measures, id))}
		/>
	{/if}
	{#if section === 'reminders'}
		<RemindersManager
			{reminders}
			{selected}
			{today}
			onsave={saveReminder}
			ondelete={(id) =>
				save(
					'reminders',
					reminders.filter((r) => r.id !== id)
				)}
		/>
	{/if}
	{#if section === 'settings'}
		<SettingsPanel {readExport} />
	{/if}
</main>
