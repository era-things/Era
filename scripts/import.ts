import { openCalendar } from '../src/lib/server/database';
import { previewBackup, restoreBackup } from '../src/lib/server/backup';
if (!process.argv[2]) throw new Error('Usage: bun scripts/import.ts <era-export.json>');
const backup: unknown = await Bun.file(process.argv[2]).json();
const store = openCalendar();
try {
	const preview = previewBackup(store, backup);
	console.log(
		`Importing data for ${preview.days} day(s), overwriting values on ${preview.overwrittenDays} day(s).`
	);
	if (preview.overwritesOtherData)
		console.log('The import also updates existing widget settings, measures, or reminders.');
	restoreBackup(store, backup, preview);
	console.log('Imported and verified all sections.');
} finally {
	store.db.close();
}
