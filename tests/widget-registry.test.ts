import { test, expect } from 'bun:test';
import { WIDGETS } from '../src/lib/widgets';
import { handleApi } from '../src/lib/server/api';
import { openCalendar } from '../src/lib/server/database';
import { widgetBody } from '../src/lib/api-values';
import { decode } from '../src/lib/calendar-records';
import { changeDurationPart, formatDurationPart } from '../src/lib/duration';

test('every registered widget has valid defaults and a sample that round-trips through its API kind', async () => {
	const store = openCalendar(':memory:');
	try {
		for (const widget of WIDGETS) {
			expect(widget.valid(widget.initial)).toBe(true);
			expect(widget.valid(widget.sample)).toBe(true);
			const body = widgetBody(widget.id, widget.sample);
			expect(Object.keys(body)).toEqual(widget.fields.map((field) => field.name));
			const path = `days/2026-11-17/widgets/${widget.id}`;
			const response = await handleApi(
				new Request(`http://era.test/api/${path}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				}),
				path,
				store
			);
			expect(response.status, widget.id).toBe(200);
			expect((await response.json()).value).toEqual(body);
		}
	} finally {
		store.db.close();
	}
});

test('unknown record kinds are rejected by the decoder registry', () => {
	for (const kind of ['unknown', '__proto__', 'constructor'])
		expect(() => decode([{ key: JSON.stringify([kind, '2026-11-17']), value: '0' }])).toThrow(
			'Unknown record type'
		);
});

test('duration parts preserve the other unit and format empty and zero values', () => {
	expect(changeDurationPart(450, 'hours', 8)).toBe(510);
	expect(changeDurationPart(450, 'minutes', 5)).toBe(425);
	expect(changeDurationPart(null, 'minutes', 15)).toBe(15);
	expect(changeDurationPart(450, 'hours', null)).toBeNull();
	expect(formatDurationPart(null, 'hours')).toBe('');
	expect(formatDurationPart(0, 'minutes')).toBe('00');
	expect(formatDurationPart(425, 'minutes')).toBe('05');
	expect(formatDurationPart(425, 'hours')).toBe('7');
});
