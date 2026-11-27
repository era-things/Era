<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import { beforeNavigate, goto, snapshot } from '$app/navigation';
	import { page } from '$app/state';
	import { APP_VIEWS, appViewForPath, type AppViewId } from '../../lib/app-views';
	import { capturePosition, restorePosition } from '../../lib/timeline-position';
	import { untrack } from 'svelte';
	import { createCalendarSync, type SyncState } from '../../lib/calendar-sync';
	import type { PageData } from './$types';
	import TimelineGrid from '../../lib/components/TimelineGrid.svelte';
	import DayPanel from '../../lib/components/DayPanel.svelte';
	import DayWidgets from '../../lib/components/DayWidgets.svelte';
	import DayEras from '../../lib/components/DayEras.svelte';
	import EraStack from '../../lib/components/EraStack.svelte';
	import EraSelector from '../../lib/components/EraSelector.svelte';
	import WidgetIcon from '../../lib/components/WidgetIcon.svelte';
	import {
		datesToMark,
		eraPalette,
		eraValueLabel,
		setEraMarks,
		setEraValue,
		type Era
	} from '../../lib/eras';
	import { setWidgetSettings } from '../../lib/widgets';
	import LayoutManager from '../../lib/components/LayoutManager.svelte';
	import RemindersManager from '../../lib/components/RemindersManager.svelte';
	import SettingsPanel from '../../lib/components/SettingsPanel.svelte';
	import {
		createReminder,
		reminderOccursOn,
		reminderOverridesEmoji,
		setReminderCompleted,
		type Reminder
	} from '../../lib/reminders';
	import { removeMeasure, type Measure } from '../../lib/measures';
	import {
		addDays,
		asDate,
		daysInRange,
		eraToday,
		formatDate,
		isDateKey,
		relativeDay,
		yearOf,
		type DateKey
	} from '../../lib/calendar';
	import { normalizeEmoji, type DayEmojis } from '../../lib/day-emojis';
	import {
		parseSavedView,
		VIEW_STORAGE_KEY,
		ZOOM_LEVELS,
		type SavedView,
		type ViewMode,
		type ZoomLevel
	} from '../../lib/view-state';

	let { data }: { data: PageData } = $props();
	let browserToday = $state<DateKey | null>(null);
	let rangeStart = $state<number | null>(null);
	let selection = $state<DateKey | null>(null);
	let restored = $state(false);
	const activeView = $derived(appViewForPath('/' + (page.params.view ?? ''))!);
	let mode = $state<ViewMode>(
		untrack(() => (activeView.section === 'calendar' ? activeView.mode : 'vertical'))
	);
	let zoom = $state<ZoomLevel>(100);
	let syncState = $state<SyncState>({
		data: untrack(() => data.calendar),
		error: '',
		retryable: false,
		remoteRevision: 0
	});
	const sync = createCalendarSync(
		untrack(() => syncState.data),
		(state) => {
			syncState = state;
		}
	);
	const { save, saveData, flush, readExport, previewImport, importBackup } = sync;
	const calendarData = $derived(syncState.data);
	const emojis = $derived(calendarData.emojis),
		reminders = $derived(calendarData.reminders),
		measures = $derived(calendarData.measures);
	const section = $derived(activeView.section);
	const sidebarTabs = [
		{ id: 'day', label: 'Day', accessibleLabel: 'Selected day' },
		{ id: 'eras', label: 'Eras', accessibleLabel: 'Eras stack' }
	] as const;
	type SidebarTab = (typeof sidebarTabs)[number]['id'];
	const eraId = $derived(page.url.searchParams.get('era'));
	let sidebarTab = $state<SidebarTab>(
		untrack(() => (eraId && !page.url.searchParams.has('day') ? 'eras' : 'day'))
	);
	const routeEra = $derived(
		activeView.id === 'eras' ? calendarData.eras.find(({ id }) => id === eraId) : undefined
	);
	let eraVisibility = $state<Set<string>>();
	const visibleEras = $derived.by(() => {
		if (activeView.id !== 'eras') return;
		if (eraVisibility) return calendarData.eras.filter(({ id }) => eraVisibility?.has(id));
		return routeEra ? [routeEra] : calendarData.eras;
	});
	const visibleEraIds = $derived(new Set(visibleEras?.map(({ id }) => id)));
	const selectedEra = $derived(visibleEras?.length === 1 ? visibleEras[0] : undefined);
	const markableEras = $derived(calendarData.eras.filter((era) => !era.archived));
	let rangePicking = $state(false);
	let rangeAnchor = $state<DateKey>();
	let rangeEnd = $state<DateKey>();
	let rangeEraId = $state('');
	let recentMark = $state<{ id: string; dates: DateKey[]; marked: boolean }>();
	const markRange = $derived<readonly [DateKey, DateKey] | undefined>(
		rangeAnchor && rangeEnd
			? rangeAnchor <= rangeEnd
				? [rangeAnchor, rangeEnd]
				: [rangeEnd, rangeAnchor]
			: rangeAnchor
				? [rangeAnchor, rangeAnchor]
				: undefined
	);
	let hoveredDay = $state<DateKey>();
	let focusedDay = $state<DateKey>();
	let eraTimelineWidth = $state(0);
	let eraFilterWidth = $state(0);
	let sidebarWidth = $state<number>();
	let sidebar = $state<HTMLElement>();
	let measuredSidebarWidth = $state(0);
	const sidebarWidthKey = 'era.sidebar-width';

	function cancelMarkRange() {
		rangePicking = false;
		rangeAnchor = rangeEnd = undefined;
	}

	function startMarkRange() {
		rangePicking = true;
		rangeAnchor = rangeEnd = undefined;
		rangeEraId = visibleEras?.find((era) => !era.archived)?.id ?? markableEras[0]?.id ?? '';
	}

	function pickGridDay(day: DateKey, extend = false) {
		if (mode === 'horizontal' && (rangePicking || extend) && markableEras.length) {
			if (!rangePicking || rangeEnd) startMarkRange();
			if (rangeAnchor) rangeEnd = day;
			else rangeAnchor = day;
			return;
		}
		selectDay(day);
	}

	function applyMarkRange(marked: boolean) {
		if (!markRange || !rangeEnd || !markableEras.some(({ id }) => id === rangeEraId)) return;
		const dates = datesToMark(...markRange)!.filter(
			(day) => Boolean(calendarData.eraDays[day]?.[rangeEraId]?.marked) !== marked
		);
		if (dates.length) {
			if (!changeEraMarks(rangeEraId, marked ? dates : [], marked ? [] : dates)) return;
			recentMark = { id: rangeEraId, dates, marked };
		}
		cancelMarkRange();
	}

	function undoMarkRange() {
		if (!recentMark) return;
		const { id, dates, marked } = recentMark;
		if (changeEraMarks(id, marked ? [] : dates, marked ? dates : [])) recentMark = undefined;
	}

	function previewTarget(target: EventTarget | null) {
		const key = target instanceof Element ? target.closest('.day')?.id.slice(4) : undefined;
		return isDateKey(key) ? key : undefined;
	}

	function resizeSidebar(width: number) {
		sidebarWidth = Math.min(sidebarMax, Math.max(280, Math.round(width)));
	}

	const sidebarMax = $derived(
		Math.max(280, Math.min(620, Math.floor((eraTimelineWidth + measuredSidebarWidth) * 0.55)))
	);

	function saveSidebarWidth() {
		try {
			if (sidebarWidth !== undefined) localStorage.setItem(sidebarWidthKey, String(sidebarWidth));
		} catch {}
	}

	function startSidebarResize(event: PointerEvent) {
		if (event.button !== 0) return;
		event.currentTarget instanceof HTMLElement &&
			event.currentTarget.setPointerCapture(event.pointerId);
	}

	function moveSidebarResize(event: PointerEvent) {
		if (
			event.currentTarget instanceof HTMLElement &&
			event.currentTarget.hasPointerCapture(event.pointerId) &&
			sidebar
		)
			resizeSidebar(sidebar.getBoundingClientRect().right - event.clientX);
	}

	function resizeSidebarWithKey(event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		resizeSidebar((sidebar?.offsetWidth ?? 320) + (event.key === 'ArrowLeft' ? 24 : -24));
		saveSidebarWidth();
	}

	function toggleEraVisibility(id: string) {
		const next = new Set(visibleEraIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		eraVisibility = next;
	}

	function isolateEra(id: string) {
		eraVisibility = new Set([id]);
	}

	function resetEraVisibility() {
		if (eraId === null) eraVisibility = undefined;
		else void goto('/eras', { reset: false });
	}

	const latestEraDay = $derived.by(() => {
		if (!routeEra) return;
		let latest: DateKey | undefined;
		for (const [date, eras] of Object.entries(calendarData.eraDays)) {
			if (eras[routeEra.id] && (latest === undefined || date > latest)) latest = date;
		}
		return latest;
	});
	const cellSize = $derived((24 * zoom) / 100);
	const zoomIndex = $derived(ZOOM_LEVELS.indexOf(zoom));
	let viewport = $state<HTMLDivElement>();
	let eraDayPanel = $state<HTMLDivElement>();
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
	const previewDay = $derived(hoveredDay ?? focusedDay ?? selected);
	const previewDateFormat = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
	const previewEras = $derived(
		calendarData.eras.flatMap((era) => {
			const entry = calendarData.eraDays[previewDay]?.[era.id];
			return entry ? [{ era, value: eraValueLabel(era.linkedValue, entry) }] : [];
		})
	);

	let views: Partial<Record<ViewMode, SavedView>> = {};
	let positioning = 0;
	let historyRestored = false;

	function rememberView() {
		if (!restored || !viewport || section !== 'calendar') return;
		const position = capturePosition(viewport);
		if (position) views[mode] = { version: 4, mode, zoom, firstYear, selected, position };
	}

	function saveView() {
		rememberView();
		const view = views[mode];
		if (!view) return;
		try {
			localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(view));
		} catch {
			/* The timeline works when browser storage is unavailable. */
		}
	}

	function applyView(view: SavedView) {
		rangeStart = view.firstYear;
		selection = view.selected;
		mode = view.mode;
		zoom = view.zoom;
	}

	async function positionView(view?: SavedView) {
		const ticket = ++positioning;
		clearTimeout(saveTimer);
		if (view) applyView(view);
		await tick();
		if (ticket !== positioning || !viewport) return;
		restorePosition(
			viewport,
			view?.position ?? { day: selected, x: -cellSize / 2, y: -cellSize / 2 }
		);
		restored = true;
		saveView();
	}

	snapshot({
		id: 'timeline-v5',
		capture: () => {
			saveView();
			return { views, mode, sidebarTab, visibleEraIds: eraVisibility && [...eraVisibility] };
		},
		restore: (value) => {
			historyRestored = true;
			sidebarTab = value.sidebarTab;
			eraVisibility = value.visibleEraIds && new Set(value.visibleEraIds);
			views = value.views;
			mode = activeView.section === 'calendar' ? activeView.mode : value.mode;
			const view = views[mode];
			if (section === 'calendar') void positionView(view);
			else {
				if (view) applyView(view);
				restored = true;
			}
		},
		reset: activateRoute
	});

	beforeNavigate(({ from, to }) => {
		saveView();
		positioning++;
		clearTimeout(saveTimer);
		if (from?.url.pathname !== '/eras' || to?.url.pathname !== '/eras') restored = false;
	});

	function scheduleSave() {
		rememberView();
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

	$effect(() => {
		const element = viewport;
		if (!element) return;
		const observer = new ResizeObserver(() => {
			const view = views[mode];
			if (restored && viewport === element && view) restorePosition(element, view.position);
		});
		observer.observe(element);
		return () => observer.disconnect();
	});

	onMount(() => {
		const minuteMs = 60_000;
		let timer: number | undefined;
		const refreshToday = () => {
			const now = new Date();
			browserToday = eraToday(now, data.timeZone);
			window.clearTimeout(timer);
			timer = window.setTimeout(refreshToday, minuteMs - (now.getTime() % minuteMs));
		};
		refreshToday();
		const disconnectSync = sync.connect();
		let saved = null;
		try {
			saved = parseSavedView(localStorage.getItem(VIEW_STORAGE_KEY));
			const storedWidth = Number(localStorage.getItem(sidebarWidthKey));
			if (storedWidth >= 280 && storedWidth <= 620) sidebarWidth = storedWidth;
		} catch {
			/* Use today. */
		}
		if (!historyRestored) {
			if (saved) {
				views[saved.mode] = saved;
				applyView(saved);
			}
			activateRoute();
		}
		window.addEventListener('focus', refreshToday);
		document.addEventListener('visibilitychange', refreshToday);
		window.addEventListener('pagehide', saveView);
		return () => {
			saveView();
			disconnectSync();
			positioning++;
			clearTimeout(saveTimer);
			window.clearTimeout(timer);
			window.removeEventListener('focus', refreshToday);
			document.removeEventListener('visibilitychange', refreshToday);
			window.removeEventListener('pagehide', saveView);
		};
	});

	async function changeRange(direction: number) {
		const element = viewport;
		if (!element) return;
		// Preserve month/day and viewport position when browsing another decade.
		const nextYear = yearOf(selected) + direction * 10;
		const prefix = String(nextYear).padStart(4, '0');
		let next = prefix + selected.slice(4);
		if (new Date(next + 'T00:00:00Z').toISOString().slice(0, 10) !== next) next = prefix + '-02-28';
		const top = element.scrollTop;
		const left = element.scrollLeft;
		rangeStart = firstYear + direction * 10;
		selection = next;
		await tick();
		if (viewport !== element) return;
		element.scrollTop = top;
		element.scrollLeft = left;
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
		selectDay(today, true);
		await focusDay(today, true);
	}

	async function navigateDay(key: DateKey, offset: number, focus = true) {
		const next = addDays(key, offset);
		if (!isDateKey(next) || yearOf(next) < firstYear || yearOf(next) > lastYear) return;
		hoveredDay = undefined;
		selectDay(next);
		await focusDay(next, false, focus);
	}

	function selectDay(day: DateKey, openDay = false) {
		selection = day;
		if (mode === 'horizontal') {
			if (openDay) sidebarTab = 'day';
			void tick().then(() => {
				if (eraDayPanel) eraDayPanel.scrollTop = 0;
			});
		}
	}

	async function openSelectedDay() {
		selectDay(selected, true);
		await tick();
		document.getElementById('sidebar-tab-day')?.focus({ preventScroll: true });
	}

	async function navigateSidebar(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowLeft':
			case 'ArrowRight':
				sidebarTab = sidebarTab === 'day' ? 'eras' : 'day';
				break;
			case 'Home':
				sidebarTab = 'day';
				break;
			case 'End':
				sidebarTab = 'eras';
				break;
			default:
				return;
		}
		event.preventDefault();
		await tick();
		document.getElementById('sidebar-tab-' + sidebarTab)?.focus();
	}

	function activateRoute() {
		eraVisibility = undefined;
		cancelMarkRange();
		if (activeView.section !== 'calendar') {
			restored = true;
			return;
		}
		mode = activeView.mode;
		const requestedDay = page.url.searchParams.get('day');
		if (mode === 'horizontal' && eraId && !requestedDay) sidebarTab = 'eras';
		const day = requestedDay ?? latestEraDay;
		if (isDateKey(day)) {
			const year = yearOf(day);
			if (year < firstYear || year > lastYear) rangeStart = Math.max(1, Math.min(9990, year - 5));
			if (requestedDay) {
				selectDay(day, true);
				if (mode === 'horizontal') {
					void tick().then(() => {
						eraDayPanel?.querySelector('.panel-date')?.scrollIntoView({ block: 'nearest' });
					});
				}
			} else selection = day;
			void positionView();
			return;
		}
		const view = views[mode];
		void positionView(
			view && view.firstYear === firstYear && view.zoom === zoom ? { ...view, selected } : undefined
		);
	}

	function showView(id: AppViewId) {
		if (activeView.id === id) return;
		const view = APP_VIEWS.find((view) => view.id === id)!;
		return goto(view.path, { reset: false });
	}
	const showLayout = () => showView('layout');
	const showReminders = () => showView('reminders');

	function saveEra(era: Era) {
		const { eras } = calendarData;
		return save(
			'eras',
			eras.some(({ id }) => id === era.id)
				? eras.map((item) => (item.id === era.id ? era : item))
				: [...eras, era]
		);
	}

	function changeEraMarks(id: string, mark: DateKey[], unmark: DateKey[]) {
		return save('eraDays', setEraMarks(calendarData.eraDays, id, mark, unmark));
	}

	async function navigateTabs(event: KeyboardEvent) {
		const index = APP_VIEWS.findIndex((view) => view.id === activeView.id);
		const positions = {
			Home: 0,
			End: APP_VIEWS.length - 1,
			ArrowLeft: (index + APP_VIEWS.length - 1) % APP_VIEWS.length,
			ArrowRight: (index + 1) % APP_VIEWS.length
		};
		if (!Object.hasOwn(positions, event.key)) return;
		event.preventDefault();
		const next = APP_VIEWS[positions[event.key as keyof typeof positions]];
		await showView(next.id);
		await tick();
		document.getElementById('tab-' + next.id)?.focus();
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

	async function setZoom(next: ZoomLevel) {
		const element = viewport;
		if (zoom === next || !element) return;
		clearTimeout(saveTimer);
		const bounds = element.getBoundingClientRect();
		const grid = element.querySelector('.vertical-days, .horizontal-days')?.getBoundingClientRect();
		let anchor: Element | null = null;
		if (grid) {
			const x = Math.max(
				grid.left + 6,
				Math.min(bounds.left + element.clientWidth / 2, grid.right - 6)
			);
			const y = Math.max(
				grid.top + 6,
				Math.min(bounds.top + element.clientHeight / 2, grid.bottom - 6)
			);
			for (const [dx, dy] of [
				[0, 0],
				[4, 0],
				[0, 4],
				[4, 4],
				[-4, -4]
			]) {
				const candidate = document.elementFromPoint(x + dx, y + dy)?.closest('.day');
				if (candidate?.classList.contains('day') && element.contains(candidate)) {
					anchor = candidate;
					break;
				}
			}
		}
		const before = anchor?.getBoundingClientRect();
		zoom = next;
		await tick();
		if (viewport !== element) return;
		if (anchor && before) {
			const after = anchor.getBoundingClientRect();
			element.scrollTop += after.top - before.top;
			element.scrollLeft += after.left - before.left;
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

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && rangePicking) cancelMarkRange();
	}}
