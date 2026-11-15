import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSavedView } from '../src/lib/view-state.ts';

const view = {
	version: 4,
	mode: 'vertical',
	zoom: 100,
	firstYear: 2021,
	selected: '2024-02-29',
	position: { day: '2026-11-15', x: -12, y: -8 }
};

test('restores the range, selection and date anchor', () => {
	assert.deepEqual(parseSavedView(JSON.stringify(view)), view);
	const horizontal = { ...view, mode: 'horizontal' };
	assert.deepEqual(parseSavedView(JSON.stringify(horizontal)), horizontal);
});

test('ignores invalid, obsolete and out-of-range saved views', () => {
	for (const value of [null, '', '{', 'null', '[]']) assert.equal(parseSavedView(value), null);
	for (const patch of [
		{ version: 0 },
		{ mode: 'unknown' },
		{ zoom: 25 },
		{ zoom: 300 },
		{ zoom: '100' },
		{ firstYear: 1800 },
		{ firstYear: 2021.5 },
		{ selected: '2023-02-29' },
		{ selected: '2031-01-01' },
		{ selected: 'not a date' },
		{ position: null },
		{ position: { day: '2031-01-01', x: 0, y: 0 } },
		{ position: { day: '2023-02-29', x: 0, y: 0 } },
		{ position: { day: '2026-11-15', x: '20', y: 0 } }
	])
		assert.equal(parseSavedView(JSON.stringify({ ...view, ...patch })), null);
});

test('requires a valid zoom level', () => {
	assert.equal(parseSavedView(JSON.stringify({ ...view, zoom: 200 }))?.zoom, 200);
	const { zoom: _, ...olderView } = view;
	assert.equal(parseSavedView(JSON.stringify(olderView)), null);
});
