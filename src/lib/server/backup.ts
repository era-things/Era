import { isDeepStrictEqual } from 'node:util';
import { changes, emptyCalendar } from '../calendar-records';
import { isRecord } from '../validation';
import { validate, type openCalendar } from './database';

export class InvalidBackup extends Error {}
export class NonEmptyCalendar extends Error {}

export function restoreBackup(store: ReturnType<typeof openCalendar>, backup: unknown) {
	if (
		!isRecord(backup) ||
		backup.app !== 'Era' ||
		typeof backup.exportedAt !== 'string' ||
		!Number.isFinite(Date.parse(backup.exportedAt))
	)
		throw new InvalidBackup('Choose a JSON file exported from Era.');
	const { app, exportedAt, ...data } = backup;
	try {
		validate(data);
	} catch {
		throw new InvalidBackup('The file contains invalid Era data.');
	}

	return store.db
		.transaction(() => {
			const empty = emptyCalendar();
			if (!isDeepStrictEqual(store.read(), empty))
				throw new NonEmptyCalendar('Import requires an empty database.');
			store.apply(changes(empty, data));
			const restored = store.read();
			if (!isDeepStrictEqual(restored, data)) throw new Error('Import did not round-trip');
			return restored;
		})
		.immediate();
}
