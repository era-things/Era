import { test, expect } from 'bun:test';
import { handleApi } from '../src/lib/server/api';
import { openCalendar } from '../src/lib/server/database';
import { changes, emptyCalendar } from '../src/lib/calendar-records';
import { serializeDataExport } from '../src/lib/data-export';
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
							body: JSON.stringify(body)
						}),
				headers: {
					...(body === undefined ? {} : { 'content-type': 'application/json' }),
					...headers
				}
			}),
			path,
			store
		);
	return { store, call };
}

test('import restores a complete Era backup into an empty calendar', async () => {
	const { store, call } = client();
	try {
		const day = '2026-11-17';
		const data = setWidgetValue(emptyCalendar(), day, 'phone', 180);
		data.automated[day] = { phone: 222, steps: null };
		data.layout = setWidgetSettings(data.layout, 'phone', { visibility: 'pinned' });
		data.emojis[day] = '🎉';
		data.notes[day] = 'First line\nSecond line';
		data.counters[day] = { steps: 0, weight: 72.5 };
		data.sleep[day] = { start: 1395, end: 420, duration: 465 };
		data.githubActivity[day] = {
			commits: 1, additions: 8, deletions: 2,
			repositories: [
				{
					name: 'era-things/Era',
					url: 'https://github.com/era-things/Era',
					commits: 1,
					additions: 8,
					deletions: 2
				}
			]
		};
		data.nutrition[day] = [
			{ id: 'lunch', name: 'Lunch', quantity: 1.25, kcal: 500, protein: 25.5, fat: 10, carbs: 60 }
		];
		data.measures = {
			definitions: [{ id: 'read', name: 'Read', type: 'boolean', palette: 'green' }],
			days: { [day]: { read: false } }
		};
		data.reminders = [{ ...createReminder('Walk', day), completedDates: [day] }];
		const backup = JSON.parse(serializeDataExport(data));
		const invalid = await call('data/import', 'POST', { ...backup, time: null });
		expect(invalid.status).toBe(400);
		expect(store.read()).toEqual(emptyCalendar());
		const imported = await call('data/import', 'POST', backup);
		expect(imported.status).toBe(200);
		expect(await imported.json()).toEqual(data);
		expect(store.read()).toEqual(data);
		const exported = await (await call('data')).json();
		expect(exported.automated).toEqual({ [day]: { phone: 222, steps: null } });
		const patch = {
			app: backup.app,
			exportedAt: backup.exportedAt,
			automated: { [day]: { steps: 8200 } },
			counters: { [day]: { weight: 73 } },
			time: { [day]: { gym: 60 }, '2026-11-18': { phone: 0 } }
		};
		const preview = await (await call('data/import/preview', 'POST', patch)).json();
		expect(preview).toEqual({ days: 2, overwrittenDays: 1, overwritesOtherData: false });
		expect(store.read()).toEqual(data);
		const changed = await call('data/import', 'POST', patch, {
			'x-era-import-preview': JSON.stringify({ ...preview, overwrittenDays: 0 })
		});
		expect(changed.status).toBe(409);
		expect((await changed.json()).preview).toEqual(preview);
		expect(store.read()).toEqual(data);
		const merged = await call('data/import', 'POST', patch, {
			'x-era-import-preview': JSON.stringify(preview)
		});
		expect(merged.status).toBe(200);
		expect(store.read()).toEqual({
			...data,
			automated: { [day]: { phone: 222, steps: 8200 } },
			counters: { [day]: { steps: 0, weight: 73 } },
			time: { [day]: { phone: 180, gym: 60 }, '2026-11-18': { phone: 0 } }
		});
		const layout = emptyCalendar().layout;
		const settings = { app: backup.app, exportedAt: backup.exportedAt, layout };
		expect(await (await call('data/import/preview', 'POST', settings)).json()).toEqual({
			days: 0,
			overwrittenDays: 0,
			overwritesOtherData: true
		});
		expect((await call('data/import', 'POST', settings)).status).toBe(200);
		expect(store.read().layout).toEqual(layout);
		expect(store.read().time[day]).toEqual({ phone: 180, gym: 60 });
	} finally {
		store.db.close();
	}
});

