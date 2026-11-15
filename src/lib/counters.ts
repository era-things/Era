import { normalizeDays, isRecord } from './validation';
import { COUNTERS, validCounterValue, type CounterId } from './widgets';
import type { DateKey } from './calendar';

export type CounterDays = Record<DateKey, Partial<Record<CounterId, number | null>>>;
export function normalizeCounters(value: unknown): CounterDays {
	return normalizeDays(value, (entry) => {
		if (!isRecord(entry)) return;
		const values = Object.fromEntries(
			COUNTERS.map(({ id }) => id)
				.filter((id) => entry[id] === null || validCounterValue(id, entry[id]))
				.map((id) => [id, entry[id]])
		);
		return Object.keys(values).length ? (values as CounterDays[string]) : undefined;
	});
}
