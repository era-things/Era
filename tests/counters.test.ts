import { test, expect } from 'bun:test';
import {
	emptyCounters,
	parseCounters,
	setCounterValue,
	validCounterValue
} from '../src/lib/counters';
import { changes, emptyCalendar } from '../src/lib/calendar-records';
import { openCalendar } from '../src/lib/server/database';

test('weight accepts decimals while steps require non-negative safe whole numbers', () => {
	for (const value of [-1, Infinity, NaN, '72', null, true, Number.MAX_SAFE_INTEGER + 1]) {
		expect(validCounterValue('weight', value)).toBe(false);
		expect(validCounterValue('steps', value)).toBe(false);
	}
	expect(validCounterValue('weight', 72.65)).toBe(true);
	expect(validCounterValue('steps', 72.65)).toBe(false);
	expect(validCounterValue('steps', 0)).toBe(true);
});

test('clearing a counter keeps its empty widget attached to the day', () => {
	const state = setCounterValue(
		setCounterValue(emptyCounters(), '2026-11-15', 'weight', 72.65),
		'2026-11-15',
		'steps',
		0
	);
	const cleared = setCounterValue(state, '2026-11-15', 'weight', null);
	expect(cleared.days).toEqual({ '2026-11-15': { weight: null, steps: 0 } });
	expect(setCounterValue(cleared, '2026-11-15', 'steps', null).days).toEqual({
		'2026-11-15': { weight: null, steps: null }
	});
	expect(state.days['2026-11-15']).toEqual({ weight: 72.65, steps: 0 });
});

test('counter parsing filters invalid dates and values', () => {
	expect(
		parseCounters(
			JSON.stringify({
				pinned: { weight: true, steps: false },
				days: {
					'2026-02-30': { weight: 72 },
					'2026-11-15': { weight: 72.65, steps: 1.5, unknown: 4 },
					'2026-11-16': { steps: 0 },
					'2026-11-17': { weight: -1 }
				}
			})
		)
	).toEqual({
		pinned: { weight: true, steps: false },
		days: { '2026-11-15': { weight: 72.65 }, '2026-11-16': { steps: 0 } }
	});
});

test('empty built-in widgets survive storage independently of their pin settings', () => {
	const store = openCalendar(':memory:');
	try {
		const before = emptyCalendar();
		const next = {
			...before,
			counters: setCounterValue(before.counters, '2026-11-15', 'weight', null),
			nutrition: { pinned: false, days: { '2026-11-15': [] } }
		};
		store.apply(changes(before, next));
		expect(store.read()).toEqual(next);
	} finally {
		store.db.close();
	}
});

test('counter records merge independently and unpinned widgets retain their daily values', () => {
	const store = openCalendar(':memory:');
	try {
		const initial = emptyCalendar();
		store.apply(
			changes(initial, {
				...initial,
				counters: setCounterValue(initial.counters, '2026-11-15', 'weight', 72.65)
			})
		);
		store.apply(
			changes(initial, {
				...initial,
				counters: setCounterValue(initial.counters, '2026-11-15', 'steps', 0)
			})
		);
		const before = store.read();
		store.apply(
			changes(before, {
				...before,
				counters: { ...before.counters, pinned: { weight: true, steps: true } }
			})
		);
		const pinned = store.read();
		store.apply(
			changes(pinned, {
				...pinned,
				counters: { ...pinned.counters, pinned: { weight: false, steps: false } }
			})
		);
		expect(store.read().counters).toEqual({
			pinned: { weight: false, steps: false },
			days: { '2026-11-15': { weight: 72.65, steps: 0 } }
		});
		const invalid = {
			...store.read(),
			counters: setCounterValue(initial.counters, '2026-11-15', 'steps', 1)
		};
		invalid.counters.days['2026-11-15'].steps = 1.5;
		expect(() => store.apply(changes(store.read(), invalid))).toThrow('Invalid calendar data');
		expect(store.read().counters.days['2026-11-15'].steps).toBe(0);
	} finally {
		store.db.close();
	}
});