test('automated writes need no credentials, preserve manual values, and survive export and restore', async () => {
	const { store, call } = client();
	const restored = openCalendar(':memory:');
	const path = 'days/2026-11-17/widgets/phone';
	const automated = `${path}/automated`;
	try {
		const firstReport = { durationMinutes: 222 };
		expect((await call(automated, 'PUT', { durationMinutes: 1441 })).status).toBe(400);
		await call(path, 'PUT', { durationMinutes: null });
		expect((await call(automated, 'PUT', firstReport)).status).toBe(204);
		const latestReport = { durationMinutes: 230 };
		expect((await call(automated, 'PUT', latestReport)).status).toBe(204);
		expect(await (await call(path)).json()).toMatchObject({
			attached: true,
			source: 'automated',
			value: latestReport,
			manualValue: { durationMinutes: null },
			automatedValue: latestReport
		});
		const { app, exportedAt, ...backup } = JSON.parse(serializeDataExport(store.read()));
		restored.apply(changes(emptyCalendar(), backup));
		expect(restored.read()).toEqual(store.read());
		for (let attempt = 0; attempt < 2; attempt++) {
			expect((await call(`${path}/manual`, 'DELETE')).status).toBe(204);
			expect(await (await call(path)).json()).toMatchObject({
				attached: true,
				source: 'automated',
				manualValue: null,
				value: latestReport
			});
		}
		await call(path, 'PUT', { durationMinutes: 0 });
		expect((await call(path, 'DELETE')).status).toBe(204);
		expect(await (await call(path)).json()).toMatchObject({
			attached: false,
			visible: false,
			source: null,
			value: null,
			automatedValue: null,
			manualValue: null
		});
		await call(path, 'PUT', { durationMinutes: 180 });
		expect((await call(`${path}/manual`, 'DELETE')).status).toBe(204);
		expect(store.read()).toEqual(emptyCalendar());

		const steps = 'days/2026-11-17/widgets/steps';
		expect((await call(`${steps}/automated`, 'PUT', { value: null })).status).toBe(204);
		const manual = await call(steps, 'PUT', { value: 8200 });
		expect(await manual.json()).toMatchObject({
			attached: true,
			source: 'automated',
			value: { value: null },
			manualValue: { value: 8200 }
		});
	} finally {
		restored.db.close();
		store.db.close();
	}
});

test('GitHub activity stores validated daily totals and replaces them on replay', async () => {
	const { store, call } = client();
	const date = '2026-11-17';
	const path = `days/${date}/github-activity`;
	const value = { commits: 2, additions: 120, deletions: 4 };
	try {
		expect(await (await call(path)).json()).toEqual({ date, value: null });
		expect((await call(path, 'PUT', { ...value, deletions: -1 })).status).toBe(400);
		expect((await call(path, 'PUT', { ...value, commits: 1 })).status).toBe(204);
		expect((await call(path, 'PUT', value)).status).toBe(204);
		expect(await (await call(path)).json()).toEqual({ date, value });
		expect(store.read().githubActivity).toEqual({ [date]: value });
		const repo = { name: 'era-things/Era', url: 'https://github.com/era-things/Era', ...value };
		const detailed = { ...value, repositories: [repo] };
		expect((await call(path, 'PUT', detailed)).status).toBe(204);
		expect((await call(path, 'PUT', { ...value, repositories: [repo, repo] })).status).toBe(400);
		for (const url of [
			'javascript:alert(1)',
			'/era-things/Era',
			'https://user:secret@github.com/era-things/Era'
		]) {
			expect((await call(path, 'PUT', { ...value, repositories: [{ ...repo, url }] })).status).toBe(400);
		}
		expect(await (await call(path)).json()).toEqual({ date, value: detailed });
	} finally {
		store.db.close();
	}
});

test('automated phone writes store and replace daily app usage alongside the total', async () => {
	const { store, call } = client();
	const day = '2026-11-17';
	const path = `days/${day}/widgets/phone`;
	const automated = `${path}/automated`;
	const apps = [{ package: 'com.example.app', name: 'Example', minutes: 12, lastUsed: '2026-11-17T23:45:00Z' }];
	try {
		expect((await call(automated, 'PUT', { durationMinutes: 40, apps })).status).toBe(204);
		expect((await call(automated, 'PUT', { durationMinutes: 42 })).status).toBe(204);
		expect((await call(automated, 'PUT', { durationMinutes: 90, apps: [...apps, ...apps] })).status).toBe(400);
		const { automatedValue, value } = await (await call(path)).json();
		expect(value).toEqual({ durationMinutes: 42 });
		expect(automatedValue).toEqual({ durationMinutes: 42, apps });
		expect((await call(automated, 'PUT', { durationMinutes: 42, apps: [] })).status).toBe(204);
		expect((await (await call(path)).json()).automatedValue.apps).toEqual([]);
		expect((await call(path, 'DELETE')).status).toBe(204);
		expect(store.read().screenApps).toEqual({});
	} finally {
		store.db.close();
	}
});

