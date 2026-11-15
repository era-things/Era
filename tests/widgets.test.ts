import { test, expect } from 'bun:test';
import {
	WIDGETS,
	attachWidget,
	dayWidget,
	emptyLayout,
	isAttached,
	isVisible,
	setWidgetSettings,
	setWidgetValue,
	validWidgetSkin
} from '../src/lib/widgets';
import { normalizeLayout } from '../src/lib/layout';
import { emptyCalendar, changes } from '../src/lib/calendar-records';
import { openCalendar, validate, Conflict } from '../src/lib/server/database';
const day = '2026-11-15';

test('all widgets use the same pinned, attached and visible lifecycle', () => {
	let data = emptyCalendar();
	for (const widget of WIDGETS) {
		expect(isVisible(data, day, widget.id)).toBe(widget.pinned);
		expect(isAttached(data, day, widget.id)).toBe(false);
		data = { ...data, layout: setWidgetSettings(data.layout, widget.id, { pinned: false }) };
		expect(isVisible(data, day, widget.id)).toBe(false);
		data = attachWidget(data, day, widget.id);
		expect(isVisible(data, day, widget.id)).toBe(true);
		expect(dayWidget(data, day, widget.id).value).toEqual(widget.initial);
		expect(isAttached(data, '2026-11-16', widget.id)).toBe(false);
	}
	expect(data.counters[day]).toEqual({ weight: null, steps: 0 });
	expect(data.notes[day]).toBe('');
	expect(data.nutrition[day]).toEqual([]);
});

test('clearing values keeps attachment and preserves other dates and widget data', () => {
	let data = setWidgetValue(emptyCalendar(), day, 'weight', 72.65);
	data = setWidgetValue(data, day, 'steps', 8200);
	data = setWidgetValue(data, '2026-11-16', 'weight', 73);
	const cleared = setWidgetValue(data, day, 'weight', null);
	expect(cleared.counters).toEqual({
		[day]: { weight: null, steps: 8200 },
		'2026-11-16': { weight: 73 }
	});
	expect(data.counters[day].weight).toBe(72.65);
	expect(setWidgetValue(data, day, 'steps', 1.5)).toBe(data);
});

test('settings, daily values and different widgets merge independently; stale settings roll back', () => {
	const store = openCalendar(':memory:');
	try {
		const initial = emptyCalendar();
		store.apply(
			changes(initial, {
				...initial,
				layout: setWidgetSettings(initial.layout, 'weight', { skin: 'display' })
			})
		);
		store.apply(
			changes(initial, {
				...initial,
				layout: setWidgetSettings(initial.layout, 'weight', { pinned: true })
			})
		);
		store.apply(
			changes(initial, {
				...initial,
				layout: setWidgetSettings(initial.layout, 'steps', { skin: 'pedometer' })
			})
		);
		store.apply(changes(initial, setWidgetValue(initial, day, 'weight', 72.65)));
		store.apply(changes(initial, setWidgetValue(initial, day, 'steps', 0)));
		const before = store.read();
		expect(before.layout.widgets.weight).toEqual({ skin: 'display', pinned: true });
		expect(before.layout.widgets.steps.skin).toBe('pedometer');
		store.apply(
			changes(before, {
				...before,
				layout: setWidgetSettings(before.layout, 'weight', { pinned: false })
			})
		);
		expect(store.read().counters[day]).toEqual({ weight: 72.65, steps: 0 });
		expect(() =>
			store.apply(
				changes(initial, {
					...initial,
					notes: { [day]: 'rollback' },
					layout: setWidgetSettings(initial.layout, 'weight', { skin: 'simple' })
				})
			)
		).toThrow(Conflict);
		expect(store.read().notes).toEqual({});
	} finally {
		store.db.close();
	}
});

test('empty attachments round-trip through storage for every widget', () => {
	const store = openCalendar(':memory:');
	try {
		const initial = emptyCalendar();
		const next = WIDGETS.reduce((data, widget) => attachWidget(data, day, widget.id), initial);
		store.apply(changes(initial, next));
		expect(store.read()).toEqual(next);
	} finally {
		store.db.close();
	}
});

test('direct object validation rejects invalid settings, values, dates and unknown fields atomically', () => {
	expect(normalizeLayout(emptyLayout())).toEqual(emptyLayout());
	expect(validWidgetSkin('steps', 'scale')).toBe(false);
	for (const mutate of [
		(data: any) => {
			data.layout.widgets.steps.skin = 'scale';
		},
		(data: any) => {
			data.layout.widgets.weight.pinned = 'true';
		},
		(data: any) => {
			data.layout.widgets.unknown = { pinned: true, skin: 'simple' };
		},
		(data: any) => {
			data.counters[day] = { steps: 1.5 };
		},
		(data: any) => {
			data.counters[day] = { weight: Infinity };
		},
		(data: any) => {
			data.counters[day] = { weight: undefined };
		},
		(data: any) => {
			data.notes['2026-02-30'] = 'bad';
		},
		(data: any) => {
			data.notes[day] = '  Keep spaces  ';
			data.extra = true;
		}
	]) {
		const initial = emptyCalendar(),
			invalid = structuredClone(initial);
		mutate(invalid);
		expect(() => validate(invalid)).toThrow('Invalid calendar data');
	}
	const store = openCalendar(':memory:');
	try {
		const initial = emptyCalendar();
		const invalid = setWidgetValue(initial, day, 'steps', 1);
		invalid.counters[day].steps = 1.5;
		expect(() => store.apply(changes(initial, invalid))).toThrow('Invalid calendar data');
		expect(store.read()).toEqual(initial);
	} finally {
		store.db.close();
	}
});
