import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { CalendarData } from '../data-export';
import { decode, records, type Change } from '../calendar-records';
import { parseReminders } from '../reminders';
import { parseMeasures } from '../measures';
import { parseDayEmojis } from '../day-emojis';
import { parseDayNotes } from '../day-notes';
import { parseNutrition } from '../nutrition';
import { parseCounters } from '../counters';

export function validate(data: CalendarData) {
	const canonical = {
		notes: parseDayNotes(JSON.stringify(data.notes)),
		emojis: parseDayEmojis(JSON.stringify({ version: 1, days: data.emojis })),
		measures: parseMeasures(JSON.stringify({ version: 1, ...data.measures })),
		nutrition: parseNutrition(JSON.stringify(data.nutrition)),
		counters: parseCounters(JSON.stringify(data.counters)),
		reminders: parseReminders(JSON.stringify({ version: 1, reminders: data.reminders }))
	};
	if (!isDeepStrictEqual(canonical, data)) throw new Error('Invalid calendar data');
}
export class Conflict extends Error {}

export function openCalendar(path = process.env.ERA_DB ?? 'data/era.sqlite') {
	if (dirname(path) !== '.') mkdirSync(dirname(path), { recursive: true });
	const db = new Database(path, { create: true });
	db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
	const version = db.query('PRAGMA user_version').get() as { user_version: number };
	if (version.user_version === 0)
		db.transaction(() => {
			db.exec(
				'CREATE TABLE records (key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value))); PRAGMA user_version=1'
			);
		})();
	else if (version.user_version !== 1) throw new Error('Unknown database version');
	const list = db.query<{ key: string; value: string }, []>(
		'SELECT key,value FROM records ORDER BY rowid'
	);
	const lookup = db.query<{ value: string }, [string]>('SELECT value FROM records WHERE key=?');
	const put = db.query(
		'INSERT INTO records(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
	);
	const remove = db.query('DELETE FROM records WHERE key=?');
	const read = () => decode(list.all());
	const apply = db.transaction((edits: Change[]) => {
		for (const { key, before, after } of edits) {
			const path: unknown = JSON.parse(key);
			if (!Array.isArray(path) || path.some((p) => typeof p !== 'string' || p in Object.prototype))
				throw new Error('Invalid key');
			const current = lookup.get(key)?.value ?? null;
			if (current === after) continue;
			if (current !== before) throw new Conflict();
			if (after === null) remove.run(key);
			else put.run(key, after);
		}
		const rows = list.all();
		const data = decode(rows);
		validate(data);
		const expected = records(data);
		if (rows.some((r) => expected.get(r.key) !== r.value)) throw new Error('Invalid record');
	});
	return { db, read, apply: (edits: Change[]) => apply.immediate(edits) };
}
let connection: ReturnType<typeof openCalendar>;
export const calendar = () => (connection ??= openCalendar());
