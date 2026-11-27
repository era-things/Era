import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openCalendar, Conflict } from '../src/lib/server/database';
import { emptyCalendar, changes } from '../src/lib/calendar-records';
import { setWidgetValue } from '../src/lib/widgets';
import { setEraMarks } from '../src/lib/eras';

test('active eras catch up after reopening and keep manual changes on processed days', () => {
	const dir = mkdtempSync(join(tmpdir(), 'era-test-'));
	const path = join(dir, 'calendar.sqlite');
	try {
		const initial = openCalendar(path);
		try {
			initial.update((data) => ({
				...data,
				eras: [
					{
						id: 'project',
						name: 'Project',
						description: '',
						archived: false,
						linkedValue: 'hours',
						autoMarkedThrough: '2026-11-20'
					},
					{ id: 'rest', name: 'Rest', description: '', archived: false, linkedValue: 'none' }
				],
				eraDays: { '2026-11-22': { project: { values: { hours: 60 } } } }
			}));
		} finally {
			initial.db.close();
		}
		const reopened = openCalendar(path);
		try {
			let notifications = 0;
			const unsubscribe = reopened.subscribe(() => notifications++);
			reopened.markActiveEraDays('2026-11-23');
			expect(reopened.read().eraDays).toEqual({
				'2026-11-21': { project: { marked: true } },
				'2026-11-22': { project: { marked: true, values: { hours: 60 } } },
				'2026-11-23': { project: { marked: true } }
			});
			expect(reopened.read().eras[0].autoMarkedThrough).toBe('2026-11-23');
			reopened.markActiveEraDays('2026-11-23');
			expect(notifications).toBe(1);
			unsubscribe();
			reopened.update((data) => ({
				...data,
				eraDays: setEraMarks(data.eraDays, 'project', [], ['2026-11-21'])
			}));
			reopened.markActiveEraDays('2026-11-24');
			expect(reopened.read().eraDays['2026-11-21']).toBeUndefined();
			expect(reopened.read().eraDays['2026-11-24']).toEqual({ project: { marked: true } });
		} finally {
			reopened.db.close();
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('concurrent edits survive reopening and stale batches roll back', () => {
	const dir = mkdtempSync(join(tmpdir(), 'era-test-'));
	const path = join(dir, 'calendar.sqlite');
	const store = openCalendar(path);
	try {
		const initial = emptyCalendar();
		const a = changes(initial, { ...initial, notes: { '2026-11-12': 'first' } });
		const b = changes(initial, { ...initial, notes: { '2026-11-13': 'second' } });
		store.apply(a);
		store.apply(b);
		store.apply(b);
		const stale = changes(initial, {
			...initial,
			notes: { '2026-11-14': 'rollback', '2026-11-12': 'stale' }
		});
		expect(() => store.apply(stale)).toThrow(Conflict);
		store.db.close();
		const reopened = openCalendar(path);
		try {
			expect(reopened.read().notes).toEqual({ '2026-11-12': 'first', '2026-11-13': 'second' });
		} finally {
			reopened.db.close();
		}
	} finally {
		store.db.close();
		rmSync(dir, { recursive: true, force: true });
	}
});

test('version 2 layout settings migrate without changing entries or skins', () => {
	const dir = mkdtempSync(join(tmpdir(), 'era-test-'));
	const path = join(dir, 'calendar.sqlite');
	const store = openCalendar(path);
	try {
		store.update((data) => setWidgetValue(data, '2026-11-12', 'weight', 72.5));
		const insert = store.db.query('INSERT INTO records(key, value) VALUES (?, ?)');
		insert.run('["widget","weight","archived"]', 'true');
		insert.run('["widget","weight","skin"]', '"display"');
		insert.run('["widget","steps","pinned"]', 'true');
		insert.run('["widget","note","pinned"]', 'false');
		store.db.exec('PRAGMA user_version=2');
		store.db.close();

		const migrated = openCalendar(path);
		try {
			expect(migrated.read().layout.widgets).toMatchObject({
				weight: { visibility: 'with-data', skin: 'display' },
				steps: { visibility: 'pinned' },
				note: { visibility: 'available' },
				sleep: { visibility: 'available' }
			});
			expect(migrated.read().counters).toEqual({ '2026-11-12': { weight: 72.5 } });
			// A normal write validates the migrated rows and their keys.
			migrated.update((data) => setWidgetValue(data, '2026-11-13', 'weight', 73));
		} finally {
			migrated.db.close();
		}
	} finally {
		store.db.close();
		rmSync(dir, { recursive: true, force: true });
	}
});

test('existing era timers become hour values when a database is upgraded', () => {
	const dir = mkdtempSync(join(tmpdir(), 'era-test-'));
	const path = join(dir, 'calendar.sqlite');
	const store = openCalendar(path);
	try {
		const insert = store.db.query('INSERT INTO records(key, value) VALUES (?, ?)');
		for (const id of ['project', 'winter']) {
			insert.run(
				JSON.stringify(['era', id]),
				JSON.stringify({ id, name: id, description: '', archived: false })
			);
		}
		insert.run('["era-mark","2026-11-12","winter"]', 'true');
		insert.run('["era-time","2026-11-12","project"]', '0');
		insert.run('["era-time","2026-11-13","project"]', '480');
		store.db.exec('PRAGMA user_version=3');
		store.db.close();

		const migrated = openCalendar(path);
		try {
			const data = migrated.read();
			expect(data.eras.map(({ linkedValue }) => linkedValue)).toEqual(['hours', 'none']);
			expect(data.eraDays).toEqual({
				'2026-11-12': { winter: { marked: true }, project: { values: { hours: 0 } } },
				'2026-11-13': { project: { values: { hours: 480 } } }
			});
			migrated.update((value) => value);
		} finally {
			migrated.db.close();
		}
	} finally {
		store.db.close();
		rmSync(dir, { recursive: true, force: true });
	}
});
