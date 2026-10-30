import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	addDays,
	daysBetween,
	daysInYear,
	formatDate,
	localToday,
	daysInRange,
	relativeDay,
	weekdayOffset
} from '../src/lib/calendar.ts';

test('Gregorian leap years include February 29 only when appropriate', () => {
	for (const [year, count] of [
		[2024, 366],
		[2025, 365],
		[2000, 366],
		[2100, 365]
	]) {
		const days = daysInYear(year);
		assert.equal(days.length, count);
		assert.equal(days[0].key, `${year}-01-01`);
		assert.equal(days.at(-1)?.key, `${year}-12-31`);
		assert.equal(new Set(days.map((day) => day.key)).size, count);
	}
	assert.equal(daysInYear(2024)[59].key, '2024-02-29');
});

test('date arithmetic crosses month, year and daylight saving boundaries', () => {
	assert.equal(addDays('2024-02-28', 1), '2024-02-29');
	assert.equal(addDays('2025-12-31', 1), '2026-01-01');
	assert.equal(addDays('2026-01-01', -1), '2025-12-31');
	assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
	assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
});

test('week alignment starts on Monday', () => {
	assert.equal(weekdayOffset('2024-01-01'), 0);
	assert.equal(weekdayOffset('2023-01-01'), 6);
});

test('the timeline is continuous across leap days and year boundaries', () => {
	const days = daysInRange(2023, 2024);
	assert.equal(days.length, 731);
	assert.equal(days[0].key, '2023-01-01');
	assert.equal(days.at(-1)?.key, '2024-12-31');
	assert.equal(new Set(days.map((day) => day.key)).size, days.length);
	for (let index = 1; index < days.length; index++) {
		assert.equal(daysBetween(days[index - 1].key, days[index].key), 1);
	}
});

test('today uses local calendar parts and labels use date-only values', () => {
	assert.equal(localToday(new Date(2026, 9, 30, 23, 59)), '2026-10-30');
	assert.equal(formatDate('2026-10-30'), 'Friday, October 30, 2026');
	assert.equal(relativeDay('2026-10-30', '2026-10-30'), 'Today');
	assert.equal(relativeDay('2026-10-29', '2026-10-30'), 'Yesterday');
	assert.equal(relativeDay('2026-10-31', '2026-10-30'), 'Tomorrow');
	assert.equal(relativeDay('2026-11-02', '2026-10-30'), 'In 3 days');
});
