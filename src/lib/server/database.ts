import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { CalendarData } from '../data-export';
import { addDays, type DateKey } from '../calendar';
import { isRecord } from '../validation';
import { changes, decode, records, type Change } from '../calendar-records';
import { normalizeReminders } from '../reminders';
import { normalizeMeasures } from '../measures';
import { normalizeDayEmojis } from '../day-emojis';
import { normalizeDayNotes } from '../day-notes';
import { normalizeNutrition } from '../nutrition';
import { normalizeCounters } from '../counters';
import { normalizeLayout } from '../layout';
import { normalizeSleep } from '../sleep';
import { normalizeTime } from '../time';
import { normalizeScreenApps } from '../screen-apps';
import { normalizeGitHubActivity } from '../github-activity';
import { normalizeAutomatedValues, WIDGETS } from '../widgets';
import { normalizeEras, normalizeEraDays, type Era } from '../eras';
import { currentEraDay } from './era-day';
import { DEFAULT_TIMELINE_COLOR, isTimelineColor } from '../timeline-color';

export function validate(data: unknown): asserts data is CalendarData {
	if (!isRecord(data)) throw new Error('Invalid calendar data');
	const eras = normalizeEras(data.eras);
	const canonical = {
		timelineColor: isTimelineColor(data.timelineColor)
			? data.timelineColor
			: DEFAULT_TIMELINE_COLOR,
		eras,
		eraDays: normalizeEraDays(data.eraDays, eras),
		notes: normalizeDayNotes(data.notes),
		emojis: normalizeDayEmojis(data.emojis),
		measures: normalizeMeasures(data.measures),
		nutrition: normalizeNutrition(data.nutrition),
		counters: normalizeCounters(data.counters),
		sleep: normalizeSleep(data.sleep),
		time: normalizeTime(data.time),
		screenApps: normalizeScreenApps(data.screenApps),
		githubActivity: normalizeGitHubActivity(data.githubActivity),
		automated: normalizeAutomatedValues(data.automated),
		layout: normalizeLayout(data.layout),
		reminders: normalizeReminders(data.reminders)
	};
	if (!isDeepStrictEqual(canonical, data)) throw new Error('Invalid calendar data');
}
export class Conflict extends Error {}

export function openCalendar(path = process.env.ERA_DB ?? 'data/era.sqlite') {
	if (dirname(path) !== '.') mkdirSync(dirname(path), { recursive: true });
	const db = new Database(path, { create: true });
	db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
	db.transaction(() => {
		const { user_version: version } = db.query('PRAGMA user_version').get() as {
			user_version: number;
		};
		if (version === 0) {
			db.exec(
				'CREATE TABLE records (key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value))); PRAGMA user_version=4'
			);
		} else if (version === 2) {
			const get = db.query<{ value: string }, [string]>('SELECT value FROM records WHERE key=?');
			const remove = db.query('DELETE FROM records WHERE key IN (?, ?)');
			const insert = db.query('INSERT INTO records(key,value) VALUES (?,?)');
			for (const widget of WIDGETS) {
				const pinnedKey = JSON.stringify(['widget', widget.id, 'pinned']);
				const archivedKey = JSON.stringify(['widget', widget.id, 'archived']);
				// In version 2, Note was the only widget pinned by default.
				const pinned = get.get(pinnedKey)?.value ?? String(widget.id === 'note');
				const archived = get.get(archivedKey)?.value === 'true';
				const visibility = archived ? 'with-data' : pinned === 'true' ? 'pinned' : 'available';
				if (visibility !== widget.visibility)
					insert.run(
						JSON.stringify(['widget', widget.id, 'visibility']),
						JSON.stringify(visibility)
					);
				remove.run(pinnedKey, archivedKey);
			}
		} else if (version !== 3 && version !== 4) throw new Error('Unknown database version');
		if (version === 2 || version === 3) {
			db.exec(`
				UPDATE records AS era
				SET value = json_set(value, '$.linkedValue', CASE WHEN EXISTS (
					SELECT 1 FROM records AS timer
					WHERE json_extract(timer.key, '$[0]') = 'era-time'
					  AND json_extract(timer.key, '$[2]') = json_extract(era.key, '$[1]')
				) THEN 'hours' ELSE 'none' END)
				WHERE json_extract(key, '$[0]') = 'era';
				UPDATE records
				SET key = json_array('era-value', json_extract(key, '$[1]'), json_extract(key, '$[2]')),
				    value = json_object('hours', json(value))
				WHERE json_extract(key, '$[0]') = 'era-time';
				PRAGMA user_version=4;
			`);
		}
	}).immediate();
	const list = db.query<{ key: string; value: string }, []>(
		'SELECT key,value FROM records ORDER BY rowid'
	);
	const lookup = db.query<{ value: string }, [string]>('SELECT value FROM records WHERE key=?');
	const put = db.query(
		'INSERT INTO records(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
	);
	const remove = db.query('DELETE FROM records WHERE key=?');
	const dueEras = db.query<{ key: string; value: string }, [DateKey]>(
		`SELECT key,value FROM records
		 WHERE key LIKE '["era",%' AND json_extract(value, '$.autoMarkedThrough') < ?`
	);
	const markDay = db.query(
		'INSERT INTO records(key,value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING'
	);
	const read = () => decode(list.all());
	const listeners = new Set<() => void>();
	const totalChanges = db.query<{ count: number }, []>('SELECT total_changes() AS count');

	function commit<T>(write: () => T): T {
		// A nested write belongs to the outer transaction's notification.
		if (!listeners.size || db.inTransaction) return write();
		const before = totalChanges.get()!.count;
		const result = write();
		if (totalChanges.get()!.count !== before) {
			for (const listener of listeners) listener();
		}
		return result;
	}

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
	// API callers mutate the latest state under one write lock; no client versions.
	const update = db.transaction((mutate: (data: CalendarData) => CalendarData) => {
		const current = read();
		const next = mutate(current);
		validate(next);
		apply(changes(current, next));
		return next;
	});
	const markActiveEraDays = db.transaction((today: DateKey) => {
		for (const { key, value } of dueEras.all(today)) {
			const era = JSON.parse(value) as Era;
			let date = era.autoMarkedThrough!;
			while (date < today) {
				date = addDays(date, 1);
				markDay.run(JSON.stringify(['era-mark', date, era.id]), 'true');
			}
			put.run(key, JSON.stringify({ ...era, autoMarkedThrough: today }));
		}
	});
	return {
		db,
		read,
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		apply: (edits: Change[]) => commit(() => apply.immediate(edits)),
		update: (mutate: (data: CalendarData) => CalendarData) =>
			commit(() => update.immediate(mutate)),
		markActiveEraDays: (today: DateKey) => commit(() => markActiveEraDays.immediate(today)),
		transaction: <T>(write: () => T): T => commit(() => db.transaction(write).immediate())
	};
}
let connection: ReturnType<typeof openCalendar>;
let lastEraDay: DateKey | undefined;

export function calendar() {
	const store = (connection ??= openCalendar());
	const { date } = currentEraDay();
	if (lastEraDay !== date) {
		store.markActiveEraDays(date);
		lastEraDay = date;
	}
	return store;
}
