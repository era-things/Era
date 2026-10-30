import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSavedView } from '../src/lib/view-state.ts';

const view = {
	version: 3,
	mode: 'vertical',
	zoom: 100,
	firstYear: 2021,
	selected: '2024-02-29',
	scrollTop: 612,
	scrollLeft: 250
};

test('restores the range, selection and both scroll axes', () => {
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
		{ scrollTop: -1 },
		{ scrollLeft: '20' }
	])
		assert.equal(parseSavedView(JSON.stringify({ ...view, ...patch })), null);
});

test('restores zoom and defaults older saved views to 100%', () => {
	assert.equal(parseSavedView(JSON.stringify({ ...view, zoom: 200 }))?.zoom, 200);
	const { zoom: _, ...olderView } = view;
	assert.equal(parseSavedView(JSON.stringify(olderView))?.zoom, 100);
});
