import { isDateKey, type DateKey } from './calendar';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value);
export function normalizeDays<T>(
	value: unknown,
	normalize: (value: unknown) => T | undefined
): Record<DateKey, T> {
	const days: Record<DateKey, T> = {};
	if (isRecord(value))
		for (const [day, entry] of Object.entries(value)) {
			if (!isDateKey(day)) continue;
			const result = normalize(entry);
			if (result !== undefined) days[day] = result;
		}
	return days;
}
