import { isDateKey, type DateKey } from './calendar.ts';

export const DAY_NOTES_STORAGE_KEY = 'era:day-notes';
export type DayNotes = Record<DateKey, string>;

export function parseDayNotes(raw: string | null): DayNotes {
	try {
		const saved = JSON.parse(raw ?? 'null');
		if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
		return Object.fromEntries(
			Object.entries(saved).filter(
				([day, text]) => isDateKey(day) && typeof text === 'string' && text !== ''
			)
		) as DayNotes;
	} catch {
		return {};
	}
}

export function setDayNote(notes: DayNotes, day: DateKey, text: string): DayNotes {
	const next = { ...notes };
	if (text) next[day] = text;
	else delete next[day];
	return next;
}
