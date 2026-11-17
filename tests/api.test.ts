import { test, expect } from 'bun:test';
import { handleApi } from '../src/lib/server/api';
import { openCalendar } from '../src/lib/server/database';
import { emptyCalendar } from '../src/lib/calendar-records';
import { apiRequests } from '../src/lib/api-client';
import { setWidgetValue, setWidgetSettings } from '../src/lib/widgets';
import { createReminder } from '../src/lib/reminders';

function client() {
	const store = openCalendar(':memory:');
	const call = (
		path: string,
		method = 'GET',
		body?: unknown,
		headers: Record<string, string> = {}
	) =>
		handleApi(
			new Request(`http://era.test/api/${path}`, {
				method,
				...(body === undefined
					? {}
					: {
							body: JSON.stringify(body),
							headers: { 'content-type': 'application/json', ...headers }
						})
			}),
			path,
			store
		);
	return { store, call };
}

test('discover widgets and update a single daily value without versions; PUT and DELETE can be retried', async () => {
	const { store, call } = client();
	try {
		const list = await (await call('widgets')).json();
		expect(list.widgets.find((w: any) => w.id === 'reading').fields[0].name).toBe(
			'durationMinutes'
		);
		const path = 'days/2026-11-17/widgets/reading';
		for (let i = 0; i < 2; i++)
			expect((await call(path, 'PUT', { durationMinutes: 45 })).status).toBe(200);
		expect(store.read().time['2026-11-17']).toEqual({ reading: 45 });
		expect((await (await call(path)).json()).value).toEqual({ durationMinutes: 45 });
		expect(
			(await (await call('days/2026-11-17')).json()).widgets.some((w: any) => w.id === 'reading')
		).toBe(true);
		await call(path, 'PUT', { durationMinutes: null });
		expect((await (await call(path)).json()).attached).toBe(true);
		for (let i = 0; i < 2; i++) expect((await call(path, 'DELETE')).status).toBe(204);
		expect((await (await call(path)).json()).attached).toBe(false);
	} finally {
		store.db.close();
	}
});

test('API writes use ordinary fields, reject malformed values, and return structured errors', async () => {
	const { store, call } = client();
	try {
		for (const [path, body, field] of [
			['days/2026-02-30/widgets/reading', { durationMinutes: 1 }, 'date'],
			['days/2026-11-17/widgets/reading', { durationMinutes: 1441 }, 'durationMinutes'],
			['days/2026-11-17/widgets/reading', { durationMinutes: 0.5 }, 'durationMinutes'],
			['days/2026-11-17/widgets/reading', { durationMinutes: 1, before: null }, 'before'],
			['days/2026-11-17/widgets/steps', { value: 1.5 }, 'value'],
			['days/2026-11-17/widgets/note', { text: false }, 'text'],
			['days/2026-11-17/emoji', { emoji: 'hello' }, 'emoji']
		] as const) {
			const response = await call(path, 'PUT', body);
			expect(response.status).toBe(400);
			const error = (await response.json()).error;
			expect(error.field).toBe(field);
			expect(typeof error.code).toBe('string');
			expect(typeof error.message).toBe('string');
		}
		expect(store.read()).toEqual(emptyCalendar());
		expect((await call('days/2026-11-17/widgets/missing', 'PUT', { value: 1 })).status).toBe(404);
		expect((await call('data', 'PUT', {})).status).toBe(405);
		const badJson = await handleApi(
			new Request('http://era.test/api/measures', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{'
			}),
			'measures',
			store
		);
		expect(badJson.status).toBe(400);
		expect((await badJson.json()).error.code).toBe('invalid_json');
		expect(
			(
				await call(
					'days/2026-11-17/widgets/reading',
					'PUT',
					{ durationMinutes: 1440 },
					{ 'content-type': 'application/json; charset=utf-8' }
				)
			).status
		).toBe(200);
	} finally {
		store.db.close();
	}
});

test('sleep infers an omitted field, checks consistency, and returns clock strings', async () => {
	const { store, call } = client();
	try {
		const path = 'days/2026-11-17/widgets/sleep';
		const response = await call(path, 'PUT', { startTime: '23:15', wakeUpTime: '06:45' });
		expect(response.status).toBe(200);
		expect((await response.json()).value).toEqual({
			startTime: '23:15',
			wakeUpTime: '06:45',
			durationMinutes: 450
		});
		expect((await call(path, 'PUT', { startTime: '23:15', durationMinutes: 450 })).status).toBe(
			200
		);
		expect((await call(path, 'PUT', { wakeUpTime: '06:45', durationMinutes: 450 })).status).toBe(
			200
		);
		expect(
			(await call(path, 'PUT', { startTime: '23:15', wakeUpTime: '06:45', durationMinutes: 10 }))
				.status
		).toBe(400);
		expect(store.read().sleep['2026-11-17']).toEqual({ start: 1395, end: 405, duration: 450 });
		expect((await call(path, 'PUT', { startTime: '24:00' })).status).toBe(400);
	} finally {
		store.db.close();
	}
});

