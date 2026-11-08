import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDayNotes, setDayNote } from '../src/lib/day-notes.ts';

test('notes preserve text and independent days; clearing removes the entry', () => {
	const text = '  First line\n\nSecond line  ';
	const first = setDayNote({}, '2026-11-06', text);
	const second = setDayNote(first, '2026-11-07', 'Tomorrow');
	assert.deepEqual(parseDayNotes(JSON.stringify(second)), second);
	assert.deepEqual(setDayNote(second, '2026-11-06', ''), { '2026-11-07': 'Tomorrow' });
	assert.deepEqual(first, { '2026-11-06': text });
});

test('note storage ignores malformed data, invalid dates and non-text values', () => {
	for (const raw of [null, '{', '[]', 'null', '1']) assert.deepEqual(parseDayNotes(raw), {});
	assert.deepEqual(
		parseDayNotes(
			JSON.stringify({
				'2026-02-30': 'Invalid',
				'2026-11-06': 12,
				'2026-11-07': '',
				'2026-11-08': '  '
			})
		),
		{ '2026-11-08': '  ' }
	);
});
