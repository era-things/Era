import { test, expect } from 'bun:test';
import {
	changeSleep,
	emptySleep,
	formatSleepTime,
	parseSleepTime,
	validSleep
} from '../src/lib/sleep';
import { emptyCalendar, changes } from '../src/lib/calendar-records';
import { attachWidget, setWidgetValue } from '../src/lib/widgets';
import { openCalendar } from '../src/lib/server/database';

test('new sleep records default to 7 hours 30 minutes and infer either endpoint', () => {
	expect(emptySleep()).toEqual({ start: null, end: null, duration: 450 });
	expect(changeSleep(emptySleep(), 'start', 1395)).toEqual({
		start: 1395,
		end: 405,
		duration: 450
	});
	expect(changeSleep(emptySleep(), 'end', 420)).toEqual({ start: 1410, end: 420, duration: 450 });
});

test('endpoint edits recalculate overnight duration; duration edits keep start fixed', () => {
	let sleep = changeSleep(emptySleep(), 'start', 1395);
	sleep = changeSleep(sleep, 'end', 420);
	expect(sleep).toEqual({ start: 1395, end: 420, duration: 465 });
	sleep = changeSleep(sleep, 'start', 1350);
	expect(sleep.duration).toBe(510);
	sleep = changeSleep(sleep, 'end', 450);
	expect(sleep.duration).toBe(540);
	sleep = changeSleep(sleep, 'duration', 480);
	expect(sleep).toEqual({ start: 1350, end: 390, duration: 480 });
	expect(changeSleep(sleep, 'end', 1350).duration).toBe(0);
	expect(changeSleep({ start: 600, end: 660, duration: 60 }, 'end', 690).duration).toBe(90);
});

test('duration can be entered first and paired with either endpoint; clearing retains useful values', () => {
	const duration = changeSleep(emptySleep(), 'duration', 480);
	expect(changeSleep(duration, 'start', 1380)).toEqual({ start: 1380, end: 420, duration: 480 });
	expect(changeSleep(duration, 'end', 420)).toEqual({ start: 1380, end: 420, duration: 480 });
	const full = { start: 1380, end: 420, duration: 480 };
	expect(changeSleep(full, 'start', null)).toEqual({ start: null, end: 420, duration: null });
	expect(changeSleep(full, 'end', null)).toEqual({ start: 1380, end: null, duration: null });
	expect(changeSleep(full, 'duration', null)).toEqual({ start: 1380, end: null, duration: null });
});

test('24-hour parsing and validation reject invalid or inconsistent intervals', () => {
	expect(formatSleepTime(0)).toBe('00:00');
	expect(formatSleepTime(1439)).toBe('23:59');
	expect(parseSleepTime('7:05')).toBe(425);
	expect(parseSleepTime('705')).toBe(425);
	expect(parseSleepTime('0705')).toBe(425);
	expect(parseSleepTime('0000')).toBe(0);
	expect(parseSleepTime('2359')).toBe(1439);
	for (const value of ['24:00', '12:60', '7:5', '11:15 PM', '', '-1:00', '2400', '1260', '12345'])
		expect(parseSleepTime(value)).toBeNull();
	for (const value of [
		{ start: 0, end: 60, duration: 120 },
		{ start: 0, end: 60, duration: null },
		{ start: 1440, end: null, duration: null },
		{ start: 0.5, end: null, duration: null },
		{ start: null, end: null, duration: -1 },
		{ start: null, end: null, duration: 1440 },
		{ ...emptySleep(), extra: true }
	])
		expect(validSleep(value)).toBe(false);
	expect(validSleep(emptySleep())).toBe(true);
});

test('sleep persists per day and invalid writes roll back atomically', () => {
	const store = openCalendar(':memory:');
	try {
		const initial = emptyCalendar();
		let data = attachWidget(initial, '2026-11-15', 'sleep');
		data = setWidgetValue(data, '2026-11-16', 'sleep', { start: 1395, end: 420, duration: 465 });
		store.apply(changes(initial, data));
		expect(store.read()).toEqual(data);
		const invalid = structuredClone(data);
		invalid.sleep['2026-11-16'].duration = 999;
		expect(() => store.apply(changes(data, invalid))).toThrow('Invalid calendar data');
		expect(store.read()).toEqual(data);
		expect(setWidgetValue(data, '2026-11-16', 'sleep', invalid.sleep['2026-11-16'])).toBe(data);
	} finally {
		store.db.close();
	}
});
