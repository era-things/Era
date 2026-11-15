import { isDateKey, type DateKey } from './calendar.ts';

export const COUNTERS = [
	{ id: 'weight', name: 'Weight', unit: 'kg', integer: false },
	{ id: 'steps', name: 'Steps', unit: '', integer: true }
] as const;
export type CounterId = (typeof COUNTERS)[number]['id'];
export type Counter = (typeof COUNTERS)[number];
export type CountersState = {
	pinned: Record<CounterId, boolean>;
	days: Record<DateKey, Partial<Record<CounterId, number | null>>>;
};
export const emptyCounters = (): CountersState => ({
	pinned: { weight: false, steps: false },
	days: {}
});

export function validCounterValue(id: CounterId, value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		value >= 0 &&
		value <= Number.MAX_SAFE_INTEGER &&
		(id !== 'steps' || Number.isSafeInteger(value))
	);
}

export function setCounterValue(
	state: CountersState,
	day: DateKey,
	id: CounterId,
	value: number | null
): CountersState {
	if (!isDateKey(day) || (value !== null && !validCounterValue(id, value))) return state;
	const values = { ...state.days[day] };
	values[id] = value;
	const days = { ...state.days };
	days[day] = values;
	return { ...state, days };
}

export function parseCounters(raw: string | null): CountersState {
	try {
		const saved = JSON.parse(raw ?? 'null');
		if (
			!saved ||
			!COUNTERS.every(({ id }) => typeof saved.pinned?.[id] === 'boolean') ||
			!saved.days ||
			typeof saved.days !== 'object' ||
			Array.isArray(saved.days)
		)
			return emptyCounters();
		const result = emptyCounters();
		for (const { id } of COUNTERS) result.pinned[id] = saved.pinned[id];
		for (const [day, values] of Object.entries(saved.days)) {
			if (!isDateKey(day) || !values || typeof values !== 'object' || Array.isArray(values))
				continue;
			for (const { id } of COUNTERS) {
				const value = (values as Record<string, unknown>)[id];
				if (value === null || validCounterValue(id, value)) (result.days[day] ??= {})[id] = value;
			}
		}
		return result;
	} catch {
		return emptyCounters();
	}
}
