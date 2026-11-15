import type { DateKey } from './calendar.ts';
import { normalizeDays } from './validation';

export type DayNotes = Record<DateKey, string>;

export const normalizeDayNotes = (value: unknown): DayNotes =>
	normalizeDays(value, (text) => (typeof text === 'string' ? text : undefined));

export function setDayNote(notes: DayNotes, day: DateKey, text: string): DayNotes {
	return { ...notes, [day]: text };
}
