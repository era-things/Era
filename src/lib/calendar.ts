/** Calendar dates are ISO date-only strings. UTC arithmetic avoids DST-sized days. */
export type DateKey = string;

export interface CalendarDay {
	key: DateKey;
	dayOfYear: number;
}

const DAY_MS = 86_400_000;
const fullDate = new Intl.DateTimeFormat('en-US', {
	weekday: 'long',
	year: 'numeric',
	month: 'long',
	day: 'numeric',
	timeZone: 'UTC'
});

export function localToday(now = new Date()): DateKey {
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function asDate(key: DateKey): Date {
	return new Date(`${key}T00:00:00Z`);
}

export function isDateKey(value: unknown): value is DateKey {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01')
		return false;
	const date = asDate(value);
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function yearOf(key: DateKey): number {
	return Number(key.slice(0, 4));
}

export function daysBetween(from: DateKey, to: DateKey): number {
	return Math.round((asDate(to).getTime() - asDate(from).getTime()) / DAY_MS);
}

export function addDays(key: DateKey, amount: number): DateKey {
	const date = asDate(key);
	date.setUTCDate(date.getUTCDate() + amount);
	return date.toISOString().slice(0, 10);
}

export function daysInYear(year: number): CalendarDay[] {
	const first = `${year}-01-01`;
	const count = daysBetween(first, `${year + 1}-01-01`);
	return Array.from({ length: count }, (_, index) => ({
		key: addDays(first, index),
		dayOfYear: index + 1
	}));
}

/** Monday = 0; used to align each year to seven-day columns. */
export function weekdayOffset(key: DateKey): number {
	return (asDate(key).getUTCDay() + 6) % 7;
}

export function daysInRange(firstYear: number, lastYear: number): CalendarDay[] {
	return Array.from({ length: lastYear - firstYear + 1 }, (_, index) =>
		daysInYear(firstYear + index)
	).flat();
}

export function formatDate(key: DateKey): string {
	return fullDate.format(asDate(key));
}

export function relativeDay(key: DateKey, today: DateKey): string {
	const distance = daysBetween(today, key);
	if (distance === 0) return 'Today';
	if (distance === -1) return 'Yesterday';
	if (distance === 1) return 'Tomorrow';
	const count = Math.abs(distance).toLocaleString('en-US');
	return distance < 0 ? `${count} days ago` : `In ${count} days`;
}
