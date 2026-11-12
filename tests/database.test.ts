import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openCalendar, Conflict } from '../src/lib/server/database';
import { emptyCalendar, changes } from '../src/lib/calendar-records';

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
