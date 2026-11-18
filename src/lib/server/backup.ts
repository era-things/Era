import { isDeepStrictEqual } from 'node:util';
import { changes, decode, emptyCalendar, records } from '../calendar-records';
import type { BackupPreview, CalendarData } from '../data-export';
import { isRecord } from '../validation';
import { validate, type openCalendar } from './database';

export class InvalidBackup extends Error {}
export class BackupChanged extends Error {
	constructor(public preview: BackupPreview) {
		super('Era data changed. Review the updated import summary.');
	}
}

function backupRecords(backup: unknown) {
	if (
		!isRecord(backup) ||
		backup.app !== 'Era' ||
		typeof backup.exportedAt !== 'string' ||
		!Number.isFinite(Date.parse(backup.exportedAt))
	)
		throw new InvalidBackup('Choose a JSON file exported from Era.');
	const { app, exportedAt, ...sections } = backup;
	const data = { ...emptyCalendar(), ...sections };
	try {
		validate(data);
	} catch {
		throw new InvalidBackup('The file contains invalid Era data.');
	}
	// Exports explicitly include defaults for every widget when layout is present.
	return records(data, { includeDefaultSettings: Object.hasOwn(sections, 'layout') });
}

function planImport(current: CalendarData, incoming: Map<string, string>) {
	const rows = records(current, { includeDefaultSettings: true });
	const days = new Set<string>();
	const overwrittenDays = new Set<string>();
	let overwritesOtherData = false;
	for (const [key, value] of incoming) {
		const [kind, date] = JSON.parse(key) as string[];
		const daily = kind !== 'widget' && kind !== 'measure' && kind !== 'reminder';
		const previous = rows.get(key);
		const overwrites =
			previous !== undefined &&
			previous !== value &&
			!isDeepStrictEqual(JSON.parse(previous), JSON.parse(value));
		if (daily) {
			days.add(date);
			if (overwrites) overwrittenDays.add(date);
		} else if (overwrites) overwritesOtherData = true;
		rows.set(key, value);
	}
	const merged = decode(Array.from(rows, ([key, value]) => ({ key, value })));
	try {
		validate(merged);
	} catch {
		throw new InvalidBackup('The backup contains values that conflict with existing data.');
	}
	const preview: BackupPreview = {
		days: days.size,
		overwrittenDays: overwrittenDays.size,
		overwritesOtherData
	};
	return { merged, preview };
}

export function previewBackup(store: ReturnType<typeof openCalendar>, backup: unknown) {
	return planImport(store.read(), backupRecords(backup)).preview;
}

export function restoreBackup(
	store: ReturnType<typeof openCalendar>,
	backup: unknown,
	expectedPreview?: unknown
) {
	const incoming = backupRecords(backup);
	return store.db
		.transaction(() => {
			const current = store.read();
			const { merged, preview } = planImport(current, incoming);
			if (expectedPreview !== undefined && !isDeepStrictEqual(expectedPreview, preview))
				throw new BackupChanged(preview);
			store.apply(changes(current, merged));
			const restored = store.read();
			if (!isDeepStrictEqual(restored, merged)) throw new Error('Import did not round-trip');
			return restored;
		})
		.immediate();
}
