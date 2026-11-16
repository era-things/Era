import { test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { upgradeWidgetLayout } from '../scripts/upgrade-widget-layout';
import { openCalendar, validate } from '../src/lib/server/database';

test('one-time layout conversion backs up the database and preserves daily data and settings', () => {
	const dir = mkdtempSync(join(tmpdir(), 'era-widget-upgrade-'));
	try {
		const path = join(dir, 'era.sqlite'),
			old = new Database(path);
		old.exec(
			'CREATE TABLE records(key TEXT PRIMARY KEY,value TEXT NOT NULL); PRAGMA user_version=1'
		);
		const food = {
			id: 'lunch',
			name: 'Lunch',
			quantity: 2,
			kcal: 400,
			protein: 20,
			fat: 10,
			carbs: 50
		};
		const rows: [string[], unknown][] = [
			[['nutrition'], true],
			[['counter', 'steps'], true],
			[['counter-skin', 'steps'], 'pedometer'],
			[['counter-skin', 'weight'], 'display'],
			[['note-pin'], false],
			[['counter-value', '2026-11-15', 'weight'], null],
			[['counter-value', '2026-11-15', 'steps'], 0],
			[['note', '2026-11-15'], ''],
			[['note', '2026-11-16'], 'Keep this note'],
			[['emoji', '2026-11-15'], '🎉'],
			[['nutrition-day', '2026-11-15'], true],
			[['food', '2026-11-16', 'lunch'], food]
		];
		for (const [key, value] of rows)
			old.query('INSERT INTO records VALUES (?,?)').run(JSON.stringify(key), JSON.stringify(value));
		old.close();
		const backup = upgradeWidgetLayout(path),
			snapshot = new Database(backup, { readonly: true });
		expect(snapshot.query('SELECT count(*) AS count FROM records').get()).toEqual({
			count: rows.length
		});
		expect(snapshot.query('PRAGMA user_version').get()).toEqual({ user_version: 1 });
		snapshot.close();
		const current = openCalendar(path);
		try {
			const data = current.read();
			validate(data);
			expect(data.layout.widgets.steps).toEqual({
				pinned: true,
				skin: 'pedometer',
				archived: false
			});
			expect(data.layout.widgets.weight.skin).toBe('display');
			expect(data.layout.widgets.nutrition.pinned).toBe(true);
			expect(data.layout.widgets.note.pinned).toBe(false);
			expect(data.counters).toEqual({ '2026-11-15': { weight: null, steps: 0 } });
			expect(data.notes).toEqual({ '2026-11-15': '', '2026-11-16': 'Keep this note' });
			expect(data.nutrition).toEqual({ '2026-11-15': [], '2026-11-16': [food] });
			expect(data.emojis).toEqual({ '2026-11-15': '🎉' });
		} finally {
			current.db.close();
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
