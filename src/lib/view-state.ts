import { asDate, yearOf, type DateKey } from './calendar.ts';

export const VIEW_STORAGE_KEY = 'era:timeline-view:v4';
export type ViewMode = 'horizontal' | 'vertical';
export const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export interface TimelinePosition {
	day: DateKey;
	x: number;
	y: number;
}

export interface SavedView {
	version: 4;
	mode: ViewMode;
	zoom: ZoomLevel;
	firstYear: number;
	selected: DateKey;
	position: TimelinePosition;
}

/** Ignore obsolete or corrupt browser state instead of breaking the overview. */
export function parseSavedView(raw: string | null): SavedView | null {
	try {
		if (!raw) return null;
		const view = JSON.parse(raw);
		if (
			!view ||
			view.version !== 4 ||
			!['horizontal', 'vertical'].includes(view.mode) ||
			!ZOOM_LEVELS.includes(view.zoom) ||
			!Number.isInteger(view.firstYear) ||
			view.firstYear < 1901 ||
			view.firstYear > 2091
		)
			return null;
		for (const day of [view.selected, view.position?.day]) {
			if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
			if (asDate(day).toISOString().slice(0, 10) !== day) return null;
			if (yearOf(day) < view.firstYear || yearOf(day) > view.firstYear + 9) return null;
		}
		if (
			![view.position.x, view.position.y].every(
				(value) => typeof value === 'number' && Number.isFinite(value)
			)
		)
			return null;
		return view;
	} catch {
		return null;
	}
}
