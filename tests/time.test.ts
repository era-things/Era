import { test, expect } from 'bun:test';
import { TIME_IDS, normalizeTime, validTime } from '../src/lib/time';
import { attachWidget, isAttached, setWidgetValue } from '../src/lib/widgets';
import { changes, emptyCalendar } from '../src/lib/calendar-records';
import { openCalendar } from '../src/lib/server/database';

test('daily durations accept whole minutes from zero through 24 hours', () => {
	for (const value of [0, 1, 59, 60, 1439, 1440]) expect(validTime(value)).toBe(true);
	for (const value of [-1, 1441, 0.5, NaN, Infinity, '60', undefined, null])
		expect(validTime(value)).toBe(false);
	expect(
		normalizeTime({
			'2026-11-17': { phone: 0, gym: null, reading: 1440, movie: 1.5, steam: -1, extra: 4 },
			'2026-02-30': { phone: 60 }
		})
	).toEqual({ '2026-11-17': { phone: 0, gym: null, reading: 1440 } });
});

test('all activities store independently, preserve cleared attachments, and survive storage', () => {
	const store = openCalendar(':memory:');
	try {
		const initial = emptyCalendar();
		let next = initial;
		for (const [index, id] of TIME_IDS.entries()) {
			next = attachWidget(next, '2026-11-17', id);
			expect(next.time['2026-11-17'][id]).toBe(0);
			next = setWidgetValue(next, '2026-11-17', id, (index + 1) * 65);
		}
		next = setWidgetValue(next, '2026-11-18', 'phone', 1440);
		next = setWidgetValue(next, '2026-11-17', 'gym', null);
		expect(isAttached(next, '2026-11-17', 'gym')).toBe(true);
		expect(isAttached(next, '2026-11-18', 'gym')).toBe(false);
		store.apply(changes(initial, next));
		expect(store.read()).toEqual(next);
		const invalid = structuredClone(next);
		invalid.time['2026-11-17'].phone = 1441;
		expect(() => store.apply(changes(next, invalid))).toThrow('Invalid calendar data');
		expect(store.read()).toEqual(next);
		expect(setWidgetValue(next, '2026-11-17', 'phone', 0.5)).toBe(next);
	} finally {
		store.db.close();
	}
});

test('concurrent edits to different daily activities merge without overwriting', () => {
	const store = openCalendar(':memory:');
	try {
		const initial = emptyCalendar();
		store.apply(changes(initial, setWidgetValue(initial, '2026-11-17', 'phone', 120)));
		store.apply(changes(initial, setWidgetValue(initial, '2026-11-17', 'steam', 90)));
		expect(store.read().time['2026-11-17']).toEqual({ phone: 120, steam: 90 });
	} finally {
		store.db.close();
	}
});
