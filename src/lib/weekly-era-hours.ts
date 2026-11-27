import { addDays, daysBetween, weekdayOffset, type DateKey } from './calendar';
import type { Era, EraDays } from './eras';

export function weeklyEraHours(eras: Era[], days: EraDays, first: DateKey, last: DateKey) {
	const monday = addDays(first, -weekdayOffset(first));
	const weekCount = Math.floor(daysBetween(monday, last) / 7) + 1;
	const weeks = Array.from({ length: weekCount }, (_, index) => addDays(monday, index * 7));
	const series = eras
		.filter((era) => era.linkedValue === 'hours')
		.map((era) => ({ era, minutes: new Array<number>(weekCount).fill(0) }));
	const byId = new Map(series.map(({ era, minutes }) => [era.id, minutes]));
	const totals = new Array<number>(weekCount).fill(0);
	for (const [date, entries] of Object.entries(days)) {
		if (date < first || date > last) continue;
		const week = Math.floor(daysBetween(monday, date) / 7);
		for (const [id, entry] of Object.entries(entries)) {
			const minutes = byId.get(id);
			const duration = entry.values?.hours;
			if (!minutes || duration === undefined) continue;
			minutes[week] += duration;
			totals[week] += duration;
		}
	}
	return { weeks, series, totals };
}
