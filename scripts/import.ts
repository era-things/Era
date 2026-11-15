import { openCalendar, validate } from '../src/lib/server/database';
import { emptyCalendar, changes } from '../src/lib/calendar-records';
import { isDeepStrictEqual } from 'node:util';
if (!process.argv[2]) throw new Error('Usage: bun scripts/import.ts <era-export.json>');
const { app, exportedAt, ...data } = await Bun.file(process.argv[2]).json();
if (app !== 'Era' || !Number.isFinite(Date.parse(exportedAt)))
	throw new Error('Invalid Era export');
validate(data);
const store = openCalendar();
try {
	store.db
		.transaction(() => {
			if (!isDeepStrictEqual(store.read(), emptyCalendar()))
				throw new Error('Import requires an empty database');
			store.apply(changes(emptyCalendar(), data));
			if (!isDeepStrictEqual(store.read(), data)) throw new Error('Import did not round-trip');
		})
		.immediate();
	console.log('Imported and verified all sections.');
} finally {
	store.db.close();
}