test('phone app item writes preserve the automated duration and neighboring apps', async () => {
	const { store, call } = client();
	const widget = 'days/2026-11-17/widgets/phone';
	const apps = `${widget}/apps`;
	const app = `${apps}/com.example.app`;
	const example = { name: 'Example', minutes: 12, lastUsed: '2026-11-17T23:45:00Z' };
	const other = { package: 'com.example.other', name: 'Other', minutes: 3 };
	try {
		expect((await call(app, 'PUT', example)).status).toBe(409);
		expect((await call(`${widget}/automated`, 'PUT', { durationMinutes: 40, apps: [other] })).status)
			.toBe(204);
		expect((await call(app, 'PUT', example)).status).toBe(200);
		expect((await call(app, 'PUT', example)).status).toBe(200);
		expect((await call(app, 'PATCH', { minutes: 20 })).status).toBe(200);
		expect((await call(app, 'PATCH', { minutes: 1441 })).status).toBe(400);
		const updated = { package: 'com.example.app', ...example, minutes: 20 };
		expect(await (await call(app)).json()).toEqual(updated);
		expect(await (await call(apps)).json()).toEqual({ items: [other, updated] });
		expect(await (await call(widget)).json()).toMatchObject({
			source: 'automated',
			automatedValue: { durationMinutes: 40, apps: [other, updated] }
		});
		expect((await call(app, 'DELETE')).status).toBe(204);
		expect((await call(app, 'DELETE')).status).toBe(204);
		expect(await (await call(widget)).json()).toMatchObject({
			automatedValue: { durationMinutes: 40, apps: [other] }
		});
	} finally {
		store.db.close();
	}
});

test('GitHub repository item writes preserve daily totals and match names case-insensitively', async () => {
	const { store, call } = client();
	const day = '2026-11-17';
	const activity = `days/${day}/github-activity`;
	const repositories = `${activity}/repositories`;
	const repo = `${repositories}/era-things/Era`;
	const totals = { commits: 5, additions: 140, deletions: 12 };
	const other = { name: 'Other', commits: 1, additions: 100, deletions: 4 };
	const detail = { commits: 2, additions: 10, deletions: 3, url: 'https://github.com/era-things/Era' };
	try {
		expect((await call(repo, 'PUT', detail)).status).toBe(409);
		expect((await call(activity, 'PUT', { ...totals, repositories: [other] })).status).toBe(204);
		expect((await call(repo, 'PUT', detail)).status).toBe(200);
		expect(await (await call(`${repositories}/ERA-THINGS/era`, 'PUT', detail)).json())
			.toEqual({ name: 'era-things/Era', ...detail });
		const update = await call(`${repositories}/ERA-THINGS/era`, 'PATCH', { additions: 22 });
		const updated = { name: 'era-things/Era', ...detail, additions: 22 };
		expect(await update.json()).toEqual(updated);
		expect(await (await call(repositories)).json()).toEqual({ items: [other, updated] });
		expect(await (await call(activity)).json()).toEqual({
			date: day,
			value: { ...totals, repositories: [other, updated] }
		});
		expect((await call(repo, 'DELETE')).status).toBe(204);
		expect((await call(repo)).status).toBe(404);
		expect(await (await call(activity)).json()).toEqual({
			date: day,
			value: { ...totals, repositories: [other] }
		});
	} finally {
		store.db.close();
	}
});

test('automated sleep metrics persist independently of the clock duration', async () => {
	const { store, call } = client();
	const day = '2026-11-17';
	const path = `days/${day}/widgets/sleep`;
	const clocks = { startTime: '23:00', wakeUpTime: '07:00' };
	const metrics = { asleepMinutes: 440, awakeMinutes: 25, score: 83 };
	try {
		expect((await call(`${path}/automated`, 'PUT', {
			...clocks, metrics: { ...metrics, score: 101 }
		})).status).toBe(400);
		expect((await call(`${path}/automated`, 'PUT', { ...clocks, metrics })).status).toBe(204);
		const { automatedValue } = await (await call(path)).json();
		expect(automatedValue).toEqual({ ...clocks, durationMinutes: 480, metrics });
		const restored = openCalendar(':memory:');
		try {
			const { app, exportedAt, ...backup } = JSON.parse(serializeDataExport(store.read()));
			restored.apply(changes(emptyCalendar(), backup));
			expect(restored.read().automated[day].sleep?.metrics).toEqual(metrics);
		} finally {
			restored.db.close();
		}
		expect((await call(`${path}/automated`, 'PUT', clocks)).status).toBe(204);
		expect((await (await call(path)).json()).automatedValue).toEqual({
			...clocks,
			durationMinutes: 480
		});
	} finally {
		store.db.close();
	}
});

