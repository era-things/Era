import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openCalendar, Conflict } from '../src/lib/server/database';
import { emptyCalendar, changes } from '../src/lib/calendar-records';
import { setWidgetValue } from '../src/lib/widgets';

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
