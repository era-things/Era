import type { DateKey } from './calendar';
import { isRecord, normalizeDays } from './validation';

export const TIME_IDS = ['phone', 'gym', 'reading', 'movie', 'steam'] as const;
export type TimeId = (typeof TIME_IDS)[number];
// Whole minutes per local calendar day; null is a cleared, attached widget.
export type TimeDays = Record<DateKey, Partial<Record<TimeId, number | null>>>;
export const isTimeId = (id: string): id is TimeId => TIME_IDS.some((item) => item === id);
export const isDayTimeWidget = (id: string) => id === 'sleep' || isTimeId(id);
export const validTime = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1440;

export function normalizeTime(value: unknown): TimeDays {
	return normalizeDays(value, (entry) => {
		if (!isRecord(entry)) return;
		const values = Object.fromEntries(
			TIME_IDS.filter((id) => entry[id] === null || validTime(entry[id])).map((id) => [
				id,
				entry[id]
			])
		);
		return Object.keys(values).length ? values : undefined;
	});
}