test('automated writes show a with-data widget only on days with data', async () => {
	const { store, call } = client();
	const day = 'days/2026-11-17';
	const path = `${day}/widgets/gym`;
	const otherDay = 'days/2026-11-18/widgets/gym';
	const value = { durationMinutes: 45 };
	try {
		expect((await call('widgets/gym', 'PATCH', { visibility: 'with-data' })).status).toBe(200);
		for (let attempt = 0; attempt < 2; attempt++) {
			expect((await call(`${path}/automated`, 'PUT', value)).status).toBe(204);
		}
		const { widgets } = await (await call(day)).json();
		expect(widgets.find((widget: { id: string }) => widget.id === 'gym')).toMatchObject({
			attached: true,
			visible: true,
			source: 'automated',
			value
		});
		expect(await (await call(otherDay)).json()).toMatchObject({
			attached: false,
			visible: false
		});
		expect(store.read().layout.widgets.gym.visibility).toBe('with-data');
	} finally {
		store.db.close();
	}
});

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

test('hidden widgets accept manual and automated API writes without appearing on the day', async () => {
	const { store, call } = client();
	const day = 'days/2026-11-17';
	const path = `${day}/widgets/weight`;
	try {
		expect((await call('widgets/weight', 'PATCH', { visibility: 'sometimes' })).status).toBe(400);
		const response = await call('widgets/weight', 'PATCH', { visibility: 'hidden', skin: 'display' });
		expect((await response.json()).settings).toEqual({ visibility: 'hidden', skin: 'display' });
		expect((await call(path, 'PUT', { value: 72.5 })).status).toBe(200);
		expect((await call(`${path}/automated`, 'PUT', { value: 73 })).status).toBe(204);
		expect(await (await call(path)).json()).toMatchObject({
			attached: true,
			visible: false,
			manualValue: { value: 72.5 },
			value: { value: 73 }
		});
		const { widgets } = await (await call(day)).json();
		expect(widgets.some((widget: { id: string }) => widget.id === 'weight')).toBe(false);
		await call('widgets/weight', 'PATCH', { visibility: 'with-data' });
		expect(await (await call(path)).json()).toMatchObject({
			visible: true,
			value: { value: 73 }
		});
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

test('nutrition item writes preserve neighboring entries and concurrent changes', async () => {
	const { store, call } = client();
	const widget = 'days/2026-11-17/widgets/nutrition';
	const items = `${widget}/items`;
	const lunch = { name: 'Lunch', quantity: 1.25, kcal: 500, protein: 25.5, fat: 10, carbs: 60 };
	const snack = { ...lunch, name: 'Snack', kcal: 125 };
	try {
		expect(await (await call(items)).json()).toEqual({ items: [] });
		expect((await call(`${items}/lunch`, 'PATCH', { quantity: 2 })).status).toBe(404);
		expect((await call(`${items}/lunch`, 'DELETE')).status).toBe(204);
		expect((await (await call(widget)).json()).attached).toBe(false);
		for (const response of await Promise.all([
			call(`${items}/lunch`, 'PUT', lunch),
			call(`${items}/snack`, 'PUT', snack)
		]))
			expect(response.status).toBe(200);
		expect((await call(`${items}/lunch`, 'PUT', lunch)).status).toBe(200);
		const listed = (await (await call(items)).json()).items;
		expect(listed).toHaveLength(2);
		expect(listed).toContainEqual({ ...lunch, id: 'lunch' });
		expect(listed).toContainEqual({ ...snack, id: 'snack' });
		for (const response of await Promise.all([
			call(`${items}/lunch`, 'PATCH', { quantity: 0.75 }),
			call(`${items}/lunch`, 'PATCH', { name: 'Leftovers' })
		]))
			expect(response.status).toBe(200);
		expect((await call(`${items}/lunch`, 'PATCH', { quantity: 0.751 })).status).toBe(400);
		expect((await call(`${items}/lunch`, 'PUT', { ...lunch, id: 'snack' })).status).toBe(400);
		expect(await (await call(`${items}/lunch`)).json()).toEqual({
			...lunch,
			id: 'lunch',
			quantity: 0.75,
			name: 'Leftovers'
		});
		for (let attempt = 0; attempt < 2; attempt++)
			expect((await call(`${items}/lunch`, 'DELETE')).status).toBe(204);
		expect((await call(`${items}/lunch`)).status).toBe(404);
		expect(await (await call(items)).json()).toEqual({ items: [{ ...snack, id: 'snack' }] });
		expect((await call(`${items}/snack`, 'DELETE')).status).toBe(204);
		expect(await (await call(widget)).json()).toMatchObject({ attached: true, value: { items: [] } });
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
		next.layout = setWidgetSettings(next.layout, 'steps', { skin: 'pedometer', visibility: 'pinned' });
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