/>

{#snippet timeline()}
	<div
		class={['timeline-scroll', mode]}
		style:visibility={restored ? 'visible' : 'hidden'}
		id="timeline-panel"
		role="group"
		aria-label="Timeline grid"
		bind:this={viewport}
		onscroll={scheduleSave}
		onpointerover={(event) => {
			if (mode === 'horizontal' && event.pointerType === 'mouse')
				hoveredDay = previewTarget(event.target);
		}}
		onpointerleave={() => (hoveredDay = undefined)}
		onfocusin={(event) => {
			if (mode === 'horizontal') focusedDay = previewTarget(event.target);
		}}
		onfocusout={(event) => (focusedDay = previewTarget(event.relatedTarget))}
	>
		<TimelineGrid
			{firstYear}
			{lastYear}
			dayLimit={data.timelineDayLimit}
			{today}
			{selected}
			{mode}
			{cellSize}
			emojis={displayedEmojis}
			eras={visibleEras}
			eraDays={calendarData.eraDays}
			{markRange}
			onSelect={pickGridDay}
			onNavigate={navigateDay}
		/>
	</div>
{/snippet}

{#snippet dayEditor(day: DateKey, label: string, navigation = false)}
	{@const eraEntries = calendarData.eraDays[day] ?? {}}
	<DayPanel
		selected={day}
		{today}
		{firstYear}
		{lastYear}
		{label}
		onNavigate={navigation ? (key, offset) => navigateDay(key, offset, false) : undefined}
		emoji={emojis[day] ?? ''}
		onEmojiChange={(value) => setEmoji(day, value)}
		reminders={reminders.filter((reminder) => reminderOccursOn(reminder, day))}
		onManageReminders={showReminders}
		onCompleteReminder={(id, completed) => completeReminder(day, id, completed)}
		onAddReminder={(text) => saveReminder(createReminder(text, day))}
	>
		<DayEras
			eras={calendarData.eras}
			entries={eraEntries}
			onmark={(id, marked) => changeEraMarks(id, marked ? [day] : [], marked ? [] : [day])}
		/>
		<DayWidgets
			data={calendarData}
			{day}
			eras={calendarData.eras}
			{eraEntries}
			onEraValue={(id, kind, value) =>
				save('eraDays', setEraValue(calendarData.eraDays, day, id, kind, value))}
			remoteRevision={(section === 'today' && day === today) ||
			(section === 'calendar' && day === selected)
				? syncState.remoteRevision
				: 0}
			onmanage={showLayout}
			onchange={(data) => saveData({ ...calendarData, ...data })}
		/>
	</DayPanel>
{/snippet}

<main
	class="app"
	aria-label="Era timeline"
	aria-busy={!restored}
	style:--cell={cellSize + 'px'}
	style:--timeline-color={calendarData.timelineColor}
>
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
		<div class="view-tabs" role="tablist" aria-label="View" data-sveltekit-reset="false">
			{#each APP_VIEWS as view (view.id)}
				<a
					href={view.path}
					role="tab"
					id={'tab-' + view.id}
					onkeydown={navigateTabs}
					aria-selected={activeView.id === view.id}
					aria-controls={view.section === 'calendar' ? 'calendar-panel' : view.id + '-panel'}
					tabindex={activeView.id === view.id ? 0 : -1}
					onclick={(event) => {
						if (
							activeView.id === view.id &&
							!event.ctrlKey &&
							!event.metaKey &&
							!event.shiftKey &&
							!event.altKey
						)
							event.preventDefault();
					}}>{view.label}</a
				>
			{/each}
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
	{#if syncState.error}<p role="alert">
			{syncState.error}
			{#if syncState.retryable}<button onclick={flush}>Retry</button>{:else}<button
					onclick={sync.dismiss}>Dismiss</button
				>{/if}
		</p>{/if}
	{#if section === 'calendar'}
		<div
			class="calendar-content"
			id="calendar-panel"
			role="tabpanel"
			aria-labelledby={'tab-' + (mode === 'horizontal' ? 'eras' : 'vertical')}
		>
			<div
				style:--era-sidebar-width={sidebarWidth !== undefined ? sidebarWidth + 'px' : undefined}
				class={[
					'view-workspace',
					{
						'with-day-panel': mode === 'vertical',
						'with-era-workspace': mode === 'horizontal'
					}
				]}
			>
				{#if mode === 'vertical'}
					{@render timeline()}
					{@render dayEditor(selected, 'Selected day', true)}
				{:else if activeView.id === 'eras'}
					<div class="era-timeline" bind:clientWidth={eraTimelineWidth}>
						<div class="era-grid-toolbar">
							{#if markableEras.length}
								<button
									class="era-mark-range"
									type="button"
									aria-label="Mark range"
									aria-expanded={rangePicking}
									onclick={() => (rangePicking ? cancelMarkRange() : startMarkRange())}
									title="Mark range (or Shift-click two days)"
								>
									<WidgetIcon
										icon={{
											paths: [
												{ d: 'M4 5h16v15H4ZM8 3v4m8-4v4M4 9h16' },
												{ d: 'M8 14h8m-8-2v4m8-4v4' }
											]
										}}
									/>
								</button>
							{/if}
							<div class="era-filter-row" bind:clientWidth={eraFilterWidth}>
								<EraSelector
									eras={calendarData.eras}
									availableWidth={eraFilterWidth}
									visibleIds={visibleEraIds}
									{selectedEra}
									onreset={resetEraVisibility}
									ontoggle={toggleEraVisibility}
									onisolate={isolateEra}
								/>
							</div>
							<div class="era-day-preview" role="group" aria-label="Day preview">
								<time class="preview-date" datetime={previewDay} title={formatDate(previewDay)}
									>{displayedEmojis[previewDay] ?? ''}
									{previewDateFormat.format(asDate(previewDay))}</time
								>
								{#each previewEras as { era, value } (era.id)}
									<span class="preview-era" style:--preview-era={eraPalette(era).faint}>
										{era.name}{value ? ' · ' + value : ''}
									</span>
								{/each}
							</div>
						</div>
						{#if rangePicking || recentMark}
							<div class="era-grid-feedback">
								{#if rangePicking}
									<div class="era-range-tools" role="group" aria-label="Mark grid date range">
										<span role="status"
											>{rangeEnd && markRange
												? formatDate(markRange[0]) + ' – ' + formatDate(markRange[1])
												: rangeAnchor
													? 'Choose the other end'
													: 'Choose two days'}</span
										>
										<select aria-label="Era to mark" bind:value={rangeEraId}>
											{#each markableEras as era (era.id)}<option value={era.id}>{era.name}</option
												>{/each}
										</select>
										<button type="button" disabled={!rangeEnd} onclick={() => applyMarkRange(true)}
											>Mark days</button
										>
										<button type="button" disabled={!rangeEnd} onclick={() => applyMarkRange(false)}
											>Unmark days</button
										>
										<button type="button" onclick={cancelMarkRange}>Cancel</button>
									</div>
								{/if}
								{#if recentMark}
									<div class="era-range-tools">
										<span role="status"
											>{recentMark.marked ? 'Marked' : 'Unmarked'}
											{recentMark.dates.length}
											{recentMark.dates.length === 1 ? 'day' : 'days'}</span
										>
										<button type="button" onclick={undoMarkRange}>Undo</button>
									</div>
								{/if}
							</div>
						{/if}
						{@render timeline()}
					</div>
					<aside
						class="era-sidebar"
						aria-label="Timeline sidebar"
						bind:this={sidebar}
						bind:clientWidth={measuredSidebarWidth}
					>
						<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (A resizable separator is focusable and supports arrow keys.) -->
						<div
							class="era-sidebar-resize"
							role="separator"
							aria-label="Resize timeline sidebar"
							aria-orientation="vertical"
							aria-valuemin={280}
							aria-valuemax={sidebarMax}
							aria-valuenow={Math.max(280, Math.min(sidebarMax, measuredSidebarWidth || 320))}
							tabindex="0"
							onpointerdown={startSidebarResize}
							onpointermove={moveSidebarResize}
							onlostpointercapture={saveSidebarWidth}
							onkeydown={resizeSidebarWithKey}
						></div>
						<div class="era-sidebar-tabs" role="tablist" aria-label="Timeline sidebar views">
							{#each sidebarTabs as { id, label, accessibleLabel } (id)}
								<button
									type="button"
									role="tab"
									id={'sidebar-tab-' + id}
									aria-label={accessibleLabel}
									aria-controls={'sidebar-panel-' + id}
									aria-selected={sidebarTab === id}
									tabindex={sidebarTab === id ? 0 : -1}
									onkeydown={navigateSidebar}
									onclick={() => (sidebarTab = id)}>{label}</button
								>
							{/each}
							{#if sidebarTab === 'eras'}
								<button class="open-era-day" type="button" onclick={openSelectedDay}
									>Open day</button
								>
							{/if}
						</div>
						<div
							class="era-sidebar-panel"
							id="sidebar-panel-day"
							role="tabpanel"
							aria-labelledby="sidebar-tab-day"
							bind:this={eraDayPanel}
							hidden={sidebarTab !== 'day'}
						>
							{@render dayEditor(selected, 'Selected day', true)}
						</div>
						<div
							class="era-sidebar-panel"
							id="sidebar-panel-eras"
							role="tabpanel"
							aria-labelledby="sidebar-tab-eras"
							hidden={sidebarTab !== 'eras'}
						>
							<EraStack
								eraDays={calendarData.eraDays}
								eras={calendarData.eras}
								{emojis}
								notes={calendarData.notes}
								unavailable={eraId !== null && !routeEra}
								{today}
								onsave={saveEra}
								onmark={changeEraMarks}
								onshow={isolateEra}
							/>
						</div>
					</aside>
				{/if}
			</div>
		</div>
	{:else if section === 'today'}
		<div class="today-view" id="today-panel" role="tabpanel" aria-labelledby="tab-today">
			<div class="today-workspace">
				{#each [-1, 0, 1] as offset (offset)}
					{@const day = addDays(today, offset)}
					{@render dayEditor(day, relativeDay(day, today))}
				{/each}
			</div>
		</div>
	{/if}
	{#if section === 'layout'}
		<LayoutManager
			layout={calendarData.layout}
			measures={measures.definitions}
			onsettings={(id, patch) => save('layout', setWidgetSettings(calendarData.layout, id, patch))}
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
		<SettingsPanel
			{today}
			{readExport}
			{previewImport}
			{importBackup}
			timelineColor={calendarData.timelineColor}
			onTimelineColor={(color) => save('timelineColor', color)}
		/>
	{/if}
</main>
