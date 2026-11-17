import type { DateKey } from './calendar';
import { isRecord, normalizeDays } from './validation';
import { TIME_WIDGETS, type TimeId } from './widgets';

// Whole minutes per local calendar day; null is a cleared, attached widget.
export type TimeDays = Record<DateKey, Partial<Record<TimeId, number | null>>>;

export function normalizeTime(value: unknown): TimeDays {
	return normalizeDays(value, (entry) => {
		if (!isRecord(entry)) return;
		const values = Object.fromEntries(
			TIME_WIDGETS.filter((widget) => widget.valid(entry[widget.id])).map(({ id }) => [
				id,
				entry[id]
			])
		);
		return Object.keys(values).length ? values : undefined;
	});
}
