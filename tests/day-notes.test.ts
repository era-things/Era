import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDayNotes, setDayNote } from '../src/lib/day-notes.ts';
import { setWidgetSettings } from '../src/lib/widgets';
import { openCalendar } from '../src/lib/server/database';
import { changes, emptyCalendar } from '../src/lib/calendar-records';

test('notes preserve text and independent days; clearing keeps the widget attached', () => {
	const text = '  First line\n\nSecond line  ';
	const first = setDayNote({}, '2026-11-06', text);
	const second = setDayNote(first, '2026-11-07', 'Tomorrow');
	assert.deepEqual(normalizeDayNotes(second), second);
	assert.deepEqual(setDayNote(second, '2026-11-06', ''), {
		'2026-11-06': '',
		'2026-11-07': 'Tomorrow'
	});
	assert.deepEqual(first, { '2026-11-06': text });
});

test('note storage ignores malformed data, invalid dates and non-text values', () => {
	for (const raw of [null, '{', '[]', 'null', '1']) assert.deepEqual(normalizeDayNotes(raw), {});
	assert.deepEqual(
		normalizeDayNotes({
			'2026-02-30': 'Invalid',
			'2026-11-06': 12,
			'2026-11-07': '',
			'2026-11-08': '  '
		}),
		{ '2026-11-07': '', '2026-11-08': '  ' }
	);
});

test('Note pin settings merge independently of empty attached notes', () => {
	const store = openCalendar(':memory:');
	try {
		const initial = emptyCalendar();
		store.apply(
			changes(initial, {
				...initial,
				layout: setWidgetSettings(initial.layout, 'note', { pinned: false })
			})
		);
		store.apply(changes(initial, { ...initial, notes: setDayNote({}, '2026-11-15', '') }));
		assert.equal(store.read().layout.widgets.note.pinned, false);
		assert.deepEqual(store.read().notes, { '2026-11-15': '' });
		const before = store.read();
		store.apply(
			changes(before, {
				...before,
				layout: setWidgetSettings(before.layout, 'note', { pinned: true })
			})
		);
		assert.equal(store.read().layout.widgets.note.pinned, true);
		assert.deepEqual(store.read().notes, { '2026-11-15': '' });
	} finally {
		store.db.close();
	}
});
