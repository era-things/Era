import { openCalendar } from '../src/lib/server/database';
import { restoreBackup } from '../src/lib/server/backup';
if (!process.argv[2]) throw new Error('Usage: bun scripts/import.ts <era-export.json>');
const backup: unknown = await Bun.file(process.argv[2]).json();
const store = openCalendar();
try {
	restoreBackup(store, backup);
	console.log('Imported and verified all sections.');
} finally {
	store.db.close();
}