test('catalog state is enforced on new attachments and preserves existing entries', async () => {
	const { store, call } = client();
	try {
		await call('days/2026-11-17/widgets/weight', 'PUT', { value: 72.5 });
		await call('widgets/weight', 'PATCH', { pinned: true, skin: 'display' });
		const response = await call('widgets/weight', 'PATCH', { archived: true });
		expect((await response.json()).settings).toEqual({
			archived: true,
			pinned: false,
			skin: 'display'
		});
		expect((await call('days/2026-11-18/widgets/weight', 'PUT', { value: 73 })).status).toBe(409);
		expect((await call('widgets/weight', 'PATCH', { pinned: true })).status).toBe(409);
		expect((await call('days/2026-11-17/widgets/weight', 'PUT', { value: 73 })).status).toBe(200);
		await call('widgets/weight', 'PATCH', { archived: false });
		expect((await call('days/2026-11-18/widgets/weight', 'PUT', { value: 73 })).status).toBe(200);
	} finally {
		store.db.close();
	}
});

test('create and update custom measures, use daily values, and delete without orphaned records', async () => {
	const { store, call } = client();
	try {
		const payload = { id: 'water', name: 'Water', type: 'uint', palette: 'blue' };
		expect((await call('measures', 'POST', payload)).status).toBe(201);
		expect((await call('measures', 'POST', payload)).status).toBe(200);
		expect((await call('measures', 'POST', { ...payload, name: 'Changed' })).status).toBe(409);
		expect((await call('measures', 'POST', { ...payload, id: 'other' })).status).toBe(409);
		await call('days/2026-11-17/measures/water', 'PUT', { value: 4 });
		expect((await (await call('days/2026-11-17/measures/water')).json()).value).toBe(4);
		expect((await call('days/2026-11-17/measures/water', 'PUT', { value: -1 })).status).toBe(400);
		await call('measures/water', 'PATCH', { name: 'Glasses of water', palette: 'teal' });
		expect((await call('measures/water', 'PATCH', { type: 'boolean' })).status).toBe(400);
		expect((await call('days/2026-11-17/measures/water', 'DELETE')).status).toBe(204);
		await call('days/2026-11-17/measures/water', 'PUT', { value: null });
		expect((await (await call('days/2026-11-17/measures/water')).json()).attached).toBe(true);
		expect((await call('measures/water', 'DELETE')).status).toBe(204);
		expect((await call('measures/water', 'DELETE')).status).toBe(204);
		expect(store.read().measures).toEqual({ definitions: [], days: {} });
		expect((await call('days/2026-11-17/measures/water')).status).toBe(404);
	} finally {
		store.db.close();
	}
});

test('UI semantic requests reproduce all app data and can be retried safely', async () => {
	const { store, call } = client();
	try {
		const initial = emptyCalendar();
		let next = setWidgetValue(initial, '2026-11-17', 'phone', 90);
		next = setWidgetValue(next, '2026-11-17', 'note', 'A note\nwith two lines');
		next = setWidgetValue(next, '2026-11-17', 'nutrition', [
			{ id: 'oats', name: 'Oats', quantity: 2, kcal: 300, protein: 10, fat: 5, carbs: 50 }
		]);
		next = setWidgetValue(next, '2026-11-17', 'weight', null);
		next = setWidgetValue(next, '2026-11-17', 'sleep', { start: 1380, end: 390, duration: 450 });
		next.layout = setWidgetSettings(next.layout, 'steps', { skin: 'pedometer', pinned: true });
		next.emojis = { '2026-11-17': '⭐' };
		next.measures = {
			definitions: [{ id: 'read', name: 'Read', type: 'boolean', palette: 'green' }],
			days: { '2026-11-17': { read: false } }
		};
		next.reminders = [createReminder('Walk', '2026-11-17')];
		for (let pass = 0; pass < 2; pass++)
			for (const edit of apiRequests(initial, next)) {
				const response = await call(edit.url.slice('/api/'.length), edit.method, edit.body);
				expect(response.ok, `${edit.url}: ${await response.text()}`).toBe(true);
			}
		expect(store.read()).toEqual(next);
		for (const edit of apiRequests(next, initial))
			expect((await call(edit.url.slice(5), edit.method, edit.body)).ok).toBe(true);
		expect(store.read()).toEqual(initial);
	} finally {
		store.db.close();
	}
});
