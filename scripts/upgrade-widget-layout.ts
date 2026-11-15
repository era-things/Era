import { Database } from 'bun:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { decode, records } from '../src/lib/calendar-records';
import { validate } from '../src/lib/server/database';
import { emptyLayout, WIDGETS } from '../src/lib/widgets';

// One-time conversion; the application only reads the current schema.
export function upgradeWidgetLayout(path: string) {
	const db = new Database(path, { strict: true });
	try {
		if ((db.query('PRAGMA user_version').get() as { user_version: number }).user_version !== 1)
			throw new Error('Expected widget schema version 1');
		const backup = `${path}.before-widget-layout-${Date.now()}.sqlite`;
		db.query('VACUUM INTO ?').run(backup);
		const snapshot = new Database(backup, { readonly: true });
		const saved = new Map(
			snapshot
				.query<{ key: string; value: string }, []>('SELECT key,value FROM records')
				.all()
				.map(({ key, value }) => [key, value])
		);
		snapshot.close();
		db.transaction(() => {
			const rows = db
				.query<{ key: string; value: string }, []>('SELECT key,value FROM records ORDER BY rowid')
				.all();
			if (rows.length !== saved.size || rows.some(({ key, value }) => saved.get(key) !== value))
				throw new Error('Database changed during backup; retry the conversion');
			const layout = emptyLayout(),
				retained = [],
				obsolete = [];
			for (const row of rows) {
				const [kind, id] = JSON.parse(row.key);
				const widgetId = kind === 'nutrition' ? 'nutrition' : kind === 'note-pin' ? 'note' : id;
				if (!['nutrition', 'note-pin', 'counter', 'counter-skin'].includes(kind)) {
					retained.push(row);
					continue;
				}
				const widget = WIDGETS.find(({ id }) => id === widgetId);
				if (!widget) throw new Error('Unknown widget in existing settings');
				Object.assign(layout.widgets[widget.id], {
					[kind === 'counter-skin' ? 'skin' : 'pinned']: JSON.parse(row.value)
				});
				obsolete.push(row.key);
			}
			const data = { ...decode(retained), layout };
			validate(data);
			const next = records(data);
			if (retained.some(({ key, value }) => next.get(key) !== value))
				throw new Error('Daily data would change');
			for (const key of obsolete) db.query('DELETE FROM records WHERE key=?').run(key);
			for (const [key, value] of next)
				if (saved.get(key) !== value)
					db.query(
						'INSERT INTO records(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
					).run(key, value);
			db.exec('PRAGMA user_version=2');
			const result = decode(
				db
					.query<{ key: string; value: string }, []>('SELECT key,value FROM records ORDER BY rowid')
					.all()
			);
			if (!isDeepStrictEqual(result, data)) throw new Error('Conversion failed to round-trip');
		}).immediate();
		return backup;
	} finally {
		db.close();
	}
}

if (import.meta.main)
	console.log(
		`Converted widget settings. Backup: ${upgradeWidgetLayout(process.argv[2] ?? process.env.ERA_DB ?? 'data/era.sqlite')}`
	);
