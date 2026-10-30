import { asDate, yearOf, type DateKey } from './calendar.ts';

export const VIEW_STORAGE_KEY = 'era:timeline-view:v3';

export type ViewMode = 'horizontal' | 'vertical';

export const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export interface SavedView {
	version: 3;
	mode: ViewMode;
	zoom: ZoomLevel;
	firstYear: number;
	selected: DateKey;
	scrollTop: number;
	scrollLeft: number;
}

/** Ignore obsolete or corrupt browser state instead of breaking the overview. */
export function parseSavedView(raw: string | null): SavedView | null {
	try {
		if (!raw) return null;
		const view = JSON.parse(raw);
		if (
			!view ||
			view.version !== 3 ||
			!['horizontal', 'vertical'].includes(view.mode) ||
			!Number.isInteger(view.firstYear) ||
			view.firstYear < 1901 ||
			view.firstYear > 2091
		)
			return null;
		if (typeof view.selected !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(view.selected))
			return null;
		if (asDate(view.selected).toISOString().slice(0, 10) !== view.selected) return null;
		if (yearOf(view.selected) < view.firstYear || yearOf(view.selected) > view.firstYear + 9)
			return null;
		if (
			![view.scrollTop, view.scrollLeft].every(
				(value) => typeof value === 'number' && Number.isFinite(value) && value >= 0
			)
		)
			return null;
		const zoom = view.zoom === undefined ? 100 : view.zoom;
		if (!ZOOM_LEVELS.some((level) => level === zoom)) return null;
		return { ...view, zoom } as SavedView;
	} catch {
		return null;
	}
}
